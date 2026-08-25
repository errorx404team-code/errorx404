"""
MUMPS Parser — Stage 2 of the transpiler pipeline.

Converts the flat token stream produced by the lexer into a structured AST
(Routine → LabelBlock → MumpsLine → Statement → Expression).

Design principles:
- No domain knowledge whatsoever.
- Tolerant: unknown constructs produce UnknownStatement nodes.
- Preserves full source traceability (line/col in every node).
- Handles all documented MUMPS command forms generically.
"""

from __future__ import annotations
import re
from typing import List, Optional, Any

from .lexer import MumpsLexer, Token, TT
from .ast_nodes import (
    Node, NumberLiteral, StringLiteral, LocalVar, GlobalVar, SpecialVar,
    IntrinsicCall, Indirection, BinOp, UnaryOp, Subscript, ExtRoutineRef,
    FunctionCall, PatternMatch,
    Postcondition, SetStatement, KillStatement, NewStatement,
    DoStatement, DoArg, GotoStatement, GotoArg,
    IfStatement, ElseStatement, ForStatement, ForRange,
    WriteStatement, WriteArg, ReadStatement, ReadArg,
    QuitStatement, XecuteStatement, HangStatement, MergeStatement,
    UnknownStatement, MumpsLine, LabelBlock, Routine,
)


class ParseError(Exception):
    def __init__(self, msg: str, line: int = 0, col: int = 0):
        super().__init__(f"ParseError at L{line}:C{col}: {msg}")
        self.line = line
        self.col = col


class _TokenCursor:
    """Simple lookahead cursor over a token list."""

    def __init__(self, tokens: List[Token]):
        self._tokens = tokens
        self._pos = 0

    def peek(self, offset: int = 0) -> Token:
        idx = self._pos + offset
        if idx >= len(self._tokens):
            return self._tokens[-1]   # EOF
        return self._tokens[idx]

    def advance(self) -> Token:
        t = self.peek()
        self._pos += 1
        return t

    def expect(self, tt: TT) -> Token:
        t = self.peek()
        if t.type != tt:
            raise ParseError(f"Expected {tt.name}, got {t.type.name} ({t.value!r})", t.line, t.col)
        return self.advance()

    def match(self, *tts: TT) -> bool:
        return self.peek().type in tts

    def skip_while(self, *tts: TT):
        while self.peek().type in tts:
            self.advance()

    @property
    def at_end(self) -> bool:
        return self.peek().type == TT.EOF

    def current_line(self) -> int:
        return self.peek().line

    def save(self) -> int:
        return self._pos

    def restore(self, pos: int):
        self._pos = pos


class MumpsParser:
    """
    Parses a MUMPS source string into a Routine AST.

    Usage:
        parser = MumpsParser(source_text)
        routine = parser.parse()
    """

    def __init__(self, source: str):
        self._source = source
        lexer = MumpsLexer(source)
        all_tokens = lexer.tokenize()
        # Filter out NEWLINE tokens — we work line-by-line implicitly
        self._tokens = [t for t in all_tokens if t.type not in (TT.NEWLINE,)]
        self._cur = _TokenCursor(self._tokens)
        self._source_lines = source.splitlines()

    def parse(self) -> Routine:
        routine = Routine(line=1, col=0, source_text=self._source)
        routine.name = "UNKNOWN"

        current_label: Optional[LabelBlock] = None

        while not self._cur.at_end:
            tok = self._cur.peek()

            if tok.type == TT.EOF:
                break

            if tok.type == TT.LABEL:
                # Save previous label block
                if current_label is not None:
                    routine.labels.append(current_label)

                # Parse the new label
                current_label = self._parse_label_block()

                # First label encountered may give us the routine name
                if routine.name == "UNKNOWN" and current_label:
                    routine.name = current_label.name

            elif tok.type == TT.INDENT:
                # Body line — belongs to the current label block
                line_node = self._parse_body_line()
                if line_node:
                    if current_label is None:
                        # Indented code before any label — create implicit root
                        current_label = LabelBlock(name="__main__", line=tok.line, col=tok.col)
                    current_label.lines.append(line_node)

            elif tok.type == TT.COMMENT:
                # Top-level comment — discard or attach to current label
                self._cur.advance()

            else:
                # Unexpected token — try to recover
                self._cur.advance()

        # Don't forget the last label
        if current_label is not None:
            routine.labels.append(current_label)

        return routine

    # ── Label parsing ─────────────────────────────────────────────────────────

    def _parse_label_block(self) -> LabelBlock:
        tok = self._cur.expect(TT.LABEL)
        label_raw = tok.value  # e.g. "VERIFY(DFN)" or "START"

        # Split name from optional parameter list
        pm = re.match(r'^([A-Z0-9%]+)(\(([^)]*)\))?', label_raw)
        name = pm.group(1) if pm else label_raw
        params_str = pm.group(3) if pm and pm.group(3) else ""
        params = [p.strip() for p in params_str.split(",") if p.strip()]

        block = LabelBlock(name=name, params=params, line=tok.line, col=tok.col,
                           source_text=tok.raw)

        # Inline statements on the label line (after the label itself, before newline)
        # These appear as INDENT + commands on the same physical line in some MUMPS dialects.
        # We simply pass — body lines come as separate INDENT tokens.

        return block

    # ── Body line parsing ─────────────────────────────────────────────────────

    def _parse_body_line(self) -> Optional[MumpsLine]:
        """Parse one indented MUMPS line. Returns a MumpsLine node."""
        tok = self._cur.peek()
        if tok.type != TT.INDENT:
            return None

        line_no = tok.line
        self._cur.advance()   # consume INDENT

        # Count leading dots (DO block nesting)
        dot_depth = 0
        while self._cur.peek().type == TT.DOT:
            dot_depth += 1
            self._cur.advance()

        src_text = self._source_lines[line_no - 1] if line_no <= len(self._source_lines) else ""
        mline = MumpsLine(line=line_no, col=0, dot_depth=dot_depth, source_text=src_text)

        # Parse all statements on this line until comment/end-of-line
        while not self._cur.at_end:
            cur = self._cur.peek()
            if cur.line != line_no:
                break
            if cur.type == TT.COMMENT:
                self._cur.advance()
                break
            if cur.type in (TT.INDENT, TT.LABEL, TT.EOF):
                break

            stmt = self._parse_statement()
            if stmt is not None:
                mline.statements.append(stmt)

        return mline

    # ── Statement dispatch ────────────────────────────────────────────────────

    def _parse_statement(self) -> Optional[Any]:
        tok = self._cur.peek()
        line_no = tok.line

        # Postconditional on the command — CMD:CONDITION args
        # We parse the command token, then check for ':'
        cmd_tok = self._cur.advance()

        postcond = None
        if self._cur.peek().type == TT.COLON and self._cur.peek().line == line_no:
            self._cur.advance()   # consume ':'
            postcond_expr = self._parse_expr()
            postcond = Postcondition(condition=postcond_expr, line=cmd_tok.line, col=cmd_tok.col)

        # Dispatch
        tt = cmd_tok.type
        if tt == TT.CMD_SET:
            s = self._parse_set(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt == TT.CMD_KILL:
            s = self._parse_kill(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt == TT.CMD_NEW:
            s = self._parse_new(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt == TT.CMD_DO:
            s = self._parse_do(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt == TT.CMD_GOTO:
            s = self._parse_goto(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt == TT.CMD_IF:
            return self._parse_if(cmd_tok)
        if tt == TT.CMD_ELSE:
            return ElseStatement(line=cmd_tok.line, col=cmd_tok.col)
        if tt == TT.CMD_FOR:
            return self._parse_for(cmd_tok)
        if tt == TT.CMD_WRITE:
            s = self._parse_write(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt == TT.CMD_READ:
            s = self._parse_read(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt == TT.CMD_QUIT:
            s = self._parse_quit(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt == TT.CMD_XECUTE:
            s = XecuteStatement(expr=self._parse_expr(), line=cmd_tok.line, col=cmd_tok.col)
            s.postcond = postcond
            return s
        if tt == TT.CMD_HANG:
            s = HangStatement(expr=self._parse_expr(), line=cmd_tok.line, col=cmd_tok.col)
            s.postcond = postcond
            return s
        if tt == TT.CMD_MERGE:
            s = self._parse_merge(cmd_tok)
            if s: s.postcond = postcond
            return s
        if tt in (TT.CMD_UNKNOWN, TT.CMD_LOCK, TT.CMD_JOB, TT.CMD_OPEN,
                  TT.CMD_CLOSE, TT.CMD_USE, TT.CMD_VIEW,
                  TT.CMD_TSTART, TT.CMD_TROLLBACK, TT.CMD_TCOMMIT):
            # Consume rest of arguments on this line, preserve as raw text
            raw = cmd_tok.value
            cur_line = cmd_tok.line
            while not self._cur.at_end and self._cur.peek().line == cur_line:
                nt = self._cur.peek()
                if nt.type in (TT.COMMENT, TT.LABEL, TT.INDENT, TT.EOF):
                    break
                raw += " " + self._cur.advance().value
            return UnknownStatement(raw_text=raw, line=cmd_tok.line, col=cmd_tok.col)
        if tt == TT.IDENT:
            # Could be an ambiguous token that the lexer classified as IDENT
            # but is actually a command (e.g. lowercase 'd' in some dialects).
            raw = cmd_tok.value
            cur_line = cmd_tok.line
            while not self._cur.at_end and self._cur.peek().line == cur_line:
                nt = self._cur.peek()
                if nt.type in (TT.COMMENT, TT.LABEL, TT.INDENT, TT.EOF):
                    break
                raw += " " + self._cur.advance().value
            return UnknownStatement(raw_text=raw, line=cmd_tok.line, col=cmd_tok.col)

        # Anything else — try to skip to avoid infinite loops
        return UnknownStatement(raw_text=cmd_tok.value, line=cmd_tok.line, col=cmd_tok.col)

    # ── Command parsers ───────────────────────────────────────────────────────

    def _parse_set(self, tok: Token) -> SetStatement:
        """SET var=expr [, var=expr ...]"""
        stmt = SetStatement(line=tok.line, col=tok.col)
        stmt.assignments = self._parse_assignment_list()
        return stmt

    def _parse_assignment_list(self):
        """Parse one or more comma-separated lvalue=expr pairs."""
        assignments = []
        while True:
            lval = self._parse_lvalue()
            if self._cur.match(TT.EQ):
                self._cur.advance()
                rval = self._parse_expr()
            else:
                rval = None   # malformed, tolerate
            assignments.append((lval, rval))
            if self._cur.match(TT.COMMA) and self._same_statement():
                self._cur.advance()
            else:
                break
        return assignments

    def _parse_kill(self, tok: Token) -> KillStatement:
        stmt = KillStatement(line=tok.line, col=tok.col)
        # Argumentless KILL (kills all locals) — no args follow on same line cmd
        if self._at_line_end_or_comment(tok.line):
            return stmt   # stmt.targets stays empty
        while True:
            stmt.targets.append(self._parse_lvalue())
            if self._cur.match(TT.COMMA) and self._same_statement():
                self._cur.advance()
            else:
                break
        return stmt

    def _parse_new(self, tok: Token) -> NewStatement:
        stmt = NewStatement(line=tok.line, col=tok.col)
        if self._at_line_end_or_comment(tok.line):
            return stmt   # NEW with no args
        # Check for exclusive form: NEW (X,Y) = new all EXCEPT X,Y
        if self._cur.match(TT.LPAREN):
            self._cur.advance()
            stmt.exclusive = True
            while not self._cur.match(TT.RPAREN, TT.EOF):
                v = self._cur.advance()
                if v.type in (TT.IDENT, TT.LOCAL_VAR):
                    stmt.vars.append(v.value)
                elif v.type == TT.COMMA:
                    continue
            if self._cur.match(TT.RPAREN):
                self._cur.advance()
        else:
            while True:
                v = self._cur.peek()
                if v.type in (TT.IDENT, TT.LOCAL_VAR):
                    stmt.vars.append(self._cur.advance().value)
                elif v.type == TT.COMMA and self._same_statement():
                    self._cur.advance()
                    continue
                else:
                    break
        return stmt

    def _parse_do(self, tok: Token) -> DoStatement:
        stmt = DoStatement(line=tok.line, col=tok.col)
        if self._at_line_end_or_comment(tok.line):
            stmt.argumentless = True
            return stmt
        while True:
            arg = self._parse_do_arg(tok.line)
            stmt.calls.append(arg)
            if self._cur.match(TT.COMMA) and self._same_statement():
                self._cur.advance()
            else:
                break
        return stmt

    def _parse_do_arg(self, cmd_line: int) -> DoArg:
        arg = DoArg(line=self._cur.peek().line, col=self._cur.peek().col)
        # Label[^Routine][+offset][(args)]
        tok = self._cur.peek()
        if tok.type in (TT.IDENT, TT.LOCAL_VAR):
            arg.label = self._cur.advance().value
        elif tok.type == TT.CARET:
            # ^ROUTINE — no label, just routine
            self._cur.advance()
            if self._cur.peek().type == TT.IDENT:
                arg.routine = self._cur.advance().value
        if self._cur.match(TT.CARET):
            self._cur.advance()   # consume ^
            if self._cur.peek().type == TT.IDENT:
                arg.routine = self._cur.advance().value
        # Offset: +N
        if self._cur.match(TT.PLUS) and self._same_statement():
            self._cur.advance()
            if self._cur.peek().type in (TT.INT_LIT, TT.IDENT):
                arg.offset = self._cur.advance().value
        # Argument list: (expr [,expr ...])
        if self._cur.match(TT.LPAREN) and self._same_statement():
            self._cur.advance()
            while not self._cur.match(TT.RPAREN, TT.EOF):
                by_ref = False
                if self._cur.match(TT.DOT):
                    by_ref = True
                    self._cur.advance()
                arg.args.append(self._parse_expr())
                arg.by_ref_flags.append(by_ref)
                if self._cur.match(TT.COMMA):
                    self._cur.advance()
            if self._cur.match(TT.RPAREN):
                self._cur.advance()
        return arg

    def _parse_goto(self, tok: Token) -> GotoStatement:
        stmt = GotoStatement(line=tok.line, col=tok.col)
        while True:
            arg = GotoArg(line=self._cur.peek().line, col=self._cur.peek().col)
            t = self._cur.peek()
            if t.type in (TT.IDENT, TT.LOCAL_VAR):
                arg.label = self._cur.advance().value
            if self._cur.match(TT.CARET) and self._same_statement():
                self._cur.advance()
                if self._cur.peek().type == TT.IDENT:
                    arg.routine = self._cur.advance().value
            if self._cur.match(TT.PLUS) and self._same_statement():
                self._cur.advance()
                if self._cur.peek().type in (TT.INT_LIT, TT.IDENT):
                    arg.offset = self._cur.advance().value
            stmt.calls.append(arg)
            if self._cur.match(TT.COMMA) and self._same_statement():
                self._cur.advance()
            else:
                break
        return stmt

    def _parse_if(self, tok: Token) -> IfStatement:
        stmt = IfStatement(line=tok.line, col=tok.col)
        # IF with no arguments uses $TEST — argumentless IF is valid MUMPS
        if self._at_line_end_or_comment(tok.line):
            stmt.conditions.append(SpecialVar(name='$TEST', line=tok.line, col=tok.col))
            return stmt
        # Multiple conditions are space-separated and AND-ed
        while not self._cur.at_end:
            nt = self._cur.peek()
            if nt.line != tok.line:
                break
            if nt.type in (TT.COMMENT, TT.LABEL, TT.INDENT, TT.EOF):
                break
            # Stop if we hit another command keyword on the same line
            if nt.type in (TT.CMD_SET, TT.CMD_WRITE, TT.CMD_QUIT, TT.CMD_DO,
                           TT.CMD_GOTO, TT.CMD_KILL, TT.CMD_NEW, TT.CMD_ELSE,
                           TT.CMD_FOR, TT.CMD_READ, TT.CMD_XECUTE, TT.CMD_HANG,
                           TT.CMD_MERGE, TT.CMD_UNKNOWN):
                break
            expr = self._parse_expr()
            stmt.conditions.append(expr)
            # MUMPS allows multiple space-separated conditions (treated as AND)
        return stmt

    def _parse_for(self, tok: Token) -> ForStatement:
        stmt = ForStatement(line=tok.line, col=tok.col)
        if self._at_line_end_or_comment(tok.line):
            stmt.argumentless = True
            return stmt
        # FOR var=start:step[:stop] [, ...]
        var_tok = self._cur.peek()
        if var_tok.type in (TT.IDENT, TT.LOCAL_VAR):
            stmt.var = self._cur.advance().value
            if self._cur.match(TT.EQ):
                self._cur.advance()
                # Parse one or more start:step[:stop] ranges
                while True:
                    start = self._parse_expr()
                    step = None
                    stop = None
                    if self._cur.match(TT.COLON) and self._same_statement():
                        self._cur.advance()
                        step = self._parse_expr()
                        if self._cur.match(TT.COLON) and self._same_statement():
                            self._cur.advance()
                            stop = self._parse_expr()
                    stmt.ranges.append(ForRange(start=start, step=step, stop=stop,
                                                 line=var_tok.line, col=var_tok.col))
                    if self._cur.match(TT.COMMA) and self._same_statement():
                        self._cur.advance()
                    else:
                        break
        return stmt

    def _parse_write(self, tok: Token) -> WriteStatement:
        stmt = WriteStatement(line=tok.line, col=tok.col)
        if self._at_line_end_or_comment(tok.line):
            return stmt
        while True:
            arg = self._parse_write_arg(tok.line)
            if arg is None:
                break
            stmt.args.append(arg)
            if self._cur.match(TT.COMMA) and self._same_statement():
                self._cur.advance()
            else:
                break
        return stmt

    def _parse_write_arg(self, cmd_line: int) -> Optional[WriteArg]:
        tok = self._cur.peek()
        if tok.line != cmd_line:
            return None
        # ! = newline
        if tok.type == TT.OR:    # '!' in expression context but WRITE ! = newline
            self._cur.advance()
            return WriteArg(kind='newline', line=tok.line, col=tok.col)
        # # = formfeed
        if tok.type == TT.HASH:
            self._cur.advance()
            return WriteArg(kind='formfeed', line=tok.line, col=tok.col)
        # ?expr = column tab
        if tok.type in (TT.IDENT,) and tok.value == '?':
            self._cur.advance()
            tab_e = self._parse_expr()
            return WriteArg(kind='tab', tab_expr=tab_e, line=tok.line, col=tok.col)
        # Expression argument
        if tok.type not in (TT.COMMA, TT.COMMENT, TT.LABEL, TT.INDENT, TT.EOF):
            expr = self._parse_expr()
            return WriteArg(kind='expr', expr=expr, line=tok.line, col=tok.col)
        return None

    def _parse_read(self, tok: Token) -> ReadStatement:
        stmt = ReadStatement(line=tok.line, col=tok.col)
        if self._at_line_end_or_comment(tok.line):
            return stmt
        while True:
            rt = self._cur.peek()
            if rt.line != tok.line or rt.type in (TT.COMMENT, TT.LABEL, TT.INDENT, TT.EOF):
                break
            # Prompt string before variable?
            if rt.type == TT.STR_LIT:
                prompt = self._cur.advance().value
                stmt.args.append(ReadArg(kind='prompt', prompt=prompt,
                                          line=rt.line, col=rt.col))
            elif rt.type == TT.OR:   # ! newline
                self._cur.advance()
                stmt.args.append(ReadArg(kind='newline', line=rt.line, col=rt.col))
            elif rt.type in (TT.IDENT, TT.LOCAL_VAR, TT.GLOBAL_VAR):
                var_expr = self._parse_lvalue()
                timeout = None
                if self._cur.match(TT.COLON):
                    self._cur.advance()
                    timeout = self._parse_expr()
                stmt.args.append(ReadArg(kind='var', target=var_expr,
                                          timeout=timeout, line=rt.line, col=rt.col))
            else:
                break
            if self._cur.match(TT.COMMA) and self._same_statement():
                self._cur.advance()
            else:
                break
        return stmt

    def _parse_quit(self, tok: Token) -> QuitStatement:
        stmt = QuitStatement(line=tok.line, col=tok.col)
        # QUIT inside a FOR loop can have no argument
        if self._at_line_end_or_comment(tok.line):
            return stmt
        nt = self._cur.peek()
        if nt.line == tok.line and nt.type not in (TT.COMMENT, TT.INDENT, TT.LABEL,
                                                    TT.EOF, TT.CMD_IF, TT.CMD_ELSE,
                                                    TT.CMD_WRITE, TT.CMD_SET,
                                                    TT.CMD_DO, TT.CMD_GOTO,
                                                    TT.CMD_FOR, TT.CMD_KILL,
                                                    TT.CMD_NEW, TT.CMD_READ,
                                                    TT.CMD_QUIT, TT.CMD_XECUTE):
            stmt.expr = self._parse_expr()
        return stmt

    def _parse_merge(self, tok: Token) -> MergeStatement:
        stmt = MergeStatement(line=tok.line, col=tok.col)
        while True:
            dst = self._parse_lvalue()
            if self._cur.match(TT.EQ):
                self._cur.advance()
                src = self._parse_lvalue()
            else:
                src = None
            stmt.assignments.append((dst, src))
            if self._cur.match(TT.COMMA) and self._same_statement():
                self._cur.advance()
            else:
                break
        return stmt

    # ── Expression parser ─────────────────────────────────────────────────────

    # MUMPS operator precedence (left-to-right, no traditional precedence):
    # MUMPS evaluates strictly left-to-right unless parentheses are used.
    # We implement this as a straightforward left-to-right fold.

    def _parse_expr(self) -> Any:
        return self._parse_binary()

    def _parse_binary(self) -> Any:
        left = self._parse_unary()
        while True:
            tok = self._cur.peek()
            if not self._is_binary_op(tok):
                break
            op_tok = self._cur.advance()
            right = self._parse_unary()
            left = BinOp(op=op_tok.value, left=left, right=right,
                         line=op_tok.line, col=op_tok.col)
        return left

    def _is_binary_op(self, tok: Token) -> bool:
        return tok.type in (
            TT.PLUS, TT.MINUS, TT.STAR, TT.SLASH, TT.BACKSLASH, TT.HASH,
            TT.CONCAT, TT.EQ, TT.NEQ, TT.LT, TT.GT, TT.LTE, TT.GTE,
            TT.CONTAINS, TT.FOLLOWS, TT.SORT_AFTER,
            TT.AND, TT.OR, TT.POWER,
        )

    def _parse_unary(self) -> Any:
        tok = self._cur.peek()
        if tok.type == TT.MINUS:
            self._cur.advance()
            return UnaryOp(op='-', operand=self._parse_primary(),
                           line=tok.line, col=tok.col)
        if tok.type == TT.PLUS:
            self._cur.advance()
            return UnaryOp(op='+', operand=self._parse_primary(),
                           line=tok.line, col=tok.col)
        if tok.type == TT.NOT:
            self._cur.advance()
            return UnaryOp(op="'", operand=self._parse_primary(),
                           line=tok.line, col=tok.col)
        return self._parse_primary()

    def _parse_primary(self) -> Any:
        tok = self._cur.peek()

        # Parenthesised expression
        if tok.type == TT.LPAREN:
            self._cur.advance()
            inner = self._parse_expr()
            if self._cur.match(TT.RPAREN):
                self._cur.advance()
            return inner

        # String literal
        if tok.type == TT.STR_LIT:
            self._cur.advance()
            return StringLiteral(value=tok.value, line=tok.line, col=tok.col)

        # Number literal
        if tok.type in (TT.INT_LIT, TT.FLOAT_LIT):
            self._cur.advance()
            return NumberLiteral(value=tok.value, line=tok.line, col=tok.col)

        # Global variable (may have subscripts)
        if tok.type == TT.GLOBAL_VAR:
            return self._parse_global_ref()

        # Special variable
        if tok.type == TT.SPECIAL_VAR:
            self._cur.advance()
            return SpecialVar(name=tok.value, line=tok.line, col=tok.col)

        # Intrinsic function
        if tok.type == TT.INTRINSIC:
            return self._parse_intrinsic()

        # Indirection
        if tok.type == TT.AT:
            self._cur.advance()
            expr = self._parse_primary()
            return Indirection(expr=expr, line=tok.line, col=tok.col)

        # Extrinsic function: $$label[^routine](args)
        if tok.type == TT.DOLLAR:
            saved = self._cur.save()
            self._cur.advance()
            if self._cur.match(TT.DOLLAR):
                self._cur.advance()
                # $$label
                call_ref = self._parse_routine_ref()
                args = []
                if self._cur.match(TT.LPAREN):
                    self._cur.advance()
                    while not self._cur.match(TT.RPAREN, TT.EOF):
                        args.append(self._parse_expr())
                        if self._cur.match(TT.COMMA):
                            self._cur.advance()
                    if self._cur.match(TT.RPAREN):
                        self._cur.advance()
                return FunctionCall(ref=call_ref, args=args, line=tok.line, col=tok.col)
            else:
                self._cur.restore(saved)
                # fall through to IDENT handling

        # Local variable (identifier) — may have subscripts or be used in expr
        if tok.type in (TT.IDENT, TT.LOCAL_VAR):
            return self._parse_local_ref()

        # Unrecognised primary — return a placeholder
        self._cur.advance()
        return StringLiteral(value=tok.value, line=tok.line, col=tok.col)

    def _parse_lvalue(self) -> Any:
        """Parse an assignable target (local var, global var, indirect)."""
        tok = self._cur.peek()
        if tok.type == TT.GLOBAL_VAR:
            return self._parse_global_ref()
        if tok.type == TT.AT:
            self._cur.advance()
            expr = self._parse_primary()
            return Indirection(expr=expr, line=tok.line, col=tok.col)
        # Local variable
        if tok.type in (TT.IDENT, TT.LOCAL_VAR):
            return self._parse_local_ref()
        # Fallback
        self._cur.advance()
        return LocalVar(name=tok.value, line=tok.line, col=tok.col)

    def _parse_local_ref(self) -> Any:
        """Parse a local variable, possibly with subscripts."""
        tok = self._cur.advance()
        name = tok.value.upper()
        node: Any = LocalVar(name=name, line=tok.line, col=tok.col)
        # Subscripts: var(s1, s2, ...)
        if self._cur.match(TT.LPAREN) and self._same_statement():
            self._cur.advance()
            subs = []
            while not self._cur.match(TT.RPAREN, TT.EOF):
                subs.append(self._parse_expr())
                if self._cur.match(TT.COMMA):
                    self._cur.advance()
            if self._cur.match(TT.RPAREN):
                self._cur.advance()
            node = Subscript(base=node, subscripts=subs, line=tok.line, col=tok.col)
        return node

    def _parse_global_ref(self) -> Any:
        """Parse a global variable reference, possibly with subscripts."""
        tok = self._cur.advance()  # GLOBAL_VAR token
        name = tok.value   # already has ^ prefix
        subs = []
        if self._cur.match(TT.LPAREN) and self._same_statement():
            self._cur.advance()
            while not self._cur.match(TT.RPAREN, TT.EOF):
                subs.append(self._parse_expr())
                if self._cur.match(TT.COMMA):
                    self._cur.advance()
            if self._cur.match(TT.RPAREN):
                self._cur.advance()
        return GlobalVar(name=name, subscripts=subs, line=tok.line, col=tok.col)

    def _parse_intrinsic(self) -> Any:
        """Parse $FUNC(args)."""
        tok = self._cur.advance()   # INTRINSIC token
        func_name = tok.value       # e.g. '$GET'
        args = []
        if self._cur.match(TT.LPAREN):
            self._cur.advance()
            while not self._cur.match(TT.RPAREN, TT.EOF):
                args.append(self._parse_expr())
                if self._cur.match(TT.COMMA):
                    self._cur.advance()
            if self._cur.match(TT.RPAREN):
                self._cur.advance()
        return IntrinsicCall(func=func_name, args=args, line=tok.line, col=tok.col)

    def _parse_routine_ref(self) -> Any:
        """Parse label[^Routine] reference."""
        tok = self._cur.peek()
        label = None
        routine = None
        if tok.type == TT.IDENT:
            label = self._cur.advance().value
        if self._cur.match(TT.CARET):
            self._cur.advance()
            if self._cur.peek().type == TT.IDENT:
                routine = self._cur.advance().value
        if routine:
            return ExtRoutineRef(label=label, routine=routine, line=tok.line, col=tok.col)
        return label or "UNKNOWN"

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _same_statement(self) -> bool:
        """True if the next token is on the same logical line as the current command."""
        cur = self._cur.peek()
        prev_line = self._cur.peek(-1).line if self._cur._pos > 0 else 1
        return cur.line == prev_line and cur.type not in (TT.COMMENT, TT.LABEL, TT.INDENT, TT.EOF)

    def _at_line_end_or_comment(self, cmd_line: int) -> bool:
        nt = self._cur.peek()
        return (nt.line != cmd_line or
                nt.type in (TT.COMMENT, TT.LABEL, TT.INDENT, TT.EOF, TT.NEWLINE))

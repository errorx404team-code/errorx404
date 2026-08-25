"""
MUMPS Lexer — Stage 1 of the transpiler pipeline.

Tokenizes raw MUMPS source into a stream of typed tokens.
The lexer is purely syntactic and contains no domain assumptions.
Every MUMPS language construct is recognized generically.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import List, Optional


class TT(Enum):
    """Token Types — all MUMPS syntactic categories."""
    # Structural
    LABEL       = auto()   # TAG or LABEL at column 0
    INDENT      = auto()   # leading whitespace (marks body lines)
    NEWLINE     = auto()
    EOF         = auto()
    COMMENT     = auto()   # ;...

    # Commands (upper-case canonical form)
    CMD_SET     = auto()
    CMD_KILL    = auto()
    CMD_NEW     = auto()
    CMD_DO      = auto()
    CMD_GOTO    = auto()
    CMD_IF      = auto()
    CMD_ELSE    = auto()
    CMD_FOR     = auto()
    CMD_WRITE   = auto()
    CMD_READ    = auto()
    CMD_QUIT    = auto()
    CMD_XECUTE  = auto()
    CMD_HANG    = auto()
    CMD_JOB     = auto()
    CMD_LOCK    = auto()
    CMD_MERGE   = auto()
    CMD_OPEN    = auto()
    CMD_CLOSE   = auto()
    CMD_USE     = auto()
    CMD_VIEW    = auto()
    CMD_TSTART  = auto()
    CMD_TROLLBACK = auto()
    CMD_TCOMMIT = auto()
    CMD_UNKNOWN = auto()   # unrecognised command — preserved verbatim

    # Literals
    INT_LIT     = auto()   # 123
    FLOAT_LIT   = auto()   # 1.23
    STR_LIT     = auto()   # "hello"

    # Identifiers / variables
    IDENT       = auto()   # plain name
    LOCAL_VAR   = auto()   # local variable name
    GLOBAL_VAR  = auto()   # ^GLOBALNAME or ^GLOBAL(...)
    SPECIAL_VAR = auto()   # $HOROLOG, $JOB, $TEST, $THIS, ...

    # Intrinsic functions
    INTRINSIC   = auto()   # $GET, $LENGTH, $EXTRACT, ...

    # Operators
    EQ = auto()       # =
    NEQ = auto()      # '=
    LT = auto()       # <
    GT = auto()       # >
    LTE = auto()      # '> (not-greater)
    GTE = auto()      # '< (not-less)
    CONTAINS = auto() # [
    FOLLOWS = auto()  # ]
    SORT_AFTER = auto() # ]]
    NOT = auto()       # '
    AND = auto()       # &
    OR  = auto()       # !  (in expression context)
    CONCAT = auto()    # _
    PLUS = auto()
    MINUS = auto()
    STAR = auto()
    SLASH = auto()
    BACKSLASH = auto()  # integer division
    HASH = auto()       # modulo
    POWER = auto()      # **

    # Punctuation
    LPAREN = auto()
    RPAREN = auto()
    COMMA  = auto()
    COLON  = auto()    # postconditional separator
    AT     = auto()    # @ indirection
    CARET  = auto()    # ^ (used in bare references)
    BANG   = auto()    # ! newline write
    HASH_FMT = auto()  # # form feed in WRITE

    # Special WRITE format tokens
    WRITE_NL = auto()  # !
    WRITE_FF = auto()  # #
    WRITE_TAB = auto() # ?N

    # Misc
    SEMICOLON  = auto()
    DOT        = auto()   # . argument pass-by-reference or DO .arg
    DOLLAR     = auto()
    PERCENT    = auto()


# Map from upper-case command abbreviation/full name → TT
_CMD_MAP = {
    "S": TT.CMD_SET,    "SET": TT.CMD_SET,
    "K": TT.CMD_KILL,   "KILL": TT.CMD_KILL,
    "N": TT.CMD_NEW,    "NEW": TT.CMD_NEW,
    "D": TT.CMD_DO,     "DO": TT.CMD_DO,
    "G": TT.CMD_GOTO,   "GOTO": TT.CMD_GOTO,
    "I": TT.CMD_IF,     "IF": TT.CMD_IF,
    "E": TT.CMD_ELSE,   "ELSE": TT.CMD_ELSE,
    "F": TT.CMD_FOR,    "FOR": TT.CMD_FOR,
    "W": TT.CMD_WRITE,  "WRITE": TT.CMD_WRITE,
    "R": TT.CMD_READ,   "READ": TT.CMD_READ,
    "Q": TT.CMD_QUIT,   "QUIT": TT.CMD_QUIT,
    "X": TT.CMD_XECUTE, "XECUTE": TT.CMD_XECUTE,
    "H": TT.CMD_HANG,   "HANG": TT.CMD_HANG,
    "JOB": TT.CMD_JOB,  "J": TT.CMD_JOB,
    "L": TT.CMD_LOCK,   "LOCK": TT.CMD_LOCK,
    "M": TT.CMD_MERGE,  "MERGE": TT.CMD_MERGE,
    "O": TT.CMD_OPEN,   "OPEN": TT.CMD_OPEN,
    "C": TT.CMD_CLOSE,  "CLOSE": TT.CMD_CLOSE,
    "U": TT.CMD_USE,    "USE": TT.CMD_USE,
    "VIEW": TT.CMD_VIEW,
    "TS": TT.CMD_TSTART, "TSTART": TT.CMD_TSTART,
    "TR": TT.CMD_TROLLBACK, "TROLLBACK": TT.CMD_TROLLBACK,
    "TC": TT.CMD_TCOMMIT, "TCOMMIT": TT.CMD_TCOMMIT,
}

# Intrinsic functions (just the root names without $)
_INTRINSIC_NAMES = {
    "GET", "G",
    "LENGTH", "L",
    "EXTRACT", "E",
    "FIND", "F",
    "PIECE", "P",
    "TRANSLATE", "TR",
    "REVERSE", "RE",
    "JUSTIFY", "J",
    "TEXT", "T",
    "SELECT", "S",
    "ORDER", "O",
    "QUERY", "Q",
    "DATA", "D",
    "NEXT", "N",
    "NAME", "NA",
    "NUMBER", "NU",
    "ASCII", "A",
    "CHAR", "C",
    "FNUMBER", "FN",
    "STACK",
    "ECODE", "EC",
    "ESTACK", "ES",
    "ETRAP", "ET",
    "LIST",
    "LISTNEXT",
    "LISTGET",
    "LISTBUILD",
    "LISTLENGTH",
    "LISTFIND",
    "CLASSNAME",
    "ISOBJECT",
    "INUMBER", "IN",
    "RANDOM",
    "BIT",
    "BITCOUNT",
    "BITFIND",
    "REPLACE",
    "MATCH",
}

# Special variables (without $)
_SPECIAL_VARS = {
    "HOROLOG", "H",
    "JOB", "J",
    "TEST", "T",
    "IO",
    "PRINCIPAL",
    "DEVICE", "D",
    "STORAGE", "S",
    "X", "Y",
    "ZA", "ZB",
    "ECODE", "EC",
    "ESTACK", "ES",
    "ETRAP", "ET",
    "STACK",
    "THIS",
    "NAMESPACE",
    "CLASS",
    "ZE", "ZV",
    "ROLES",
    "USERNAME",
    "ZERROR",
    "ZTRAP",
}


@dataclass
class Token:
    type: TT
    value: str
    line: int
    col: int
    raw: str = ""          # original text before normalisation

    def __repr__(self):
        return f"Token({self.type.name}, {self.value!r}, L{self.line}:C{self.col})"


class LexerError(Exception):
    def __init__(self, msg: str, line: int, col: int):
        super().__init__(f"LexerError at L{line}:C{col}: {msg}")
        self.line = line
        self.col = col


class MumpsLexer:
    """
    Tokenises a full MUMPS source file into a flat list of Token objects.

    Design principles:
    - No domain knowledge — works on any MUMPS source regardless of routine name.
    - Preserves all source positions for traceability.
    - Tolerant: unknown constructs emit CMD_UNKNOWN / IDENT tokens rather than crashing.
    """

    def __init__(self, source: str):
        self._source = source
        self._lines: List[str] = source.splitlines()
        self._tokens: List[Token] = []

    def tokenize(self) -> List[Token]:
        """Return the full token stream for the source."""
        for line_no, raw_line in enumerate(self._lines, start=1):
            self._tokenize_line(raw_line, line_no)
        self._tokens.append(Token(TT.EOF, "", len(self._lines) + 1, 0))
        return self._tokens

    # ── Line-level tokenizer ─────────────────────────────────────────────────

    def _tokenize_line(self, raw: str, ln: int) -> None:
        if not raw.strip():
            return  # blank line

        pos = 0
        length = len(raw)

        # ── Determine if this line starts at column 0 (label/tag) ────────────
        is_label_line = len(raw) > 0 and raw[0] not in (' ', '\t', ';')

        if is_label_line:
            # Consume label name (may include parameter list)
            m = re.match(r'^([A-Z0-9%]+)(\([^)]*\))?', raw, re.IGNORECASE)
            if m:
                label_name = m.group(1).upper()
                params_str = m.group(2) or ""
                raw_label = m.group(0)
                self._tokens.append(Token(TT.LABEL, label_name + params_str.upper(),
                                          ln, 0, raw_label))
                pos = m.end()
        else:
            # Indented line — emit INDENT token
            indent_m = re.match(r'^[ \t]+', raw)
            if indent_m:
                self._tokens.append(Token(TT.INDENT, indent_m.group(), ln, 0, indent_m.group()))
                pos = indent_m.end()

        # ── Rest of line ─────────────────────────────────────────────────────
        while pos < length:
            ch = raw[pos]

            # Comment
            if ch == ';':
                comment_text = raw[pos:]
                self._tokens.append(Token(TT.COMMENT, comment_text, ln, pos, comment_text))
                return  # rest of line is comment

            # Whitespace between tokens — skip (MUMPS uses space as command separator)
            if ch == ' ' or ch == '\t':
                pos += 1
                continue

            # String literal
            if ch == '"':
                tok, adv = self._lex_string(raw, pos, ln)
                self._tokens.append(tok)
                pos += adv
                continue

            # Number
            if ch.isdigit() or (ch == '.' and pos + 1 < length and raw[pos + 1].isdigit()):
                tok, adv = self._lex_number(raw, pos, ln)
                self._tokens.append(tok)
                pos += adv
                continue

            # Global variable or CARET
            if ch == '^':
                tok, adv = self._lex_global(raw, pos, ln)
                self._tokens.append(tok)
                pos += adv
                continue

            # Special variable or intrinsic function
            if ch == '$':
                tok, adv = self._lex_dollar(raw, pos, ln)
                self._tokens.append(tok)
                pos += adv
                continue

            # Identifier or command
            if ch.isalpha() or ch == '%':
                tok, adv = self._lex_ident_or_cmd(raw, pos, ln, is_first=(pos == (len(raw) - len(raw.lstrip()))))
                self._tokens.append(tok)
                pos += adv
                continue

            # Operators and punctuation
            tok, adv = self._lex_operator(raw, pos, ln)
            if tok:
                self._tokens.append(tok)
                pos += adv
                continue

            # Fallback — emit as IDENT to be tolerant
            self._tokens.append(Token(TT.IDENT, ch, ln, pos, ch))
            pos += 1

    # ── Sub-lexers ────────────────────────────────────────────────────────────

    def _lex_string(self, src: str, pos: int, ln: int):
        """Lex a quoted string, handling doubled-quote escapes."""
        start = pos
        pos += 1  # skip opening "
        buf = []
        while pos < len(src):
            ch = src[pos]
            if ch == '"':
                if pos + 1 < len(src) and src[pos + 1] == '"':
                    buf.append('"')
                    pos += 2
                else:
                    pos += 1  # closing quote
                    break
            else:
                buf.append(ch)
                pos += 1
        value = "".join(buf)
        raw = src[start:pos]
        return Token(TT.STR_LIT, value, ln, start, raw), pos - start

    def _lex_number(self, src: str, pos: int, ln: int):
        """Lex integer or float literal."""
        m = re.match(r'\d+(\.\d+)?([Ee][+-]?\d+)?', src[pos:])
        raw = m.group()
        tt = TT.FLOAT_LIT if ('.' in raw or 'E' in raw.upper()) else TT.INT_LIT
        return Token(tt, raw, ln, pos, raw), len(raw)

    def _lex_global(self, src: str, pos: int, ln: int):
        """Lex a global variable reference like ^DPT or ^DPT(X,...)."""
        start = pos
        pos += 1  # skip ^
        m = re.match(r'[A-Z0-9%]+', src[pos:], re.IGNORECASE)
        if not m:
            return Token(TT.CARET, '^', ln, start, '^'), 1
        name = m.group().upper()
        pos += len(name)
        # Include subscript if present (we keep the whole thing as one token value)
        raw = src[start:pos]
        return Token(TT.GLOBAL_VAR, '^' + name, ln, start, raw), pos - start

    def _lex_dollar(self, src: str, pos: int, ln: int):
        """Lex $SPECIAL or $INTRINSIC."""
        start = pos
        pos += 1  # skip $
        # $$ is an object method call — handle simply
        if pos < len(src) and src[pos] == '$':
            pos += 1
        m = re.match(r'[A-Z]+', src[pos:], re.IGNORECASE)
        if not m:
            return Token(TT.DOLLAR, '$', ln, start, '$'), 1
        name = m.group().upper()
        pos += len(name)
        raw = src[start:pos]
        if name in _SPECIAL_VARS:
            return Token(TT.SPECIAL_VAR, '$' + name, ln, start, raw), pos - start
        if name in _INTRINSIC_NAMES:
            return Token(TT.INTRINSIC, '$' + name, ln, start, raw), pos - start
        # Unknown $X — treat as special var (defensive)
        return Token(TT.SPECIAL_VAR, '$' + name, ln, start, raw), pos - start

    def _lex_ident_or_cmd(self, src: str, pos: int, ln: int, is_first: bool):
        """Lex an identifier; classify as command if appropriate.

        MUMPS command-space rule: a keyword is a command only when it is preceded
        by whitespace (or appears at the very start of a line body) AND followed by
        a space, tab, or colon (postconditional).  Crucially, a token at end-of-line
        that is NOT preceded by whitespace is an identifier, not a command — this
        prevents single-letter variables like D, I, G at the end of an expression
        (e.g. W*D, X+I) from being misclassified as commands.
        """
        m = re.match(r'[A-Z0-9%]+', src[pos:], re.IGNORECASE)
        raw = m.group()
        name_upper = raw.upper()
        adv = len(raw)

        # Only consider command classification if preceded by whitespace
        # (or at position 0 of the command area).
        preceded_by_space = (pos == 0) or (src[pos - 1] in (' ', '\t'))

        if not preceded_by_space:
            # Inside an expression — must be an identifier.
            return Token(TT.IDENT, name_upper, ln, pos, raw), adv

        # Followed by space/tab/colon OR genuinely at end-of-content
        # (argumentless commands: Q, N, E, etc. — but only when preceded by space)
        next_pos = pos + adv
        next_ch = src[next_pos] if next_pos < len(src) else ' '
        followed_by_space = next_ch in (' ', '\t', '\r', '\n')
        followed_by_eol   = next_pos >= len(src)
        followed_by_colon = next_ch == ':'  # postconditional

        if (followed_by_space or followed_by_eol or followed_by_colon) and name_upper in _CMD_MAP:
            return Token(_CMD_MAP[name_upper], name_upper, ln, pos, raw), adv

        return Token(TT.IDENT, name_upper, ln, pos, raw), adv

    def _lex_operator(self, src: str, pos: int, ln: int):
        """Lex operators and punctuation.

        Non-standard but common extensions handled:
          <=  →  LTE  (same semantics as '> in standard MUMPS)
          >=  →  GTE  (same semantics as '< in standard MUMPS)
        These appear in modernised or ported MUMPS source and are treated
        identically to the canonical forms.
        """
        ch = src[pos]
        rest = src[pos:]

        op_map = [
            ("**", TT.POWER),
            ("]]", TT.SORT_AFTER),
            # Standard MUMPS unary/binary NOT forms first
            ("'=", TT.NEQ),
            ("'<", TT.GTE),
            ("'>", TT.LTE),
            ("'", TT.NOT),
            # Non-standard compound operators (must come before bare < and >)
            ("<=", TT.LTE),
            (">=", TT.GTE),
            ("=", TT.EQ),
            ("<", TT.LT),
            (">", TT.GT),
            ("[", TT.CONTAINS),
            ("]", TT.FOLLOWS),
            ("&", TT.AND),
            ("!", TT.OR),       # in expression context; WRITE ! handled by parser
            ("_", TT.CONCAT),
            ("+", TT.PLUS),
            ("-", TT.MINUS),
            ("*", TT.STAR),
            ("/", TT.SLASH),
            ("\\", TT.BACKSLASH),
            ("#", TT.HASH),
            ("(", TT.LPAREN),
            (")", TT.RPAREN),
            (",", TT.COMMA),
            (":", TT.COLON),
            ("@", TT.AT),
            (".", TT.DOT),
        ]

        for sym, tt in op_map:
            if rest.startswith(sym):
                return Token(tt, sym, ln, pos, sym), len(sym)

        return None, 1  # unknown — consumed by caller

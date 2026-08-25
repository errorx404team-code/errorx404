"""
MUMPS-to-Python Code Generator — Stage 4 of the transpiler pipeline.

Converts a SemanticModel (derived from the AST) into Python source code.

Design principles:
- Source-driven: every Python statement traces to a MUMPS source line.
- No domain knowledge: works identically for any MUMPS routine name/content.
- Architecture is chosen from semantics, not assumed:
    * Routines with only simple labels → module-level functions.
    * Routines needing dynamic scope → MumpsContext-based functions.
    * Global variable usage → GlobalRepository abstraction.
- Produces a complete, syntactically valid Python module.
- Unresolvable constructs emit # REVIEW_REQUIRED comments rather than
  silently inventing behaviour.
"""

from __future__ import annotations
import textwrap
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from .ast_nodes import (
    Routine, LabelBlock, MumpsLine,
    SetStatement, KillStatement, NewStatement,
    DoStatement, DoArg, GotoStatement, GotoArg,
    IfStatement, ElseStatement, ForStatement, ForRange,
    WriteStatement, WriteArg, ReadStatement, ReadArg,
    QuitStatement, XecuteStatement, HangStatement,
    MergeStatement, UnknownStatement,
    LocalVar, GlobalVar, SpecialVar, IntrinsicCall,
    Subscript, BinOp, UnaryOp, StringLiteral, NumberLiteral,
    Indirection, FunctionCall, ExtRoutineRef, Node,
)
from .semantic_analyzer import SemanticModel, LabelInfo


# ── Output types ──────────────────────────────────────────────────────────────

@dataclass
class GeneratedModule:
    """Result of code generation for one MUMPS routine."""
    python_source: str = ""
    traceability: List[tuple] = field(default_factory=list)  # [(py_lineno, mumps_line, note)]
    review_required: List[str] = field(default_factory=list)
    unresolved_deps: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    uses_runtime: bool = False
    uses_global_repo: bool = False
    architecture: str = "functions"   # "functions" | "context" | "mixed"


# ── Code generator ────────────────────────────────────────────────────────────

_INDENT = "    "


class CodeGenerator:
    """
    Traverses the SemanticModel and AST simultaneously to emit Python.

    The generator makes architectural decisions based purely on the semantic
    analysis results — never on routine/variable names.
    """

    def __init__(self, model: SemanticModel,
                 source_language: str = "MUMPS",
                 traceability_header: str = ""):
        self._model = model
        self._ast: Routine = model.ast
        self._source_language = source_language
        self._traceability_header = traceability_header

        # Output state
        self._lines: List[str] = []
        self._trace: List[tuple] = []     # (py_line, mumps_line, note)
        self._review: List[str] = []
        self._warnings: List[str] = []
        self._unresolved_deps: List[str] = []

        # Per-function generation state
        self._indent_level: int = 1       # inside a function body
        self._current_label: Optional[str] = None
        self._current_label_params: List[str] = []
        self._use_ctx: bool = False        # are we generating ctx-based code?
        self._in_for_loop: bool = False
        self._for_quit_var: Optional[str] = None  # loop var for conditional QUIT
        self._if_test_needed: bool = False  # did we just emit an IF (sets $TEST)?

        # Architecture decision
        self._arch = self._decide_architecture()

    # ── Architecture decision ─────────────────────────────────────────────────

    def _decide_architecture(self) -> str:
        """
        Choose the Python architecture based purely on semantic analysis:
        - If routine uses global variables → add GlobalRepository
        - If routine uses NEW/dynamic scope → use MumpsContext per function
        - Otherwise → plain module-level functions
        """
        if self._model.needs_scope_context:
            return "context"
        return "functions"

    # ── Top-level generation ──────────────────────────────────────────────────

    def generate(self) -> GeneratedModule:
        self._emit_file_header()
        self._emit_imports()

        if self._model.globals:
            self._emit_global_repository()

        self._emit_label_functions()

        result = GeneratedModule(
            python_source="\n".join(self._lines),
            traceability=self._trace,
            review_required=self._review,
            unresolved_deps=self._unresolved_deps,
            warnings=self._warnings + self._model.warnings,
            uses_runtime=self._arch == "context",
            uses_global_repo=bool(self._model.globals),
            architecture=self._arch,
        )
        return result

    # ── File header ───────────────────────────────────────────────────────────

    def _emit_file_header(self):
        if self._traceability_header:
            for line in self._traceability_header.splitlines():
                self._raw(f"# {line}" if not line.startswith("#") else line)
        self._raw(f'"""')
        self._raw(f'Python equivalent of MUMPS routine: {self._model.routine_name}')
        self._raw(f'Source language: {self._source_language}')
        self._raw(f'Architecture: {self._decide_architecture()}')
        if self._model.globals:
            gnames = ", ".join(self._model.globals.keys())
            self._raw(f'Globals accessed: {gnames}')
        if self._model.external_calls:
            ext = sorted({(e.label or '') + '^' + e.routine for e in self._model.external_calls})
            self._raw(f'External dependencies: {", ".join(ext)}')
        self._raw(f'')
        self._raw(f'Generated by MUMPS Transpiler - source-driven, semantics-based conversion.')
        self._raw(f'Every function traces to a MUMPS label. Every variable name is preserved.')
        self._raw(f'"""')
        self._raw("")

    def _emit_imports(self):
        self._raw("from __future__ import annotations")
        self._raw("from typing import Any, Optional, Union")
        if self._arch == "context":
            self._raw("from app.pipeline.mumps_transpiler.runtime import (")
            self._raw("    MumpsContext, mumps_truth, mumps_numeric, mumps_get,")
            self._raw("    mumps_length, mumps_extract, mumps_piece, mumps_find,")
            self._raw("    mumps_translate, mumps_justify, mumps_reverse,")
            self._raw("    mumps_ascii, mumps_char, mumps_select, mumps_order,")
            self._raw("    mumps_random, mumps_fnumber, mumps_horolog_now,")
            self._raw("    mumps_concat, mumps_not, mumps_and, mumps_or,")
            self._raw("    mumps_contains, mumps_follows, mumps_pattern_match,")
            self._raw(")")
        else:
            self._raw("from app.pipeline.mumps_transpiler.runtime import (")
            self._raw("    mumps_truth, mumps_numeric, mumps_get,")
            self._raw("    mumps_length, mumps_extract, mumps_piece, mumps_find,")
            self._raw("    mumps_translate, mumps_justify, mumps_reverse,")
            self._raw("    mumps_ascii, mumps_char, mumps_select, mumps_order,")
            self._raw("    mumps_random, mumps_fnumber, mumps_horolog_now,")
            self._raw("    mumps_concat, mumps_not, mumps_and, mumps_or,")
            self._raw("    mumps_contains, mumps_follows, mumps_pattern_match,")
            self._raw(")")
        # External dependencies
        for ext in sorted({e.routine for e in self._model.external_calls if e.routine}):
            self._unresolved_deps.append(ext)
            self._raw(f"# REVIEW_REQUIRED: external dependency '{ext}' — resolve import manually")
            self._raw(f"# from {ext.lower()} import *  # uncomment after resolving")
        self._raw("")

    # ── Global repository ─────────────────────────────────────────────────────

    def _emit_global_repository(self):
        self._raw("")
        self._raw("# ── Global Variable Repository ────────────────────────────────────────────────")
        self._raw("# MUMPS globals are simulated as a nested dict structure.")
        self._raw("# In production, replace with actual database/ORM layer.")
        self._raw("")
        self._raw("class GlobalRepository:")
        self._raw('    """')
        self._raw(f'    Repository for MUMPS global variables accessed by {self._model.routine_name}.')
        for gname, ginfo in self._model.globals.items():
            mode = []
            if ginfo.is_read: mode.append("read")
            if ginfo.is_written: mode.append("write")
            self._raw(f'    {gname}: {"/".join(mode) or "accessed"}')
        self._raw('    """')
        self._raw("")
        self._raw("    def __init__(self, store: Optional[dict] = None):")
        for gname in self._model.globals:
            safe = self._global_attr(gname)
            self._raw(f"        self.{safe}: dict = store.get({gname!r}, {{}}) if store else {{}}")
        self._raw("")
        for gname, ginfo in self._model.globals.items():
            safe = self._global_attr(gname)
            # get method
            self._raw(f"    def get_{safe}(self, *subscripts: Any, default: Any = '') -> Any:")
            self._raw(f'        """Read {gname}(subscripts...) — returns default if undefined."""')
            self._raw(f"        node = self.{safe}")
            self._raw(f"        for s in subscripts:")
            self._raw(f"            if not isinstance(node, dict): return default")
            self._raw(f"            node = node.get(s, None)")
            self._raw(f"            if node is None: return default")
            self._raw(f"        return node if node is not None else default")
            self._raw("")
            if ginfo.is_written:
                # set method
                self._raw(f"    def set_{safe}(self, *subscripts_and_value: Any) -> None:")
                self._raw(f'        """Write {gname}(subscripts...)=value."""')
                self._raw(f"        if not subscripts_and_value: return")
                self._raw(f"        *subs, value = subscripts_and_value")
                self._raw(f"        if not subs:")
                self._raw(f"            self.{safe} = value; return")
                self._raw(f"        node = self.{safe}")
                self._raw(f"        if not isinstance(node, dict): self.{safe} = {{}}; node = self.{safe}")
                self._raw(f"        for s in subs[:-1]:")
                self._raw(f"            node = node.setdefault(s, {{}})")
                self._raw(f"        node[subs[-1]] = value")
                self._raw("")

        self._raw(f"_globals = GlobalRepository()")
        self._raw("")

    def _global_attr(self, gname: str) -> str:
        """Convert ^DPT → dpt, ^PS(55) → ps55 for use as Python attribute."""
        return gname.lstrip("^").split("(")[0].lower().replace("%", "pct")

    # ── Label functions ───────────────────────────────────────────────────────

    def _emit_label_functions(self):
        self._raw("")
        self._raw("# ── Label Functions ───────────────────────────────────────────────────────────")

        for lb in self._ast.labels:
            li = self._model.label_map.get(lb.name)
            if li is None:
                continue
            self._emit_label_function(lb, li)

        # Emit a __main__ guard that calls the first label
        if self._ast.labels:
            first = self._ast.labels[0]
            self._raw("")
            self._raw("")
            self._raw("if __name__ == '__main__':")
            py_name = self._py_func_name(first.name)
            if first.params:
                args_comment = ", ".join(first.params)
                self._raw(f"    # Call: {py_name}({args_comment})")
                self._raw(f"    # REVIEW_REQUIRED: supply appropriate arguments for {first.name}")
                self._raw(f"    pass")
            else:
                self._raw(f"    {py_name}()")

    def _emit_label_function(self, lb: LabelBlock, li: LabelInfo):
        """Emit a single Python function for a MUMPS label."""
        py_name = self._py_func_name(lb.name)
        self._current_label = lb.name
        self._current_label_params = lb.params[:]
        self._use_ctx = (self._arch == "context")
        self._in_for_loop = False
        self._indent_level = 1

        # ── Function signature ────────────────────────────────────────────────
        self._raw("")
        self._raw("")
        # Traceability comment
        self._raw(f"# MUMPS label: {lb.name}"
                  + (f"({', '.join(lb.params)})" if lb.params else ""))

        params = list(lb.params)
        if self._use_ctx:
            params_str = "ctx: MumpsContext" + (
                (", " + ", ".join(f"{self._py_var(p)}: Any" for p in params)) if params else "")
        else:
            params_str = ", ".join(f"{self._py_var(p)}: Any" for p in params)

        ret_hint = " -> Any" if li.quit_with_value else " -> None"
        self._raw(f"def {py_name}({params_str}){ret_hint}:")

        # Docstring
        self._indent_level = 1
        doc_lines = [f'    """']
        doc_lines.append(f'    Converted from MUMPS label: {lb.name}')
        if lb.params:
            doc_lines.append(f'    Parameters: {", ".join(lb.params)}')
        if li.calls_labels:
            doc_lines.append(f'    Calls: {", ".join(sorted(li.calls_labels))}')
        if li.calls_external:
            doc_lines.append(f'    External calls: {", ".join(sorted(li.calls_external))}')
        doc_lines.append(f'    """')
        for dl in doc_lines:
            self._raw(dl)

        # Context setup if needed
        if self._use_ctx and not any(isinstance(s, (SetStatement, ReadStatement))
                                      for ml in lb.lines for s in ml.statements):
            pass   # minimal ctx
        elif self._use_ctx and not any(p for p in lb.params):
            self._emit_line("ctx = ctx or MumpsContext()", lb.line if lb.lines else 1)

        # Parameters → local variables (in non-ctx mode they're already fn params)
        if not self._use_ctx:
            pass  # params handled by signature

        # ── Body ─────────────────────────────────────────────────────────────
        # Collect lines and detect if we need GOTO simulation
        goto_targets = li.goto_targets.intersection(
            {l.name for l in self._ast.labels})
        needs_goto_sim = bool(goto_targets)

        if needs_goto_sim:
            self._emit_goto_state_machine(lb, li)
        else:
            self._emit_body_lines(lb.lines, lb)

        # Ensure function has at least a pass
        # (Check if anything was emitted in the body)
        body_start = len(self._lines)
        if not any(l.startswith(_INDENT) for l in self._lines[-(len(lb.lines)+10):]):
            self._emit_line("pass", lb.line)

        self._current_label = None

    # ── GOTO state machine ────────────────────────────────────────────────────

    def _emit_goto_state_machine(self, lb: LabelBlock, li: LabelInfo):
        """
        When a label body uses GOTO to jump to other labels within the routine,
        we emit a state-machine loop rather than deleting the control flow.
        """
        self._raw(f"{_INDENT}# GOTO state machine — preserves MUMPS control flow")
        self._raw(f"{_INDENT}_state = '{lb.name}'")
        self._raw(f"{_INDENT}while True:")
        self._indent_level = 2

        # Emit the current label's body
        self._raw(f"{_INDENT * 2}if _state == '{lb.name}':")
        self._indent_level = 3
        self._emit_body_lines(lb.lines, lb, in_state_machine=True)
        self._raw(f"{_INDENT * 3}break")

        # Emit target label bodies
        for tgt in sorted(li.goto_targets):
            tgt_lb = next((l for l in self._ast.labels if l.name == tgt), None)
            if tgt_lb is None:
                self._raw(f"{_INDENT * 2}elif _state == '{tgt}':")
                self._raw(f"{_INDENT * 3}# REVIEW_REQUIRED: GOTO target '{tgt}' not found in this routine")
                self._raw(f"{_INDENT * 3}break")
                continue
            self._raw(f"{_INDENT * 2}elif _state == '{tgt}':")
            self._indent_level = 3
            self._emit_body_lines(tgt_lb.lines, tgt_lb, in_state_machine=True)
            self._raw(f"{_INDENT * 3}break")

        self._raw(f"{_INDENT * 2}else:")
        self._raw(f"{_INDENT * 3}break")
        self._indent_level = 1

    # ── Body line emission ────────────────────────────────────────────────────

    def _emit_body_lines(self, lines: List[MumpsLine], lb: LabelBlock,
                          in_state_machine: bool = False,
                          base_indent: int = 1):
        """Emit a sequence of MumpsLine nodes."""
        self._indent_level = base_indent if not in_state_machine else 3

        # Pre-scan: find IF/ELSE pairs and FOR loops
        # We emit them as proper Python if/else/for structures
        i = 0
        while i < len(lines):
            mline = lines[i]
            self._emit_mline(mline, in_state_machine=in_state_machine)
            i += 1

        # If the label has no explicit QUIT/return, add implicit return
        if lines and not in_state_machine:
            last_stmts = lines[-1].statements if lines else []
            has_quit = any(isinstance(s, QuitStatement) for s in last_stmts)
            if not has_quit:
                li = self._model.label_map.get(lb.name)
                if li and not li.quit_with_value:
                    pass   # Python functions implicitly return None — no emit needed

    def _emit_mline(self, mline: MumpsLine, in_state_machine: bool = False):
        """
        Emit Python for a single MumpsLine.

        MUMPS allows multiple commands on one line. When IF appears, all subsequent
        commands on the same line are the body of the IF (they execute conditionally).
        Similarly, ELSE followed by commands means those commands are the ELSE body.

        We detect this pattern and emit the body commands inside the if/else block.
        """
        ind = _INDENT * self._indent_level
        stmts = mline.statements
        i = 0
        while i < len(stmts):
            stmt = stmts[i]
            self._trace.append((len(self._lines) + 1, mline.line, type(stmt).__name__))

            if isinstance(stmt, IfStatement):
                # Emit the IF condition line
                self._emit_if_with_body(stmt, stmts[i+1:], ind, mline.line, in_state_machine)
                break  # all remaining stmts consumed as IF body
            elif isinstance(stmt, ElseStatement):
                # Emit ELSE with subsequent stmts as body
                self._emit_else_with_body(stmts[i+1:], ind, mline.line, in_state_machine)
                break
            else:
                self._emit_stmt(stmt, mline.line, in_state_machine=in_state_machine)
            i += 1

    def _emit_if_with_body(self, if_stmt: IfStatement, body_stmts: list,
                            ind: str, src_line: int, in_state_machine: bool):
        """Emit IF condition + body (subsequent same-line statements)."""
        if not if_stmt.conditions:
            cond_str = "ctx.test" if self._use_ctx else "_test"
            self._raw(f"{ind}if {cond_str}:  # IF (no args) - tests $TEST at L{src_line}")
        else:
            parts = [f"mumps_truth({self._emit_expr(c)})" for c in if_stmt.conditions]
            cond_str = " and ".join(parts)
            self._raw(f"{ind}if {cond_str}:  # IF L{src_line}")

        inner_ind = ind + _INDENT
        if self._use_ctx:
            self._raw(f"{inner_ind}ctx.test = 1")
        if body_stmts:
            old_level = self._indent_level
            self._indent_level += 1
            for s in body_stmts:
                self._emit_stmt(s, src_line, in_state_machine=in_state_machine)
            self._indent_level = old_level
        elif not self._use_ctx:
            self._raw(f"{inner_ind}pass")

    def _emit_else_with_body(self, body_stmts: list, ind: str, src_line: int,
                              in_state_machine: bool):
        """Emit ELSE + body (subsequent same-line statements)."""
        self._raw(f"{ind}else:  # ELSE - $TEST was false at L{src_line}")
        inner_ind = ind + _INDENT
        if self._use_ctx:
            self._raw(f"{inner_ind}ctx.test = 0")
        if body_stmts:
            old_level = self._indent_level
            self._indent_level += 1
            for s in body_stmts:
                self._emit_stmt(s, src_line, in_state_machine=in_state_machine)
            self._indent_level = old_level
        else:
            self._raw(f"{inner_ind}pass")

    # ── Statement emitters ────────────────────────────────────────────────────

    def _emit_stmt(self, stmt: Any, src_line: int, in_state_machine: bool = False):
        ind = _INDENT * self._indent_level

        if isinstance(stmt, SetStatement):
            self._emit_set(stmt, ind, src_line)

        elif isinstance(stmt, KillStatement):
            self._emit_kill(stmt, ind, src_line)

        elif isinstance(stmt, NewStatement):
            self._emit_new(stmt, ind, src_line)

        elif isinstance(stmt, DoStatement):
            self._emit_do(stmt, ind, src_line)

        elif isinstance(stmt, GotoStatement):
            self._emit_goto(stmt, ind, src_line, in_state_machine)

        elif isinstance(stmt, IfStatement):
            self._emit_if(stmt, ind, src_line)

        elif isinstance(stmt, ElseStatement):
            self._emit_else(ind, src_line)

        elif isinstance(stmt, ForStatement):
            self._emit_for(stmt, ind, src_line)

        elif isinstance(stmt, WriteStatement):
            self._emit_write(stmt, ind, src_line)

        elif isinstance(stmt, ReadStatement):
            self._emit_read(stmt, ind, src_line)

        elif isinstance(stmt, QuitStatement):
            self._emit_quit(stmt, ind, src_line, in_state_machine)

        elif isinstance(stmt, XecuteStatement):
            self._emit_xecute(stmt, ind, src_line)

        elif isinstance(stmt, HangStatement):
            expr = self._emit_expr(stmt.expr) if stmt.expr else "0"
            cond = self._emit_postcond_guard(stmt.postcond, ind)
            if cond:
                self._raw(f"{ind}if {cond}:")
                self._raw(f"{ind}{_INDENT}import time; time.sleep(float({expr}))")
            else:
                self._raw(f"{ind}import time; time.sleep(float({expr}))")

        elif isinstance(stmt, MergeStatement):
            for dst, src in stmt.assignments:
                src_e = self._emit_expr(src) if src else "None"
                # MERGE dst=src: use the correct setter for global lvalues
                if isinstance(dst, GlobalVar):
                    attr = self._global_attr(dst.name)
                    if dst.subscripts:
                        subs = ", ".join(self._emit_expr(s) for s in dst.subscripts)
                        merge_stmt = f"_globals.set_{attr}({subs}, {src_e})  # MERGE"
                    else:
                        merge_stmt = f"_globals.{attr} = {src_e}  # MERGE"
                elif isinstance(dst, Subscript) and isinstance(dst.base, GlobalVar):
                    attr = self._global_attr(dst.base.name)
                    subs = ", ".join(self._emit_expr(s) for s in dst.subscripts)
                    merge_stmt = f"_globals.set_{attr}({subs}, {src_e})  # MERGE"
                else:
                    dst_e = self._emit_lvalue(dst)
                    merge_stmt = f"{dst_e} = {src_e}  # MUMPS MERGE"
                self._emit_with_postcond(stmt.postcond, merge_stmt, ind, src_line)

        elif isinstance(stmt, UnknownStatement):
            self._raw(f"{ind}# REVIEW_REQUIRED: unrecognised MUMPS construct at L{src_line}: {stmt.raw_text!r}")
            self._review.append(f"L{src_line}: {stmt.raw_text!r}")

    def _emit_set(self, stmt: SetStatement, ind: str, src_line: int):
        """Emit SET assignments with optional postconditional."""
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None
        if cond:
            self._raw(f"{ind}if {cond}:  # postconditional from L{src_line}")
            inner_ind = ind + _INDENT
        else:
            inner_ind = ind

        for lval, rval in stmt.assignments:
            rval_e = self._emit_expr(rval) if rval is not None else "None"
            # Use _emit_set_lvalue to generate correct assignment form
            line_str = self._emit_set_lvalue(lval, rval_e, inner_ind, src_line)
            self._raw(line_str)

    def _emit_kill(self, stmt: KillStatement, ind: str, src_line: int):
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None
        if cond:
            self._raw(f"{ind}if {cond}:")
            inner_ind = ind + _INDENT
        else:
            inner_ind = ind

        if not stmt.targets:
            # Argumentless KILL
            if self._use_ctx:
                self._raw(f"{inner_ind}ctx.kill_all()  # KILL (all locals)")
            else:
                self._raw(f"{inner_ind}# REVIEW_REQUIRED: argumentless KILL - cannot safely delete all locals in Python")
            return

        for t in stmt.targets:
            if isinstance(t, GlobalVar):
                # KILL ^GLOBAL → reset to empty store
                attr = self._global_attr(t.name)
                if t.subscripts:
                    subs = ", ".join(self._emit_expr(s) for s in t.subscripts)
                    self._raw(f"{inner_ind}_globals.{attr}.pop(({subs}), None)  # KILL {t.name}")
                else:
                    self._raw(f"{inner_ind}_globals.{attr} = {{}}  # KILL {t.name}")
            elif isinstance(t, Subscript) and isinstance(t.base, GlobalVar):
                attr = self._global_attr(t.base.name)
                subs = ", ".join(self._emit_expr(s) for s in t.subscripts)
                self._raw(f"{inner_ind}_globals.{attr}.pop(({subs}), None)  # KILL subscripted")
            elif self._use_ctx and isinstance(t, LocalVar):
                self._raw(f"{inner_ind}ctx.kill({t.name!r})  # KILL {t.name}")
            else:
                te = self._py_var(t.name) if isinstance(t, LocalVar) else self._emit_expr(t)
                self._raw(f"{inner_ind}{te} = None  # KILL {te} L{src_line}")

    def _emit_new(self, stmt: NewStatement, ind: str, src_line: int):
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None
        if cond:
            self._raw(f"{ind}if {cond}:")
            inner_ind = ind + _INDENT
        else:
            inner_ind = ind

        if not stmt.vars:
            if self._use_ctx:
                self._raw(f"{inner_ind}ctx.new_all()  # NEW (all locals)")
            else:
                self._raw(f"{inner_ind}# REVIEW_REQUIRED: argumentless NEW — saves all local variables")
            return

        if self._use_ctx:
            vars_repr = ", ".join(repr(v) for v in stmt.vars)
            excl = " (exclusive)" if stmt.exclusive else ""
            self._raw(f"{inner_ind}ctx.new({vars_repr})  # NEW{excl} {', '.join(stmt.vars)} L{src_line}")
        else:
            for v in stmt.vars:
                pv = self._py_var(v)
                self._raw(f"{inner_ind}{pv} = None  # NEW {v} — saves previous value; here initialised to None")
                self._review.append(f"L{src_line}: NEW {v} — dynamic scope not fully modelled without MumpsContext")

    def _emit_do(self, stmt: DoStatement, ind: str, src_line: int):
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None
        if cond:
            self._raw(f"{ind}if {cond}:  # DO postconditional L{src_line}")
            inner_ind = ind + _INDENT
        else:
            inner_ind = ind

        if stmt.argumentless:
            self._raw(f"{inner_ind}# REVIEW_REQUIRED: argumentless DO — executes next indented block")
            return

        for arg in stmt.calls:
            if arg.routine:
                # External call
                label_part = arg.label or ""
                func_ref = f"{arg.routine.lower()}.{self._py_func_name(label_part)}" if label_part else f"{arg.routine.lower()}.main"
                args_e = self._emit_call_args(arg)
                self._raw(f"{inner_ind}# REVIEW_REQUIRED: external call DO {label_part}^{arg.routine}")
                self._raw(f"{inner_ind}{func_ref}({args_e})  # resolve import above")
            else:
                # Internal label call
                label = arg.label or ""
                py_func = self._py_func_name(label)
                args_e = self._emit_call_args(arg)
                if self._use_ctx:
                    if args_e:
                        self._raw(f"{inner_ind}{py_func}(ctx, {args_e})  # DO {label}")
                    else:
                        self._raw(f"{inner_ind}{py_func}(ctx)  # DO {label}")
                else:
                    self._raw(f"{inner_ind}{py_func}({args_e})  # DO {label}")

    def _emit_call_args(self, arg: DoArg) -> str:
        parts = []
        for i, a in enumerate(arg.args):
            by_ref = arg.by_ref_flags[i] if i < len(arg.by_ref_flags) else False
            expr_s = self._emit_expr(a)
            if by_ref:
                parts.append(f"{expr_s}  # passed by reference (.)")
            else:
                parts.append(expr_s)
        return ", ".join(parts)

    def _emit_goto(self, stmt: GotoStatement, ind: str, src_line: int,
                   in_state_machine: bool):
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None

        for arg in stmt.calls:
            if arg.routine:
                self._raw(f"{ind}# REVIEW_REQUIRED: cross-routine GOTO {arg.label or ''}^{arg.routine} at L{src_line}")
                self._review.append(f"L{src_line}: GOTO ^{arg.routine}")
                continue
            tgt = arg.label or ""
            if in_state_machine:
                if cond:
                    self._raw(f"{ind}if {cond}:")
                    self._raw(f"{ind}{_INDENT}_state = {tgt!r}  # GOTO {tgt}")
                    self._raw(f"{ind}{_INDENT}continue")
                else:
                    self._raw(f"{ind}_state = {tgt!r}  # GOTO {tgt}")
                    self._raw(f"{ind}continue")
            else:
                # Not in state machine — emit as inline call (best we can do safely)
                py_func = self._py_func_name(tgt)
                if cond:
                    self._raw(f"{ind}if {cond}:")
                    if self._use_ctx:
                        self._raw(f"{ind}{_INDENT}{py_func}(ctx)  # GOTO {tgt} (inlined as call)")
                    else:
                        self._raw(f"{ind}{_INDENT}{py_func}()  # GOTO {tgt} (inlined as call)")
                    self._raw(f"{ind}{_INDENT}return")
                else:
                    if self._use_ctx:
                        self._raw(f"{ind}{py_func}(ctx)  # GOTO {tgt} (inlined as call)")
                    else:
                        self._raw(f"{ind}{py_func}()  # GOTO {tgt} (inlined as call)")
                    self._raw(f"{ind}return")

    def _emit_if(self, stmt: IfStatement, ind: str, src_line: int):
        """
        MUMPS IF: tests conditions, sets $TEST.
        Emits a Python if block.
        The IF block body comes from subsequent same-line statements (in MUMPS,
        everything on the same line after IF runs conditionally). Since our parser
        puts them in the same MumpsLine, they are emitted inside the if block.
        When IF is the last statement on a line, we emit 'pass' as body.
        """
        if not stmt.conditions:
            cond_str = "ctx.test" if self._use_ctx else "_test"
            self._raw(f"{ind}if {cond_str}:  # IF (no args) - tests $TEST")
        else:
            parts = [f"mumps_truth({self._emit_expr(c)})" for c in stmt.conditions]
            cond_str = " and ".join(parts)
            self._raw(f"{ind}if {cond_str}:  # IF L{src_line}")

        # $TEST update — must come as body of the if block
        if self._use_ctx:
            self._raw(f"{ind}{_INDENT}ctx.test = 1")
        else:
            self._raw(f"{ind}{_INDENT}pass  # body: subsequent statements on same line")

    def _emit_else(self, ind: str, src_line: int):
        """MUMPS ELSE — runs when $TEST is false."""
        self._raw(f"{ind}else:  # ELSE - $TEST was false at L{src_line}")
        if self._use_ctx:
            self._raw(f"{ind}{_INDENT}ctx.test = 0")
        else:
            self._raw(f"{ind}{_INDENT}pass  # body: subsequent statements")

    def _emit_for(self, stmt: ForStatement, ind: str, src_line: int):
        """
        Emit MUMPS FOR as Python for/while loop.
        Handles:
          - FOR I=start:step:stop  → for loop with step
          - FOR I=start:step       → while loop (no upper bound)
          - FOR I=val1,val2,...    → multiple ranges
          - Argumentless FOR       → infinite loop (broken by QUIT)
        """
        if stmt.argumentless:
            self._raw(f"{ind}while True:  # FOR (argumentless - loop broken by QUIT) L{src_line}")
            self._raw(f"{ind}{_INDENT}pass  # REVIEW_REQUIRED: loop body not structurally inlined")
            return

        var = self._py_var(stmt.var) if stmt.var else "_for_idx"

        if len(stmt.ranges) == 1:
            r = stmt.ranges[0]
            start_e = self._emit_expr(r.start)
            if r.step is not None and r.stop is not None:
                step_e = self._emit_expr(r.step)
                stop_e = self._emit_expr(r.stop)
                self._raw(f"{ind}# FOR {stmt.var}={start_e}:{step_e}:{stop_e}")
                self._raw(f"{ind}_for_start = mumps_numeric({start_e})")
                self._raw(f"{ind}_for_step  = mumps_numeric({step_e})")
                self._raw(f"{ind}_for_stop  = mumps_numeric({stop_e})")
                self._raw(f"{ind}{var} = _for_start")
                self._raw(f"{ind}while (_for_step >= 0 and {var} <= _for_stop) or (_for_step < 0 and {var} >= _for_stop):")
                self._raw(f"{ind}{_INDENT}{var} += _for_step  # loop body follows on subsequent MUMPS lines")
            elif r.step is not None:
                step_e = self._emit_expr(r.step)
                self._raw(f"{ind}# FOR {stmt.var}={start_e}:{step_e} (no stop - loop until QUIT)")
                self._raw(f"{ind}_for_start = mumps_numeric({start_e})")
                self._raw(f"{ind}_for_step  = mumps_numeric({step_e})")
                self._raw(f"{ind}{var} = _for_start")
                self._raw(f"{ind}while True:  # broken by QUIT")
                self._raw(f"{ind}{_INDENT}{var} += _for_step  # loop body follows on subsequent MUMPS lines")
            else:
                # Single value iteration
                self._raw(f"{ind}{var} = mumps_numeric({start_e})  # FOR single value")
        else:
            # Multiple ranges: FOR I=1,5,10 or FOR I=1:1:5,10:1:20
            ranges_e = [self._emit_expr(r.start) for r in stmt.ranges]
            self._raw(f"{ind}for {var} in [{', '.join(ranges_e)}]:  # FOR multi-range L{src_line}")
            self._raw(f"{ind}{_INDENT}pass  # loop body follows on subsequent MUMPS lines")

    def _emit_write(self, stmt: WriteStatement, ind: str, src_line: int):
        """Emit WRITE — preserves all MUMPS output semantics."""
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None
        if cond:
            self._raw(f"{ind}if {cond}:  # WRITE postconditional L{src_line}")
            inner_ind = ind + _INDENT
        else:
            inner_ind = ind

        if not stmt.args:
            return

        parts = []
        for arg in stmt.args:
            if arg.kind == 'newline':
                parts.append("'\\n'")
            elif arg.kind == 'formfeed':
                parts.append("'\\f'")
            elif arg.kind == 'tab':
                te = self._emit_expr(arg.tab_expr) if arg.tab_expr else "0"
                parts.append(f"' ' * max(0, {te})")
            else:
                parts.append(f"str({self._emit_expr(arg.expr)})")

        if len(parts) == 1:
            self._raw(f"{inner_ind}print({parts[0]}, end='')  # WRITE L{src_line}")
        else:
            concat = " + ".join(parts)
            self._raw(f"{inner_ind}print({concat}, end='')  # WRITE L{src_line}")

    def _emit_read(self, stmt: ReadStatement, ind: str, src_line: int):
        """Emit READ — prompts and reads user input."""
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None
        if cond:
            self._raw(f"{ind}if {cond}:")
            inner_ind = ind + _INDENT
        else:
            inner_ind = ind

        for arg in stmt.args:
            if arg.kind == 'prompt':
                self._raw(f"{inner_ind}print({arg.prompt!r}, end='')  # READ prompt L{src_line}")
            elif arg.kind == 'newline':
                self._raw(f"{inner_ind}print()  # READ newline L{src_line}")
            elif arg.kind == 'var':
                if arg.target and self._use_ctx and isinstance(arg.target, LocalVar):
                    # In ctx mode, use ctx.set() for READ target
                    if arg.timeout is not None:
                        t_e = self._emit_expr(arg.timeout)
                        self._raw(f"{inner_ind}# READ with timeout={t_e} - not enforced in standard Python input()")
                    self._raw(f"{inner_ind}ctx.set({arg.target.name!r}, input())  # READ {arg.target.name} L{src_line}")
                else:
                    lval = self._emit_lvalue(arg.target) if arg.target else "_read_var"
                    if arg.timeout is not None:
                        t_e = self._emit_expr(arg.timeout)
                        self._raw(f"{inner_ind}# READ with timeout={t_e} - not enforced in standard Python input()")
                    self._raw(f"{inner_ind}{lval} = input()  # READ L{src_line}")

    def _emit_quit(self, stmt: QuitStatement, ind: str, src_line: int,
                   in_state_machine: bool):
        """
        Emit QUIT. Behaviour depends on context:
        - In a FOR loop with postcond → break if condition true
        - With expression → return value
        - Plain QUIT → return (from label function)
        - In state machine → break
        """
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None

        if self._in_for_loop and cond and stmt.expr is None:
            # FOR loop conditional exit: QUIT:condition
            self._raw(f"{ind}if {cond}:  # QUIT:{cond} inside FOR loop")
            self._raw(f"{ind}{_INDENT}break")
            return

        if cond:
            self._raw(f"{ind}if {cond}:  # QUIT postconditional L{src_line}")
            inner_ind = ind + _INDENT
        else:
            inner_ind = ind

        if stmt.expr is not None:
            val_e = self._emit_expr(stmt.expr)
            self._raw(f"{inner_ind}return {val_e}  # QUIT {val_e}")
        elif in_state_machine:
            self._raw(f"{inner_ind}break  # QUIT (state machine)")
        else:
            self._raw(f"{inner_ind}return  # QUIT")

    def _emit_xecute(self, stmt: XecuteStatement, ind: str, src_line: int):
        expr_e = self._emit_expr(stmt.expr) if stmt.expr else "''"
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None
        self._review.append(f"L{src_line}: XECUTE — dynamic execution cannot be statically converted")
        if cond:
            self._raw(f"{ind}if {cond}:")
            self._raw(f"{ind}{_INDENT}# REVIEW_REQUIRED: XECUTE {expr_e} — dynamic execution")
            self._raw(f"{ind}{_INDENT}exec({expr_e})  # WARNING: use with caution")
        else:
            self._raw(f"{ind}# REVIEW_REQUIRED: XECUTE {expr_e} — dynamic execution")
            self._raw(f"{ind}exec({expr_e})  # WARNING: use with caution")

    # ── Expression emitter ────────────────────────────────────────────────────

    def _emit_expr(self, node: Any) -> str:
        """Recursively emit a Python expression string from an AST expression node."""
        if node is None:
            return "''"

        if isinstance(node, NumberLiteral):
            return node.value

        if isinstance(node, StringLiteral):
            return repr(node.value)

        if isinstance(node, LocalVar):
            if self._use_ctx:
                return f"ctx.get({node.name!r})"
            return self._py_var(node.name)

        if isinstance(node, GlobalVar):
            attr = self._global_attr(node.name)
            if node.subscripts:
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"_globals.get_{attr}({subs})"
            return f"_globals.get_{attr}()"

        if isinstance(node, SpecialVar):
            return self._emit_special_var(node)

        if isinstance(node, IntrinsicCall):
            return self._emit_intrinsic(node)

        if isinstance(node, Subscript):
            base_e = self._emit_expr(node.base)
            if isinstance(node.base, LocalVar) and self._use_ctx:
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"ctx.get_sub({node.base.name!r}, {subs})"
            elif isinstance(node.base, GlobalVar):
                attr = self._global_attr(node.base.name)
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"_globals.get_{attr}({subs})"
            else:
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"{base_e}[{subs}]"

        if isinstance(node, BinOp):
            return self._emit_binop(node)

        if isinstance(node, UnaryOp):
            operand = self._emit_expr(node.operand)
            if node.op == '-':
                return f"(-({operand}))"
            if node.op == '+':
                return f"mumps_numeric({operand})"
            if node.op == "'":
                return f"mumps_not({operand})"
            return f"({node.op}{operand})"

        if isinstance(node, Indirection):
            inner = self._emit_expr(node.expr)
            self._review.append(f"Indirection @ — runtime dynamic lookup")
            return f"eval({inner})  # REVIEW_REQUIRED: @ indirection"

        if isinstance(node, FunctionCall):
            return self._emit_function_call(node)

        if isinstance(node, ExtRoutineRef):
            self._review.append(f"ExtRoutineRef {node.label}^{node.routine}")
            return f"# REVIEW_REQUIRED: {node.label}^{node.routine}"

        # Fallback
        return repr(str(node))

    def _emit_lvalue(self, node: Any) -> str:
        """Emit a Python assignable target (lvalue) string."""
        if isinstance(node, LocalVar):
            # In ctx mode, SET uses ctx.set() directly - lvalue returns plain var name
            # for the rare case it's used as rvalue
            return self._py_var(node.name)

        if isinstance(node, GlobalVar):
            attr = self._global_attr(node.name)
            if node.subscripts:
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"_globals.get_{attr}({subs})"
            return f"_globals.{attr}"

        if isinstance(node, Subscript):
            if isinstance(node.base, LocalVar) and self._use_ctx:
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"ctx.get_sub({node.base.name!r}, {subs})"
            return self._emit_expr(node)

        if isinstance(node, Indirection):
            return self._emit_expr(node)

        return self._emit_expr(node)

    def _emit_set_lvalue(self, node: Any, rval_e: str, ind: str, src_line: int) -> str:
        """
        Emit a SET assignment. For ctx-based code, use ctx.set().
        For GlobalVar, use the repository setter.
        Returns the Python assignment line.
        """
        if isinstance(node, LocalVar):
            if self._use_ctx:
                return f"{ind}ctx.set({node.name!r}, {rval_e})  # SET {node.name} L{src_line}"
            return f"{ind}{self._py_var(node.name)} = {rval_e}  # SET {node.name} L{src_line}"

        if isinstance(node, GlobalVar):
            attr = self._global_attr(node.name)
            if node.subscripts:
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"{ind}_globals.set_{attr}({subs}, {rval_e})  # SET {node.name} L{src_line}"
            return f"{ind}_globals.{attr} = {rval_e}  # SET {node.name} L{src_line}"

        if isinstance(node, Subscript):
            if isinstance(node.base, LocalVar) and self._use_ctx:
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"{ind}ctx.set_sub({node.base.name!r}, {rval_e}, {subs})  # SET subscripted L{src_line}"
            elif isinstance(node.base, GlobalVar):
                attr = self._global_attr(node.base.name)
                subs = ", ".join(self._emit_expr(s) for s in node.subscripts)
                return f"{ind}_globals.set_{attr}({subs}, {rval_e})  # SET {node.base.name} L{src_line}"

        # Fallback
        lval = self._emit_lvalue(node)
        return f"{ind}{lval} = {rval_e}  # SET L{src_line}"

    # Override _emit_set to use _emit_set_lvalue properly
    def _emit_set(self, stmt: SetStatement, ind: str, src_line: int):
        cond = self._emit_postcond_guard(stmt.postcond, ind) if stmt.postcond else None
        if cond:
            self._raw(f"{ind}if {cond}:  # postconditional")
            inner_ind = ind + _INDENT
        else:
            inner_ind = ind

        for lval, rval in stmt.assignments:
            rval_e = self._emit_expr(rval) if rval is not None else "None"
            line_str = self._emit_set_lvalue(lval, rval_e, inner_ind, src_line)
            self._raw(line_str)

    def _emit_binop(self, node: BinOp) -> str:
        left = self._emit_expr(node.left)
        right = self._emit_expr(node.right)
        op = node.op

        op_map = {
            '+':  f"(mumps_numeric({left}) + mumps_numeric({right}))",
            '-':  f"(mumps_numeric({left}) - mumps_numeric({right}))",
            '*':  f"(mumps_numeric({left}) * mumps_numeric({right}))",
            '/':  f"(mumps_numeric({left}) / mumps_numeric({right}))",
            '\\': f"(int(mumps_numeric({left}) // mumps_numeric({right})))",  # integer div
            '#':  f"(int(mumps_numeric({left}) % mumps_numeric({right})))",   # modulo
            '**': f"(mumps_numeric({left}) ** mumps_numeric({right}))",
            '_':  f"mumps_concat({left}, {right})",
            '=':  f"(str({left}) == str({right}))",    # MUMPS = is string equality
            "'=": f"(str({left}) != str({right}))",
            '<':  f"(mumps_numeric({left}) < mumps_numeric({right}))",
            '>':  f"(mumps_numeric({left}) > mumps_numeric({right}))",
            "'>": f"(mumps_numeric({left}) <= mumps_numeric({right}))",  # '> = <=  (standard)
            "'<": f"(mumps_numeric({left}) >= mumps_numeric({right}))",  # '< = >=  (standard)
            "<=": f"(mumps_numeric({left}) <= mumps_numeric({right}))",  # non-standard alias
            ">=": f"(mumps_numeric({left}) >= mumps_numeric({right}))",  # non-standard alias
            '[':  f"mumps_contains({left}, {right})",
            ']':  f"mumps_follows({left}, {right})",
            ']]': f"(str({left}) > str({right}))",    # sort-after
            '&':  f"mumps_and({left}, {right})",
            '!':  f"mumps_or({left}, {right})",       # ! as logical OR in expressions
        }
        return op_map.get(op, f"({left} {op} {right})  # REVIEW_REQUIRED: unknown op {op!r}")

    def _emit_intrinsic(self, node: IntrinsicCall) -> str:
        """Emit $FUNCTION(args) as runtime call."""
        fname = node.func.upper().lstrip('$')
        args = [self._emit_expr(a) for a in node.args]

        func_map = {
            'GET': 'mumps_get',      'G': 'mumps_get',
            'LENGTH': 'mumps_length', 'L': 'mumps_length',
            'EXTRACT': 'mumps_extract', 'E': 'mumps_extract',
            'PIECE': 'mumps_piece',   'P': 'mumps_piece',
            'FIND': 'mumps_find',     'F': 'mumps_find',
            'TRANSLATE': 'mumps_translate', 'TR': 'mumps_translate',
            'JUSTIFY': 'mumps_justify', 'J': 'mumps_justify',
            'REVERSE': 'mumps_reverse', 'RE': 'mumps_reverse',
            'ASCII': 'mumps_ascii',   'A': 'mumps_ascii',
            'CHAR': 'mumps_char',     'C': 'mumps_char',
            'SELECT': 'mumps_select', 'S': 'mumps_select',
            'ORDER': 'mumps_order',   'O': 'mumps_order',
            'RANDOM': 'mumps_random',
            'FNUMBER': 'mumps_fnumber', 'FN': 'mumps_fnumber',
        }
        py_func = func_map.get(fname)
        if py_func:
            return f"{py_func}({', '.join(args)})"

        # Unknown intrinsic — preserve with review marker
        self._review.append(f"Unknown intrinsic ${fname}")
        return f"None  # REVIEW_REQUIRED: ${fname}({', '.join(args)})"

    def _emit_special_var(self, node: SpecialVar) -> str:
        name = node.name.upper().lstrip('$')
        if name in ('HOROLOG', 'H'):
            return "mumps_horolog_now()"
        if name in ('TEST', 'T'):
            return "ctx.test" if self._use_ctx else "_test"
        if name in ('JOB', 'J'):
            return "__import__('os').getpid()"
        if name in ('IO',):
            return "'device'"
        # Unknown special var
        self._review.append(f"Special variable ${name}")
        return f"None  # REVIEW_REQUIRED: ${name}"

    def _emit_function_call(self, node: FunctionCall) -> str:
        args_e = [self._emit_expr(a) for a in node.args]
        if isinstance(node.ref, ExtRoutineRef):
            py_func = self._py_func_name(node.ref.label or "main")
            routine = node.ref.routine.lower()
            self._review.append(f"Extrinsic $${node.ref.label}^{node.ref.routine}")
            if self._use_ctx:
                return f"{routine}.{py_func}(ctx, {', '.join(args_e)})  # $${node.ref.label}^{node.ref.routine}"
            return f"{routine}.{py_func}({', '.join(args_e)})  # $${node.ref.label}^{node.ref.routine}"
        elif isinstance(node.ref, str):
            py_func = self._py_func_name(node.ref)
            if self._use_ctx:
                return f"{py_func}(ctx, {', '.join(args_e)})"
            return f"{py_func}({', '.join(args_e)})"
        return f"None  # REVIEW_REQUIRED: unknown function call"

    # ── Postconditional helpers ───────────────────────────────────────────────

    def _emit_postcond_guard(self, postcond, ind: str) -> Optional[str]:
        if postcond is None:
            return None
        return f"mumps_truth({self._emit_expr(postcond.condition)})"

    def _emit_with_postcond(self, postcond, stmt_str: str, ind: str, src_line: int):
        if postcond:
            cond = self._emit_postcond_guard(postcond, ind)
            self._raw(f"{ind}if {cond}:")
            self._raw(f"{ind}{_INDENT}{stmt_str}")
        else:
            self._raw(f"{ind}{stmt_str}")

    # ── Naming helpers ────────────────────────────────────────────────────────

    def _py_func_name(self, mumps_name: str) -> str:
        """Convert a MUMPS label name to a valid Python function name."""
        if not mumps_name:
            return "_entry"
        name = mumps_name.strip().upper()
        # MUMPS names can start with % — map to py_ prefix
        if name.startswith('%'):
            name = 'pct_' + name[1:]
        return name.lower()

    def _py_var(self, mumps_var: str) -> str:
        """Convert a MUMPS variable name to a valid Python variable name."""
        if not mumps_var:
            return "_var"
        v = mumps_var.strip().upper()
        if v.startswith('%'):
            v = 'pct_' + v[1:]
        result = v.lower()
        # Avoid Python keywords
        _keywords = {'for', 'if', 'else', 'while', 'return', 'class', 'def',
                     'import', 'from', 'try', 'except', 'with', 'as', 'in',
                     'and', 'or', 'not', 'is', 'None', 'True', 'False',
                     'pass', 'break', 'continue', 'lambda', 'yield',
                     'del', 'raise', 'global', 'nonlocal', 'assert'}
        if result in _keywords:
            result = result + '_'
        return result

    # ── Output helpers ────────────────────────────────────────────────────────

    def _raw(self, line: str):
        self._lines.append(line)

    def _emit_line(self, code: str, src_line: int = 0):
        ind = _INDENT * self._indent_level
        self._raw(f"{ind}{code}")
        self._trace.append((len(self._lines), src_line, code[:60]))

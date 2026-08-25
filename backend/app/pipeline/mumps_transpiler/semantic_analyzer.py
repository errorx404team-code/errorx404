"""
MUMPS Semantic Analyzer — Stage 3 of the transpiler pipeline.

Performs:
  1. Variable and scope analysis (local, NEW-scoped, global, special, parameter)
  2. Control-flow analysis (labels, GOTO targets, DO targets, FOR loops)
  3. Dependency analysis (internal labels, external routines, globals)
  4. Postconditional analysis
  5. Label reachability / call-graph construction

This stage produces a SemanticModel that the code generator uses.
It contains zero domain-specific knowledge — all analysis is based on
MUMPS language semantics only.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any

from .ast_nodes import (
    Routine, LabelBlock, MumpsLine,
    SetStatement, KillStatement, NewStatement,
    DoStatement, DoArg, GotoStatement, GotoArg,
    IfStatement, ElseStatement, ForStatement,
    WriteStatement, ReadStatement, QuitStatement,
    XecuteStatement, HangStatement, MergeStatement, UnknownStatement,
    LocalVar, GlobalVar, SpecialVar, IntrinsicCall,
    Subscript, BinOp, UnaryOp, StringLiteral, NumberLiteral,
    Indirection, FunctionCall, ExtRoutineRef,
)


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class VarInfo:
    """Tracks how a variable is used in the routine."""
    name: str
    is_param: bool = False           # declared as a label parameter
    is_new: bool = False             # explicitly NEW-ed
    is_new_exclusive: bool = False   # NEWed in exclusive form
    is_global: bool = False          # ^GLOBALNAME
    is_special: bool = False         # $HOROLOG etc.
    is_modified: bool = False        # assigned at any point
    is_read: bool = False            # read at any point
    is_killed: bool = False          # KILLed
    new_scopes: List[str] = field(default_factory=list)   # label names where NEW-ed
    used_in_labels: Set[str] = field(default_factory=set)


@dataclass
class LabelInfo:
    """Metadata for a single label/tag."""
    name: str
    params: List[str] = field(default_factory=list)
    has_quit: bool = False
    quit_with_value: bool = False     # QUIT expr
    calls_labels: Set[str] = field(default_factory=set)      # internal DO targets
    calls_external: Set[str] = field(default_factory=set)    # external DO targets
    goto_targets: Set[str] = field(default_factory=set)
    new_vars: List[str] = field(default_factory=list)
    loop_vars: List[str] = field(default_factory=list)
    line_count: int = 0


@dataclass
class GlobalInfo:
    name: str
    subscript_arity: int = 0   # max subscript depth seen
    is_written: bool = False
    is_read: bool = False
    used_in_labels: Set[str] = field(default_factory=set)


@dataclass
class ExternalCallInfo:
    """An external routine reference DO Label^Routine or GOTO Label^Routine."""
    label: Optional[str]
    routine: str
    args_count: int = 0
    call_type: str = "DO"   # "DO" | "GOTO" | "EXTRINSIC"


@dataclass
class SemanticModel:
    """
    Complete semantic analysis result for one MUMPS routine.
    Consumed by the code generator.
    """
    routine_name: str = "UNKNOWN"
    labels: List[LabelInfo] = field(default_factory=list)
    label_map: Dict[str, LabelInfo] = field(default_factory=dict)   # name → info
    variables: Dict[str, VarInfo] = field(default_factory=dict)
    globals: Dict[str, GlobalInfo] = field(default_factory=dict)
    external_calls: List[ExternalCallInfo] = field(default_factory=list)
    internal_call_graph: Dict[str, Set[str]] = field(default_factory=dict)
    # Which labels are only reachable via GOTO (vs DO)
    goto_only_labels: Set[str] = field(default_factory=set)
    # Which labels are called with arguments
    labels_with_args: Set[str] = field(default_factory=set)
    # Labels that return a value (QUIT expr)
    value_returning_labels: Set[str] = field(default_factory=set)
    # Needs dynamic scope helper (due to NEW-in-called-label pattern)
    needs_scope_context: bool = False
    # Uses XECUTE (dynamic execution)
    uses_xecute: bool = False
    # Uses indirection
    uses_indirection: bool = False
    # Source AST
    ast: Optional[Routine] = None
    warnings: List[str] = field(default_factory=list)


# ── Analyzer ──────────────────────────────────────────────────────────────────

class MumpsSemanticAnalyzer:
    """
    Walks the AST and builds a SemanticModel.
    Contains zero domain-specific knowledge.
    """

    def __init__(self):
        self._model: SemanticModel = SemanticModel()
        self._current_label: Optional[str] = None

    def analyze(self, ast: Routine) -> SemanticModel:
        self._model = SemanticModel(routine_name=ast.name, ast=ast)

        # Pass 1: register all labels
        for lb in ast.labels:
            li = LabelInfo(name=lb.name, params=lb.params,
                           line_count=len(lb.lines))
            self._model.labels.append(li)
            self._model.label_map[lb.name] = li
            self._model.internal_call_graph[lb.name] = set()

        # Pass 2: analyse each label body
        for lb in ast.labels:
            self._current_label = lb.name
            li = self._model.label_map[lb.name]
            # Parameters are local variables
            for p in lb.params:
                self._register_var(p, is_param=True)
            # Walk lines
            for mline in lb.lines:
                self._analyze_line(mline, li)

        # Pass 3: infer scope requirements
        self._model.needs_scope_context = self._compute_scope_need()

        # Pass 4: identify value-returning labels
        for li in self._model.labels:
            if li.quit_with_value:
                self._model.value_returning_labels.add(li.name)

        return self._model

    # ── Line / Statement analysis ─────────────────────────────────────────────

    def _analyze_line(self, mline: MumpsLine, li: LabelInfo):
        for stmt in mline.statements:
            self._analyze_stmt(stmt, li)

    def _analyze_stmt(self, stmt: Any, li: LabelInfo):
        if isinstance(stmt, SetStatement):
            for lval, rval in stmt.assignments:
                self._analyze_lvalue(lval, write=True)
                if rval is not None:
                    self._analyze_expr(rval)
            if stmt.postcond:
                self._analyze_expr(stmt.postcond.condition)

        elif isinstance(stmt, KillStatement):
            for t in stmt.targets:
                self._analyze_lvalue(t, write=False, killed=True)
            if not stmt.targets:
                # Argumentless KILL — affects all local variables
                vi = self._get_or_create_var("__all_locals__")
                vi.is_killed = True

        elif isinstance(stmt, NewStatement):
            for v in stmt.vars:
                vi = self._register_var(v, is_new=True)
                vi.new_scopes.append(self._current_label or "")
                li.new_vars.append(v)

        elif isinstance(stmt, DoStatement):
            if stmt.argumentless:
                self._model.needs_scope_context = True
            for arg in stmt.calls:
                self._analyze_do_arg(arg, li)
            if stmt.postcond:
                self._analyze_expr(stmt.postcond.condition)

        elif isinstance(stmt, GotoStatement):
            for arg in stmt.calls:
                tgt = arg.label or ""
                if arg.routine:
                    self._model.external_calls.append(
                        ExternalCallInfo(label=arg.label, routine=arg.routine,
                                         call_type="GOTO"))
                    li.calls_external.add(f"{arg.label or ''}^{arg.routine}")
                else:
                    li.goto_targets.add(tgt)
                    self._model.goto_only_labels.add(tgt)
            if stmt.postcond:
                self._analyze_expr(stmt.postcond.condition)

        elif isinstance(stmt, IfStatement):
            for cond in stmt.conditions:
                self._analyze_expr(cond)

        elif isinstance(stmt, ForStatement):
            if stmt.var:
                vi = self._register_var(stmt.var)
                vi.is_modified = True
                vi.used_in_labels.add(self._current_label or "")
                li.loop_vars.append(stmt.var)
            for r in stmt.ranges:
                self._analyze_expr(r.start)
                if r.step: self._analyze_expr(r.step)
                if r.stop: self._analyze_expr(r.stop)

        elif isinstance(stmt, WriteStatement):
            for arg in stmt.args:
                if arg.expr is not None:
                    self._analyze_expr(arg.expr)
                if arg.tab_expr is not None:
                    self._analyze_expr(arg.tab_expr)
            if stmt.postcond:
                self._analyze_expr(stmt.postcond.condition)

        elif isinstance(stmt, ReadStatement):
            for arg in stmt.args:
                if arg.target is not None:
                    self._analyze_lvalue(arg.target, write=True)
                if arg.timeout is not None:
                    self._analyze_expr(arg.timeout)
            if stmt.postcond:
                self._analyze_expr(stmt.postcond.condition)

        elif isinstance(stmt, QuitStatement):
            li.has_quit = True
            if stmt.expr is not None:
                li.quit_with_value = True
                self._analyze_expr(stmt.expr)
            if stmt.postcond:
                self._analyze_expr(stmt.postcond.condition)

        elif isinstance(stmt, XecuteStatement):
            self._model.uses_xecute = True
            if stmt.expr:
                self._analyze_expr(stmt.expr)

        elif isinstance(stmt, HangStatement):
            if stmt.expr:
                self._analyze_expr(stmt.expr)

        elif isinstance(stmt, MergeStatement):
            for dst, src in stmt.assignments:
                self._analyze_lvalue(dst, write=True)
                if src: self._analyze_lvalue(src, write=False)

        elif isinstance(stmt, UnknownStatement):
            self._model.warnings.append(
                f"Unrecognized statement at L{stmt.line}: {stmt.raw_text!r}")

    def _analyze_do_arg(self, arg: DoArg, li: LabelInfo):
        for a in arg.args:
            self._analyze_expr(a)
        if arg.routine:
            # External call
            ext = ExternalCallInfo(
                label=arg.label, routine=arg.routine,
                args_count=len(arg.args), call_type="DO")
            self._model.external_calls.append(ext)
            li.calls_external.add(f"{arg.label or ''}^{arg.routine}")
        elif arg.label:
            # Internal call
            li.calls_labels.add(arg.label)
            self._model.internal_call_graph[self._current_label or ""].add(arg.label)
            if arg.args:
                self._model.labels_with_args.add(arg.label)

    # ── Expression analysis ───────────────────────────────────────────────────

    def _analyze_expr(self, node: Any):
        if node is None:
            return
        if isinstance(node, LocalVar):
            vi = self._get_or_create_var(node.name)
            vi.is_read = True
            vi.used_in_labels.add(self._current_label or "")
        elif isinstance(node, GlobalVar):
            gi = self._get_or_create_global(node.name)
            gi.is_read = True
            gi.subscript_arity = max(gi.subscript_arity, len(node.subscripts))
            gi.used_in_labels.add(self._current_label or "")
            for s in node.subscripts:
                self._analyze_expr(s)
        elif isinstance(node, SpecialVar):
            pass   # just note that $TEST etc. is used
        elif isinstance(node, IntrinsicCall):
            for a in node.args:
                self._analyze_expr(a)
        elif isinstance(node, Subscript):
            self._analyze_expr(node.base)
            for s in node.subscripts:
                self._analyze_expr(s)
        elif isinstance(node, BinOp):
            self._analyze_expr(node.left)
            self._analyze_expr(node.right)
        elif isinstance(node, UnaryOp):
            self._analyze_expr(node.operand)
        elif isinstance(node, Indirection):
            self._model.uses_indirection = True
            self._analyze_expr(node.expr)
        elif isinstance(node, FunctionCall):
            if isinstance(node.ref, ExtRoutineRef):
                self._model.external_calls.append(
                    ExternalCallInfo(label=node.ref.label, routine=node.ref.routine,
                                     args_count=len(node.args), call_type="EXTRINSIC"))
            for a in node.args:
                self._analyze_expr(a)

    def _analyze_lvalue(self, node: Any, write: bool = True, killed: bool = False):
        if isinstance(node, LocalVar):
            vi = self._get_or_create_var(node.name)
            if write: vi.is_modified = True
            if killed: vi.is_killed = True
            vi.used_in_labels.add(self._current_label or "")
        elif isinstance(node, GlobalVar):
            gi = self._get_or_create_global(node.name)
            if write: gi.is_written = True
            gi.subscript_arity = max(gi.subscript_arity, len(node.subscripts))
            gi.used_in_labels.add(self._current_label or "")
            for s in node.subscripts:
                self._analyze_expr(s)
        elif isinstance(node, Subscript):
            self._analyze_lvalue(node.base, write=write, killed=killed)
            for s in node.subscripts:
                self._analyze_expr(s)
        elif isinstance(node, Indirection):
            self._model.uses_indirection = True
            self._analyze_expr(node.expr)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _register_var(self, name: str, is_param: bool = False,
                      is_new: bool = False) -> VarInfo:
        if name not in self._model.variables:
            vi = VarInfo(name=name)
            self._model.variables[name] = vi
        vi = self._model.variables[name]
        if is_param: vi.is_param = True
        if is_new: vi.is_new = True
        vi.used_in_labels.add(self._current_label or "")
        return vi

    def _get_or_create_var(self, name: str) -> VarInfo:
        if name not in self._model.variables:
            self._model.variables[name] = VarInfo(name=name)
        v = self._model.variables[name]
        if self._current_label:
            v.used_in_labels.add(self._current_label)
        return v

    def _get_or_create_global(self, name: str) -> GlobalInfo:
        if name not in self._model.globals:
            self._model.globals[name] = GlobalInfo(name=name)
        return self._model.globals[name]

    def _compute_scope_need(self) -> bool:
        """
        Returns True if we need MumpsContext for dynamic scoping.
        Conditions:
        - Any label explicitly NEWs variables
        - A called label NEWs variables used by the caller
        - Argumentless DO exists
        """
        for li in self._model.labels:
            if li.new_vars:
                return True
        for li in self._model.labels:
            if not li.calls_labels:
                continue
            caller_vars = {v for v, vi in self._model.variables.items()
                           if self._current_label in vi.used_in_labels}
            for called in li.calls_labels:
                called_li = self._model.label_map.get(called)
                if called_li and called_li.new_vars:
                    return True
        return False

"""
MUMPS AST Nodes — the Intermediate Representation produced by the parser.

All nodes are plain dataclasses. No domain knowledge. Every MUMPS construct
that exists in the source has a corresponding AST node type.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, List, Optional, Union


# ── Base ──────────────────────────────────────────────────────────────────────

@dataclass
class Node:
    """Base AST node carrying source position."""
    line: int = 0
    col: int = 0


# ── Expressions ───────────────────────────────────────────────────────────────

@dataclass
class NumberLiteral(Node):
    value: str = ""          # keep as string to preserve exact representation

@dataclass
class StringLiteral(Node):
    value: str = ""          # unescaped content

@dataclass
class LocalVar(Node):
    name: str = ""           # variable name (upper-case canonical)

@dataclass
class GlobalVar(Node):
    name: str = ""           # ^NAME
    subscripts: List[Any] = field(default_factory=list)  # list of expr nodes

@dataclass
class SpecialVar(Node):
    name: str = ""           # $HOROLOG, $TEST, etc.

@dataclass
class IntrinsicCall(Node):
    func: str = ""           # $GET, $LENGTH, etc.
    args: List[Any] = field(default_factory=list)

@dataclass
class Indirection(Node):
    """@ indirection — the expression whose value is a variable/label name."""
    expr: Any = None         # expression node

@dataclass
class BinOp(Node):
    op: str = ""             # +, -, *, /, \, #, _, =, '=, <, >, etc.
    left: Any = None
    right: Any = None

@dataclass
class UnaryOp(Node):
    op: str = ""             # -, '
    operand: Any = None

@dataclass
class Subscript(Node):
    """var(sub1, sub2, ...) — local or global variable with subscripts."""
    base: Any = None         # LocalVar or GlobalVar
    subscripts: List[Any] = field(default_factory=list)

@dataclass
class ExtRoutineRef(Node):
    """Label^Routine reference used in DO/GOTO/$$."""
    label: Optional[str] = None   # may be empty string = entry-point
    routine: str = ""

@dataclass
class FunctionCall(Node):
    """$$Label^Routine(args) — extrinsic function call."""
    ref: Any = None          # ExtRoutineRef or label string
    args: List[Any] = field(default_factory=list)

@dataclass
class PatternMatch(Node):
    """expr?pattern — MUMPS pattern match."""
    expr: Any = None
    pattern: str = ""


# ── Statements ────────────────────────────────────────────────────────────────

@dataclass
class Postcondition(Node):
    """A command:CONDITION — condition is evaluated; command runs only if truthy."""
    condition: Any = None      # expression node


@dataclass
class SetStatement(Node):
    """SET var=expr [, var=expr ...]"""
    assignments: List[tuple] = field(default_factory=list)  # [(lvalue, expr), ...]
    postcond: Optional[Postcondition] = None

@dataclass
class KillStatement(Node):
    """KILL [var, ...]  (no args = kill all locals)"""
    targets: List[Any] = field(default_factory=list)  # empty = kill all locals
    postcond: Optional[Postcondition] = None

@dataclass
class NewStatement(Node):
    """NEW [var, ...] or NEW (exclusive list)"""
    vars: List[str] = field(default_factory=list)         # empty = new all
    exclusive: bool = False                               # NEW (A,B) form
    postcond: Optional[Postcondition] = None

@dataclass
class DoStatement(Node):
    """DO [label[^routine][(args)]] or argumentless DO"""
    calls: List[Any] = field(default_factory=list)  # list of DoArg
    argumentless: bool = False                       # DO with no args
    postcond: Optional[Postcondition] = None

@dataclass
class DoArg(Node):
    """Single argument of a DO statement."""
    label: Optional[str] = None
    routine: Optional[str] = None       # None = local label
    args: List[Any] = field(default_factory=list)
    by_ref_flags: List[bool] = field(default_factory=list)  # True = passed by ref (.)
    offset: Optional[str] = None  # label+offset form

@dataclass
class GotoStatement(Node):
    """GOTO label[^routine][+offset][:cond]"""
    calls: List[Any] = field(default_factory=list)  # list of GotoArg
    postcond: Optional[Postcondition] = None

@dataclass
class GotoArg(Node):
    label: Optional[str] = None
    routine: Optional[str] = None
    offset: Optional[str] = None

@dataclass
class IfStatement(Node):
    """IF expr [expr ...]  — sets $TEST."""
    conditions: List[Any] = field(default_factory=list)   # expressions (AND-ed implicitly)

@dataclass
class ElseStatement(Node):
    """ELSE — executes when $TEST is false."""
    pass

@dataclass
class ForStatement(Node):
    """FOR [var=start:step[:end]] — or argumentless FOR."""
    var: Optional[str] = None
    ranges: List[Any] = field(default_factory=list)  # list of ForRange
    argumentless: bool = False

@dataclass
class ForRange(Node):
    start: Any = None
    step: Optional[Any] = None
    stop: Optional[Any] = None

@dataclass
class WriteStatement(Node):
    """WRITE arg [, arg ...]"""
    args: List[Any] = field(default_factory=list)  # WriteArg list
    postcond: Optional[Postcondition] = None

@dataclass
class WriteArg(Node):
    """A single argument to WRITE."""
    kind: str = "expr"   # 'expr' | 'newline' | 'formfeed' | 'tab'
    expr: Optional[Any] = None
    tab_expr: Optional[Any] = None   # for ?expr

@dataclass
class ReadStatement(Node):
    """READ var [timeout]"""
    args: List[Any] = field(default_factory=list)  # ReadArg list
    postcond: Optional[Postcondition] = None

@dataclass
class ReadArg(Node):
    kind: str = "var"       # 'var' | 'prompt' | 'newline' | 'tab'
    target: Optional[Any] = None   # lvalue for 'var'
    prompt: Optional[str] = None   # literal prompt text
    timeout: Optional[Any] = None

@dataclass
class QuitStatement(Node):
    """QUIT [expr]"""
    expr: Optional[Any] = None
    postcond: Optional[Postcondition] = None

@dataclass
class XecuteStatement(Node):
    """XECUTE expr"""
    expr: Any = None
    postcond: Optional[Postcondition] = None

@dataclass
class HangStatement(Node):
    """HANG expr"""
    expr: Any = None
    postcond: Optional[Postcondition] = None

@dataclass
class MergeStatement(Node):
    """MERGE dst=src"""
    assignments: List[tuple] = field(default_factory=list)
    postcond: Optional[Postcondition] = None

@dataclass
class UnknownStatement(Node):
    """Fallback for unrecognised / unsupported commands."""
    raw_text: str = ""


# ── Line / Block structure ────────────────────────────────────────────────────

@dataclass
class MumpsLine(Node):
    """
    A single logical line of MUMPS code.
    Holds zero or more statements on one physical line.
    The dot-depth indicates the DO-block nesting level.
    """
    dot_depth: int = 0              # number of leading dots
    statements: List[Any] = field(default_factory=list)
    source_text: str = ""           # original source for traceability


@dataclass
class LabelBlock(Node):
    """
    A MUMPS label (tag) definition and its body lines.
    """
    name: str = ""
    params: List[str] = field(default_factory=list)
    lines: List[MumpsLine] = field(default_factory=list)
    source_text: str = ""


@dataclass
class Routine(Node):
    """Top-level AST for a complete MUMPS routine."""
    name: str = ""
    labels: List[LabelBlock] = field(default_factory=list)
    source_text: str = ""

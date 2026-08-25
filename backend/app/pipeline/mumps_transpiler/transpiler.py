"""
MumpsTranspiler — the top-level orchestrator of the full transpiler pipeline.

Stages:
  1. Lexical Analysis    → MumpsLexer
  2. Parsing / AST       → MumpsParser
  3. Semantic Analysis   → MumpsSemanticAnalyzer
  4. Code Generation     → CodeGenerator
  5. Validation          → PostValidator

Usage:
    from app.pipeline.mumps_transpiler import MumpsTranspiler

    t = MumpsTranspiler()
    result = t.convert(mumps_source, target_language="Python")
    print(result.python_code)
    print(result.validation_report.summary)

The transpiler is source-driven and semantics-based.
It contains zero domain-specific knowledge — every behaviour is derived
from the MUMPS language specification and the actual source text.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional

from .lexer import MumpsLexer
from .parser import MumpsParser
from .semantic_analyzer import MumpsSemanticAnalyzer, SemanticModel
from .codegen import CodeGenerator, GeneratedModule
from .validator import PostValidator, ValidationReport


@dataclass
class TranspilerResult:
    """Complete result of one MUMPS-to-Python conversion."""
    # Generated code
    python_code: str = ""

    # Source traceability: [(py_line, mumps_line, note)]
    traceability: List[tuple] = field(default_factory=list)

    # Semantic model (for downstream use — verifier, docs, etc.)
    semantic_model: Optional[SemanticModel] = None

    # Generated module metadata
    generated_module: Optional[GeneratedModule] = None

    # Validation
    validation_report: Optional[ValidationReport] = None

    # Conversion quality indicators
    review_required: List[str] = field(default_factory=list)
    unresolved_deps: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    conversion_source: str = "TRANSPILER"   # always this for static transpiler

    # Architecture used
    architecture: str = "functions"

    # Whether the runtime module is needed
    uses_runtime: bool = False

    # Parse/semantic errors (non-fatal — converter is tolerant)
    errors: List[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return (
            bool(self.python_code)
            and (self.validation_report is None or
                 not self.validation_report.syntax_errors)
        )

    @property
    def summary(self) -> str:
        lines = [
            f"Routine: {self.semantic_model.routine_name if self.semantic_model else 'unknown'}",
            f"Architecture: {self.architecture}",
            f"Uses runtime: {self.uses_runtime}",
            f"REVIEW_REQUIRED: {len(self.review_required)}",
            f"Unresolved deps: {len(self.unresolved_deps)}",
        ]
        if self.validation_report:
            lines.append(self.validation_report.summary)
        return " | ".join(lines)


class MumpsTranspiler:
    """
    Full MUMPS-to-Python transpiler.

    This is the single entry point for the entire conversion pipeline.
    It accepts any valid MUMPS source and produces Python code without
    any domain-specific assumptions.

    Designed to be called from the existing CodeConverter in converter.py
    as the primary (spec-independent) conversion path.
    """

    def __init__(self):
        self._analyzer = MumpsSemanticAnalyzer()
        self._validator = PostValidator()

    def convert(self,
                mumps_source: str,
                target_language: str = "Python",
                traceability_header: str = "",
                source_file: str = "") -> TranspilerResult:
        """
        Convert MUMPS source to Python (or R — see note below).

        For Python: uses the full transpiler pipeline (lexer → parser → semantic → codegen → validate).
        For R: falls back to a structural R generator (R lacks direct MUMPS semantic equivalents
               for dynamic scoping, so the R output is a best-effort functional translation
               with REVIEW_REQUIRED markers for dynamic constructs).

        Args:
            mumps_source: raw MUMPS source text
            target_language: "Python" (full transpiler) or "R" (structural)
            traceability_header: optional comment header for the output file
            source_file: original source filename for traceability

        Returns:
            TranspilerResult with python_code, validation_report, and metadata
        """
        if not mumps_source or not mumps_source.strip():
            result = TranspilerResult()
            result.python_code = "# REVIEW_REQUIRED: empty MUMPS source provided"
            result.errors.append("Empty source")
            return result

        if target_language.upper() == "R":
            return self._convert_to_r(mumps_source, traceability_header, source_file)

        return self._convert_to_python(mumps_source, traceability_header, source_file)

    # ── Python conversion ─────────────────────────────────────────────────────

    def _convert_to_python(self,
                            source: str,
                            traceability_header: str,
                            source_file: str) -> TranspilerResult:
        result = TranspilerResult()

        # Stage 1 + 2: Lex + Parse
        try:
            parser = MumpsParser(source)
            ast_routine = parser.parse()
        except Exception as e:
            result.errors.append(f"Parse error: {e}")
            result.python_code = (
                f"# TRANSPILER ERROR: parse failed — {e}\n"
                f"# REVIEW_REQUIRED: manual conversion needed\n"
                f"# Original MUMPS source:\n"
            ) + "\n".join(f"# {line}" for line in source.splitlines())
            return result

        # Stage 3: Semantic analysis
        try:
            analyzer = MumpsSemanticAnalyzer()
            model = analyzer.analyze(ast_routine)
        except Exception as e:
            result.errors.append(f"Semantic analysis error: {e}")
            model = SemanticModel(routine_name=ast_routine.name, ast=ast_routine)

        result.semantic_model = model

        # Stage 4: Code generation
        try:
            header = traceability_header or (
                f"Modernized from: {source_file or 'MUMPS source'}\n"
                f"Conversion pipeline: MUMPS Transpiler v1.0 (semantic, source-driven)\n"
            )
            gen = CodeGenerator(model=model,
                                source_language="MUMPS",
                                traceability_header=header)
            generated = gen.generate()
        except Exception as e:
            result.errors.append(f"Code generation error: {e}")
            result.python_code = (
                f"# TRANSPILER ERROR: code generation failed — {e}\n"
                f"# REVIEW_REQUIRED: manual conversion needed\n"
            )
            return result

        result.generated_module = generated
        result.python_code = generated.python_source
        result.traceability = generated.traceability
        result.review_required = generated.review_required
        result.unresolved_deps = generated.unresolved_deps
        result.warnings = generated.warnings
        result.architecture = generated.architecture
        result.uses_runtime = generated.uses_runtime

        # Stage 5: Validate
        try:
            validation = self._validator.validate(generated, model)
            result.validation_report = validation
        except Exception as e:
            result.errors.append(f"Validation error: {e}")

        return result

    # ── R conversion ──────────────────────────────────────────────────────────

    def _convert_to_r(self,
                       source: str,
                       traceability_header: str,
                       source_file: str) -> TranspilerResult:
        """
        Structural MUMPS-to-R conversion.

        R has no direct equivalent of:
          - MUMPS dynamic scope (NEW/restore)
          - MUMPS globals (^GLOBAL)
          - MUMPS indirection

        The output is a best-effort R function module with:
          - One R function per MUMPS label
          - MUMPS globals → R environments or list-based storage
          - REVIEW_REQUIRED for dynamic constructs
        """
        result = TranspilerResult()
        result.conversion_source = "TRANSPILER_R"

        # Parse to get structural info
        try:
            parser = MumpsParser(source)
            ast_routine = parser.parse()
            analyzer = MumpsSemanticAnalyzer()
            model = analyzer.analyze(ast_routine)
        except Exception as e:
            result.errors.append(f"Parse error for R conversion: {e}")
            model = None

        result.semantic_model = model

        r_gen = RCodeGenerator(model, source, traceability_header, source_file)
        r_code = r_gen.generate()

        result.python_code = r_code   # field is reused for R output
        result.review_required = r_gen.review_required
        result.unresolved_deps = r_gen.unresolved_deps
        result.architecture = "r_functions"
        result.uses_runtime = False

        return result


# ── R Code Generator ──────────────────────────────────────────────────────────

class RCodeGenerator:
    """
    Generates R code from a SemanticModel.
    Structural translation — preserves labels as R functions,
    globals as R environments, business rules as comments.
    """

    def __init__(self, model: Optional[SemanticModel],
                 source: str, header: str, source_file: str):
        self._model = model
        self._source = source
        self._header = header
        self._source_file = source_file
        self._lines: List[str] = []
        self.review_required: List[str] = []
        self.unresolved_deps: List[str] = []

    def generate(self) -> str:
        self._emit_header()
        if self._model is None:
            self._raw("# REVIEW_REQUIRED: Parse failed — manual conversion required")
            self._emit_source_as_comments()
            return "\n".join(self._lines)

        self._emit_global_envs()
        self._emit_functions()
        return "\n".join(self._lines)

    def _emit_header(self):
        self._raw(f"# {'=' * 78}")
        self._raw(f"# R equivalent of MUMPS routine: {self._model.routine_name if self._model else 'UNKNOWN'}")
        self._raw(f"# Source: {self._source_file or 'MUMPS source'}")
        self._raw(f"# Generated by MUMPS Transpiler (source-driven, semantics-based)")
        if self._header:
            for line in self._header.splitlines():
                self._raw(f"# {line}")
        self._raw(f"# {'=' * 78}")
        self._raw("")

    def _emit_global_envs(self):
        if not self._model or not self._model.globals:
            return
        self._raw("# ── Global Variable Storage ────────────────────────────────────────────────")
        self._raw("# MUMPS globals mapped to R environments (nested list storage)")
        self._raw("")
        for gname in self._model.globals:
            safe = gname.lstrip("^").lower()
            self._raw(f"{safe}_store <- new.env(hash = TRUE, parent = emptyenv())")
        self._raw("")

        # Helper functions for global access
        self._raw("# Global accessor helpers")
        for gname in self._model.globals:
            safe = gname.lstrip("^").lower()
            self._raw(f"get_{safe} <- function(...) {{")
            self._raw(f"  key <- paste(..., sep = '|')")
            self._raw(f"  if (exists(key, envir = {safe}_store)) get(key, envir = {safe}_store) else ''")
            self._raw(f"}}")
            self._raw(f"set_{safe} <- function(..., value) {{")
            self._raw(f"  key <- paste(list(...)[-length(list(...))], sep = '|')")
            self._raw(f"  assign(key, value, envir = {safe}_store)")
            self._raw(f"}}")
            self._raw("")

    def _emit_functions(self):
        if not self._model or not self._model.ast:
            return
        self._raw("# ── Functions (one per MUMPS label) ─────────────────────────────────────────")
        for lb in self._model.ast.labels:
            li = self._model.label_map.get(lb.name)
            self._emit_r_function(lb, li)

    def _emit_r_function(self, lb, li):
        params = lb.params
        params_r = ", ".join(p.lower() for p in params) if params else ""
        self._raw("")
        self._raw(f"# MUMPS label: {lb.name}" + (f"({', '.join(params)})" if params else ""))
        self._raw(f"{lb.name.lower()} <- function({params_r}) {{")

        if not lb.lines:
            self._raw(f"  # Empty label body")
            self._raw(f"}}")
            return

        for mline in lb.lines:
            self._emit_r_line(mline)

        self._raw(f"}}")

    def _emit_r_line(self, mline):
        src = mline.source_text.strip()
        for stmt in mline.statements:
            from .ast_nodes import (SetStatement, QuitStatement, WriteStatement,
                                     IfStatement, ForStatement, DoStatement,
                                     KillStatement, NewStatement, UnknownStatement)
            if isinstance(stmt, SetStatement):
                for lval, rval in stmt.assignments:
                    lv = self._r_expr(lval)
                    rv = self._r_expr(rval) if rval else "NULL"
                    self._raw(f"  {lv} <- {rv}  # SET L{mline.line}")
            elif isinstance(stmt, QuitStatement):
                if stmt.expr:
                    self._raw(f"  return({self._r_expr(stmt.expr)})  # QUIT")
                else:
                    self._raw(f"  return(invisible(NULL))  # QUIT")
            elif isinstance(stmt, WriteStatement):
                parts = []
                for arg in stmt.args:
                    if arg.kind == 'newline': parts.append('"\\n"')
                    elif arg.kind == 'formfeed': parts.append('"\\f"')
                    elif arg.expr: parts.append(f"as.character({self._r_expr(arg.expr)})")
                if parts:
                    self._raw(f"  cat({', '.join(parts)})  # WRITE L{mline.line}")
            elif isinstance(stmt, IfStatement):
                conds = [f"isTRUE({self._r_expr(c)})" for c in stmt.conditions]
                cond_str = " && ".join(conds) if conds else "TRUE"
                self._raw(f"  if ({cond_str}) {{  # IF L{mline.line}")
                self._raw(f"  }}  # end IF")
            elif isinstance(stmt, DoStatement):
                for arg in stmt.calls:
                    if arg.routine:
                        self._raw(f"  # REVIEW_REQUIRED: external call {arg.label or ''}^{arg.routine}")
                        self.unresolved_deps.append(arg.routine)
                    elif arg.label:
                        args_r = ", ".join(self._r_expr(a) for a in arg.args)
                        self._raw(f"  {arg.label.lower()}({args_r})  # DO {arg.label}")
            elif isinstance(stmt, UnknownStatement):
                self._raw(f"  # REVIEW_REQUIRED: {stmt.raw_text}")
                self.review_required.append(stmt.raw_text)
            else:
                self._raw(f"  # L{mline.line}: {src[:80]}")

    def _r_expr(self, node) -> str:
        from .ast_nodes import (NumberLiteral, StringLiteral, LocalVar, GlobalVar,
                                  BinOp, UnaryOp, IntrinsicCall, Subscript,
                                  SpecialVar)
        if node is None: return "NULL"
        if isinstance(node, NumberLiteral): return node.value
        if isinstance(node, StringLiteral): return repr(node.value)
        if isinstance(node, LocalVar): return node.name.lower()
        if isinstance(node, GlobalVar):
            safe = node.name.lstrip("^").lower()
            if node.subscripts:
                subs = ", ".join(self._r_expr(s) for s in node.subscripts)
                return f"get_{safe}({subs})"
            return f"get_{safe}()"
        if isinstance(node, SpecialVar):
            return f"NULL  # {node.name}"
        if isinstance(node, BinOp):
            l = self._r_expr(node.left)
            r = self._r_expr(node.right)
            r_ops = {'+': '+', '-': '-', '*': '*', '/': '/', '=': '==',
                     "'=": '!=', '<': '<', '>': '>', '_': 'paste0',
                     '&': '&&', '!': '||'}
            op = r_ops.get(node.op, node.op)
            if op == 'paste0':
                return f"paste0({l}, {r})"
            return f"({l} {op} {r})"
        if isinstance(node, UnaryOp):
            inner = self._r_expr(node.operand)
            if node.op == '-': return f"(-{inner})"
            if node.op == "'": return f"(!isTRUE({inner}))"
            return inner
        if isinstance(node, IntrinsicCall):
            fname = node.func.lstrip('$').upper()
            args = [self._r_expr(a) for a in node.args]
            r_funcs = {
                'GET': lambda: f"if (!is.null({args[0]})) {args[0]} else ''",
                'LENGTH': lambda: f"nchar({args[0]})" if len(args) == 1 else f"length(strsplit({args[0]}, {args[1]}, fixed=TRUE)[[1]])",
                'PIECE': lambda: f"strsplit({args[0]}, {args[1]}, fixed=TRUE)[[1]][{args[2]}]",
                'EXTRACT': lambda: f"substr({args[0]}, {args[1]}, {args[2] if len(args) > 2 else args[1]})",
            }
            fn = r_funcs.get(fname)
            if fn:
                try: return fn()
                except: pass
            return f"NULL  # REVIEW_REQUIRED: ${fname}({', '.join(args)})"
        if isinstance(node, Subscript):
            return self._r_expr(node.base)
        return "NULL"

    def _emit_source_as_comments(self):
        for line in self._source.splitlines():
            self._raw(f"# {line}")

    def _raw(self, line: str):
        self._lines.append(line)

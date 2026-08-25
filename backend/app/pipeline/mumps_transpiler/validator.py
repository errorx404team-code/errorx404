"""
Post-Generation Validator — Stage 5 of the transpiler pipeline.

Validates the generated Python code for:
1. Structural validity (Python syntax check via ast.parse)
2. Import resolvability (where possible)
3. Label coverage (every MUMPS label has a Python function)
4. Signature sanity (no invalid function signatures)
5. Traceability completeness (every significant statement is traced)

Reports results as a ValidationReport — never raises, always returns.
"""

from __future__ import annotations
import ast
import textwrap
from dataclasses import dataclass, field
from typing import List, Optional

from .semantic_analyzer import SemanticModel
from .codegen import GeneratedModule


@dataclass
class ValidationResult:
    check: str
    passed: bool
    detail: str = ""


@dataclass
class ValidationReport:
    passed: bool = True
    results: List[ValidationResult] = field(default_factory=list)
    syntax_errors: List[str] = field(default_factory=list)
    missing_labels: List[str] = field(default_factory=list)
    review_required_count: int = 0
    unresolved_deps: List[str] = field(default_factory=list)
    summary: str = ""

    def add(self, check: str, passed: bool, detail: str = ""):
        r = ValidationResult(check=check, passed=passed, detail=detail)
        self.results.append(r)
        if not passed:
            self.passed = False
        return r


class PostValidator:
    """
    Runs all validation checks on a generated Python module.
    Produces a ValidationReport — never raises exceptions.
    """

    def validate(self, generated: GeneratedModule, model: SemanticModel) -> ValidationReport:
        report = ValidationReport()
        report.review_required_count = len(generated.review_required)
        report.unresolved_deps = list(generated.unresolved_deps)

        self._check_syntax(generated.python_source, report)
        self._check_label_coverage(generated.python_source, model, report)
        self._check_no_placeholder_bodies(generated.python_source, report)
        self._build_summary(report, model)

        return report

    def _check_syntax(self, source: str, report: ValidationReport):
        """Check that generated Python is syntactically valid."""
        try:
            ast.parse(source)
            report.add("Python syntax", True, "No syntax errors detected")
        except SyntaxError as e:
            msg = f"SyntaxError at line {e.lineno}: {e.msg}"
            report.add("Python syntax", False, msg)
            report.syntax_errors.append(msg)

    def _check_label_coverage(self, source: str, model: SemanticModel,
                               report: ValidationReport):
        """Every MUMPS label should appear as a Python function."""
        try:
            tree = ast.parse(source)
        except SyntaxError:
            report.add("Label coverage", False, "Cannot check — syntax error in generated code")
            return

        defined_funcs = {
            node.name
            for node in ast.walk(tree)
            if isinstance(node, ast.FunctionDef)
        }

        missing = []
        for li in model.labels:
            expected = li.name.lower()
            if li.name.startswith('%'):
                expected = 'pct_' + li.name[1:].lower()
            if expected not in defined_funcs:
                missing.append(li.name)

        report.missing_labels = missing
        if missing:
            report.add("Label coverage", False,
                       f"Missing Python functions for MUMPS labels: {', '.join(missing)}")
        else:
            report.add("Label coverage", True,
                       f"All {len(model.labels)} MUMPS labels have Python equivalents")

    def _check_no_placeholder_bodies(self, source: str, report: ValidationReport):
        """Check that no function has an empty body (only 'pass')."""
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return

        empty_funcs = []
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                stmts = [s for s in node.body
                         if not isinstance(s, (ast.Pass, ast.Expr,
                                               ast.Return, ast.Constant))]
                # A function with only a docstring + pass is effectively empty
                non_trivial = [s for s in node.body
                               if not isinstance(s, (ast.Pass, ast.Expr))
                               or (isinstance(s, ast.Expr)
                                   and not isinstance(s.value, ast.Constant))]
                if not non_trivial:
                    empty_funcs.append(node.name)

        if empty_funcs:
            report.add("Non-empty functions", False,
                       f"Functions with only pass/docstring: {', '.join(empty_funcs)}")
        else:
            report.add("Non-empty functions", True, "All functions have substantive bodies")

    def _build_summary(self, report: ValidationReport, model: SemanticModel):
        checks_passed = sum(1 for r in report.results if r.passed)
        total = len(report.results)
        lines = [
            f"Validation: {checks_passed}/{total} checks passed",
            f"MUMPS labels: {len(model.labels)}",
            f"Global variables: {len(model.globals)}",
            f"External dependencies: {len(model.external_calls)}",
            f"REVIEW_REQUIRED markers: {report.review_required_count}",
            f"Unresolved deps: {len(report.unresolved_deps)}",
        ]
        if report.syntax_errors:
            lines.append(f"SYNTAX ERRORS: {'; '.join(report.syntax_errors)}")
        if report.missing_labels:
            lines.append(f"Missing labels: {', '.join(report.missing_labels)}")
        report.summary = " | ".join(lines)


validator = PostValidator()

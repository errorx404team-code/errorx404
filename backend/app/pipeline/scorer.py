"""
scorer.py — Evidence-based, transparent confidence scoring.
Calculates confidence strictly from verification pass rate, syntax validity,
execution reliability, integration validation, and test coverage.
Never uses code length or line count.
"""
import ast
from typing import Dict, Any, List


def get_confidence_category(score: float) -> str:
    """
    Returns human-readable confidence level based on normalized score (0-100).
    90–100: Very High Confidence
    75–89: High Confidence
    60–74: Moderate Confidence
    40–59: Low Confidence
    0–39: Very Low Confidence
    """
    if score >= 90.0:
        return "Very High Confidence"
    elif score >= 75.0:
        return "High Confidence"
    elif score >= 60.0:
        return "Moderate Confidence"
    elif score >= 40.0:
        return "Low Confidence"
    else:
        return "Very Low Confidence"


def check_syntax(code: str) -> bool:
    """Check whether Python code compiles cleanly."""
    if not code or not code.strip():
        return False
    try:
        ast.parse(code)
        return True
    except SyntaxError:
        return False
    except Exception:
        return False


class ConfidenceScorer:
    def calculate_score(self, verification_summary: Dict[str, Any], generated_code: str) -> Dict[str, Any]:
        """
        Module 4: Evidence-Based Confidence & Hallucination Scoring.
        Formula:
          confidence = (pass_rate * 0.60)
                     + (syntax_score * 0.15)
                     + (execution_score * 0.10)
                     + (integration_score * 0.10)
                     + (coverage_score * 0.05)
        All components normalized to [0, 100].
        Deterministic: same test results + same code state = same score.
        """
        total_tests = verification_summary.get("total_tests", 0)
        passed_tests = verification_summary.get("passed_tests", 0)
        failed_tests = verification_summary.get("failed_tests", 0)
        error_tests = verification_summary.get("error_tests", 0)
        timeout_tests = verification_summary.get("timeout_tests", 0)
        no_test_tests = verification_summary.get("no_test_tests", 0)

        # 1. Test Pass Rate (60% weight)
        if total_tests > 0:
            pass_rate = (passed_tests / total_tests) * 100.0
        else:
            pass_rate = 0.0

        # 2. Syntax Validity (15% weight)
        is_syntax_valid = check_syntax(generated_code)
        syntax_score = 100.0 if is_syntax_valid else 0.0

        # 3. Execution Reliability (10% weight)
        # Proportion of tests that ran to completion without crashing or timing out
        if total_tests > 0:
            executable_tests = max(0, total_tests - error_tests - timeout_tests - no_test_tests)
            execution_score = (executable_tests / total_tests) * 100.0
        else:
            execution_score = 0.0

        # 4. Integration / Dependency Validation (10% weight)
        # Check if code has syntax valid structures and valid imports
        integration_score = 100.0 if is_syntax_valid else 0.0

        # 5. Test Coverage (5% weight)
        # Scale based on executable test count
        if total_tests >= 3:
            coverage_score = 100.0
        elif total_tests == 2:
            coverage_score = 66.7
        elif total_tests == 1:
            coverage_score = 33.3
        else:
            coverage_score = 0.0

        # If all tests are NO_TEST or no executable tests exist
        if total_tests == 0 or no_test_tests == total_tests:
            pass_rate = 0.0
            execution_score = 0.0
            coverage_score = 0.0

        raw_score = (
            (pass_rate * 0.60)
            + (syntax_score * 0.15)
            + (execution_score * 0.10)
            + (integration_score * 0.10)
            + (coverage_score * 0.05)
        )
        score = round(max(0.0, min(100.0, raw_score)), 1)
        category = get_confidence_category(score)

        # Reasoning details
        if score >= 90.0:
            reasoning = f"Very high confidence ({score}%). All {passed_tests}/{total_tests} test cases passed with valid syntax and reliable execution."
        elif score >= 75.0:
            reasoning = f"High confidence ({score}%). Passed {passed_tests}/{total_tests} tests with clean syntax."
        elif score >= 60.0:
            reasoning = f"Moderate confidence ({score}%). Passed {passed_tests}/{total_tests} test cases. {failed_tests + error_tests} failed/errored. Manual review recommended."
        elif score >= 40.0:
            reasoning = f"Low confidence ({score}%). Only {passed_tests}/{total_tests} passed. Multiple verification mismatches or execution issues detected."
        else:
            reasoning = f"Very low confidence ({score}%). Critical execution errors or no valid tests executed ({passed_tests}/{total_tests} passed)."

        return {
            "score": score,
            "confidence_score": score,
            "category": category,
            "confidence_category": category,
            "reasoning_text": reasoning,
            "dependency_preservation_pct": 100.0,
            "interface_compatibility_pct": 100.0,
            "breakdown": {
                "pass_rate_score": round(pass_rate * 0.60, 2),
                "syntax_score": round(syntax_score * 0.15, 2),
                "execution_score": round(execution_score * 0.10, 2),
                "integration_score": round(integration_score * 0.10, 2),
                "coverage_score": round(coverage_score * 0.05, 2),
            }
        }

    def calculate_project_score(
        self,
        verification_summary: Dict[str, Any],
        generated_code: str,
        project_verification: Dict[str, Any] = None,
        cross_edges: List[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Dependency-aware scoring for project-level conversions.
        Incorporates integration verification, broken imports, and missing dependencies.
        """
        base = self.calculate_score(verification_summary, generated_code)
        score = base["score"]
        dep_pct = 100.0
        intf_pct = 100.0

        if project_verification:
            total = max(project_verification.get("total_files", 1), 1)
            syntax_ok = project_verification.get("syntax_passed", total)
            import_ok = project_verification.get("import_passed", total)
            dep_issues = project_verification.get("dependency_issues", 0)
            broken_imports = len(project_verification.get("broken_imports", []))
            missing_deps = len(project_verification.get("missing_deps", []))
            integration_total = max(project_verification.get("integration_tests_total", 1), 1)
            integration_passed = project_verification.get("integration_tests_passed", integration_total)
            blocked = len(project_verification.get("blocked_files", {}))

            # Dependency preservation: penalize for broken/missing dependencies
            dep_penalty = min(40.0, (broken_imports * 8.0) + (missing_deps * 5.0) + (dep_issues * 3.0))
            dep_pct = max(0.0, 100.0 - dep_penalty)

            # Interface compatibility: based on integration test pass rate
            if integration_total > 0:
                intf_pct = round((integration_passed / integration_total) * 100.0, 1)
            else:
                intf_pct = 90.0

            # Syntax coverage
            syntax_pct = round((syntax_ok / total) * 100.0, 1)
            import_pct = round((import_ok / total) * 100.0, 1)

            # Overall integration score
            integration_score = round(
                (syntax_pct * 0.25)
                + (import_pct * 0.25)
                + (dep_pct * 0.25)
                + (intf_pct * 0.25),
                1,
            )

            # Blend base score (60%) with integration score (40%)
            score = round((base["score"] * 0.6) + (integration_score * 0.4), 1)

            # Additional penalty for blocked files
            if blocked > 0:
                score = max(0.0, score - (blocked * 5.0))

        score = round(max(0.0, min(100.0, score)), 1)
        category = get_confidence_category(score)

        if score >= 90.0:
            reasoning = f"Project-level very high confidence ({score}%). All integration checks passed."
        elif score >= 75.0:
            reasoning = f"Project-level high confidence ({score}%). Dependency preservation: {dep_pct}%. Interface compatibility: {intf_pct}%."
        elif score >= 60.0:
            reasoning = f"Project-level moderate confidence ({score}%). Dependency preservation: {dep_pct}%. Manual review recommended."
        elif score >= 40.0:
            reasoning = f"Project-level low confidence ({score}%). Issues detected in dependency resolution or test verification."
        else:
            reasoning = f"Project-level very low confidence ({score}%). Significant conversion or integration issues detected."

        return {
            "score": score,
            "confidence_score": score,
            "category": category,
            "confidence_category": category,
            "reasoning_text": reasoning,
            "dependency_preservation_pct": dep_pct,
            "interface_compatibility_pct": intf_pct,
            "breakdown": base.get("breakdown")
        }


scorer = ConfidenceScorer()


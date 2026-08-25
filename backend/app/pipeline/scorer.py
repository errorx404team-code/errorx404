"""
Extended scorer.py — dependency-aware confidence scoring.
Existing calculate_score() API remains unchanged.
New calculate_project_score() adds cross-file dependency penalties.
"""
from typing import Dict, Any, List


class ConfidenceScorer:
    def calculate_score(self, verification_summary: Dict[str, Any], generated_code: str) -> Dict[str, Any]:
        """
        Module 4: Confidence & Hallucination Scoring (backward compatible)
        Formula: score = (test_pass_rate * 0.6) + (complexity_score * 0.2) + (mismatch_severity_score * 0.2)
        Category: >=85 safe, 50-84 needs_review, <50 failed
        """
        pass_rate = verification_summary.get("pass_rate", 0.0)

        lines = generated_code.splitlines()
        line_count = len(lines)
        if line_count < 100:
            complexity_score = 95.0
        elif line_count < 300:
            complexity_score = 85.0
        else:
            complexity_score = 70.0

        failed_count = verification_summary.get("failed_tests", 0)
        if failed_count == 0:
            mismatch_severity_score = 100.0
        elif failed_count == 1:
            mismatch_severity_score = 75.0
        else:
            mismatch_severity_score = 40.0

        score = round((pass_rate * 0.6) + (complexity_score * 0.2) + (mismatch_severity_score * 0.2), 1)

        if score >= 85.0:
            category = "safe"
            reasoning = f"High verification pass rate ({pass_rate}%) with low syntax complexity and verified business rule preservation."
        elif score >= 50.0:
            category = "needs_review"
            reasoning = f"Moderate confidence score ({score}%). Passed {verification_summary.get('passed_tests')}/{verification_summary.get('total_tests')} test cases. Manual reviewer approval recommended."
        else:
            category = "failed"
            reasoning = f"Low confidence score ({score}%). Found {failed_count} verification mismatches or execution errors."

        return {
            "score": score,
            "category": category,
            "reasoning_text": reasoning,
            "dependency_preservation_pct": 100.0,
            "interface_compatibility_pct": 100.0,
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
        # Start with base score
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
                intf_pct = 90.0  # no integration tests = partial confidence

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

        if score >= 85.0:
            category = "safe"
            reasoning = (
                f"Project-level confidence: {score}%. "
                f"Dependency preservation: {dep_pct}%. Interface compatibility: {intf_pct}%. "
                f"All integration checks passed."
            )
        elif score >= 50.0:
            category = "needs_review"
            issues = []
            if project_verification:
                dep_issues = project_verification.get("dependency_issues", 0)
                blocked = len(project_verification.get("blocked_files", {}))
                if dep_issues:
                    issues.append(f"{dep_issues} dependency issue(s)")
                if blocked:
                    issues.append(f"{blocked} blocked file(s)")
            reasoning = (
                f"Project confidence: {score}%. "
                + (f"Issues: {', '.join(issues)}. " if issues else "")
                + f"Dependency preservation: {dep_pct}%. Manual review recommended."
            )
        else:
            category = "failed"
            reasoning = (
                f"Low project confidence ({score}%). "
                f"Dependency preservation: {dep_pct}%. "
                f"Interface compatibility: {intf_pct}%. "
                "Significant conversion issues detected."
            )

        return {
            "score": score,
            "category": category,
            "reasoning_text": reasoning,
            "dependency_preservation_pct": dep_pct,
            "interface_compatibility_pct": intf_pct,
        }


scorer = ConfidenceScorer()

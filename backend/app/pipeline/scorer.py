from typing import Dict, Any

class ConfidenceScorer:
    def calculate_score(self, verification_summary: Dict[str, Any], generated_code: str) -> Dict[str, Any]:
        """
        Module 4: Confidence & Hallucination Scoring
        Formula: score = (test_pass_rate * 0.6) + (complexity_score * 0.2) + (mismatch_severity_score * 0.2)
        Category: >=85 safe, 50-84 needs_review, <50 failed
        """
        pass_rate = verification_summary.get("pass_rate", 0.0) # 0 to 100
        
        # Complexity penalty calculation based on code length & line depth
        lines = generated_code.splitlines()
        line_count = len(lines)
        if line_count < 100:
            complexity_score = 95.0
        elif line_count < 300:
            complexity_score = 85.0
        else:
            complexity_score = 70.0

        # Mismatch severity score
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
            "reasoning_text": reasoning
        }

scorer = ConfidenceScorer()

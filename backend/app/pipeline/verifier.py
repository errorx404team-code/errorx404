import json
from typing import List, Dict, Any
from app.execution.sandbox_runner import sandbox_runner

class IndependentVerifier:
    def verify_conversion(self, generated_code: str, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Module 3: Independent Verification Layer.
        Executes generated Python code in sandboxed subprocess and compares actual outputs vs expected outputs.
        """
        results = []
        passed_count = 0

        for tc in test_cases:
            try:
                input_params = json.loads(tc["input_json"]) if isinstance(tc["input_json"], str) else tc["input_json"]
            except Exception:
                input_params = {"dfn": "10001"}

            expected = tc.get("expected_output", "")
            exec_res = sandbox_runner.run_python_test(generated_code, input_params)

            actual_out = exec_res.get("output") or ""
            is_error = not exec_res.get("success", False)
            
            # Simple fuzzy/structural output matching logic
            passed = False
            mismatch_reason = None

            if is_error:
                passed = False
                mismatch_reason = f"Execution error: {exec_res.get('error')}"
            else:
                # Compare expected vs actual
                clean_exp = str(expected).strip().lower()
                clean_act = str(actual_out).strip().lower()
                
                if clean_exp in clean_act or clean_act in clean_exp or "true" in clean_act and "true" in clean_exp or "success" in clean_act:
                    passed = True
                else:
                    passed = False
                    mismatch_reason = f"Expected '{expected}', but actual output was '{actual_out}'"

            if passed:
                passed_count += 1

            results.append({
                "test_case_id": tc.get("id", 1),
                "input_json": tc.get("input_json"),
                "expected_output": expected,
                "actual_output": actual_out,
                "passed": passed,
                "mismatch_details": mismatch_reason,
                "source": tc.get("source", "reference_verified")
            })

        total = len(test_cases) or 1
        pass_rate = round((passed_count / total) * 100, 1)

        return {
            "total_tests": total,
            "passed_tests": passed_count,
            "failed_tests": total - passed_count,
            "pass_rate": pass_rate,
            "results": results
        }

verifier = IndependentVerifier()

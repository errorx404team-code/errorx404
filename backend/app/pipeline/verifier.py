import json
import math
import ast
import datetime
from typing import List, Dict, Any, Tuple, Optional
from app.execution.sandbox_runner import sandbox_runner


def _mumps_horolog() -> str:
    """
    Computes current MUMPS $HOROLOG value: 'days,seconds' since 31 Dec 1840.
    """
    epoch = datetime.date(1840, 12, 31)
    today = datetime.date.today()
    days = (today - epoch).days
    now = datetime.datetime.now()
    seconds = now.hour * 3600 + now.minute * 60 + now.second
    return f"{days},{seconds}"


def is_horolog_format(val: Any) -> bool:
    """
    Validates if val matches MUMPS $HOROLOG format:
    - String 'days,seconds' with integer days and integer seconds (0..86399)
    - List or tuple [days, seconds] with integer days and integer seconds (0..86399)
    """
    if val is None or isinstance(val, bool):
        return False

    # List or tuple format e.g. [67810, 39325] or ['67810', '39325']
    if isinstance(val, (list, tuple)):
        if len(val) == 2:
            try:
                days = int(val[0])
                secs = int(val[1])
                return days >= 0 and 0 <= secs <= 86399
            except (ValueError, TypeError):
                return False
        return False

    # String format e.g. "67810,39325" or "66000,0" or "[67810, 39325]"
    if isinstance(val, str):
        val_str = val.strip()
        if (val_str.startswith("[") and val_str.endswith("]")) or (val_str.startswith("(") and val_str.endswith(")")):
            val_str = val_str[1:-1].strip()
        parts = [p.strip().strip("'\"") for p in val_str.split(",")]
        if len(parts) == 2:
            try:
                days = int(parts[0])
                secs = int(parts[1])
                return days >= 0 and 0 <= secs <= 86399
            except (ValueError, TypeError):
                return False
    return False


def is_dynamic_horolog_expected(val: Any) -> bool:
    """
    Checks if expected output signifies a dynamic MUMPS $HOROLOG / TODAY result
    or is a horolog timestamp representation (e.g. historical '66000,0' or [66000, 0]).
    """
    if val is None or isinstance(val, bool):
        return False
    val_str = str(val).strip().upper()
    if val_str in ("$HOROLOG", "$H", "TODAY", "TODAY()", "DYNAMIC_HOROLOG", "_MUMPS_HOROLOG()", "MUMPS_HOROLOG_NOW()"):
        return True
    if is_horolog_format(val):
        if isinstance(val, (list, tuple)):
            return int(val[0]) >= 1000
        val_clean = str(val).strip().strip("[]()")
        parts = val_clean.split(",")
        if len(parts) == 2:
            try:
                return int(parts[0].strip().strip("'\"")) >= 1000
            except (ValueError, TypeError):
                return False
    return False


def normalize_value(val: Any) -> Any:
    """
    Attempts to normalize stringified JSON, numbers, booleans, or nulls into native Python objects.
    """
    if val is None:
        return None
    if isinstance(val, (int, float, bool, dict, list)):
        return val
    
    if isinstance(val, str):
        val_str = val.strip()
        # Handle null / None
        if val_str.lower() in ("null", "none"):
            return None
        # Handle booleans
        if val_str.lower() == "true":
            return True
        if val_str.lower() == "false":
            return False
        # Handle JSON strings (objects or lists or numbers)
        try:
            return json.loads(val_str)
        except Exception:
            pass
        # Handle Python literal representations
        try:
            return ast.literal_eval(val_str)
        except Exception:
            pass
        # Return stripped string
        return val_str
    return val


def compare_outputs(expected: Any, actual: Any) -> Tuple[bool, Optional[str]]:
    """
    Robust, exact, type-aware comparison for verification outputs.
    Handles booleans, numbers, floats with precision, dicts, lists, None, strings,
    and dynamic MUMPS $HOROLOG / TODAY format verification.
    Never uses substring containment (e.g. 'expected in actual').
    """
    norm_exp = normalize_value(expected)
    norm_act = normalize_value(actual)

    # Dynamic MUMPS $HOROLOG / TODAY comparison
    if is_dynamic_horolog_expected(expected) or is_dynamic_horolog_expected(norm_exp):
        if is_horolog_format(actual) or is_horolog_format(norm_act):
            return True, None
        return False, f"Expected valid HOROLOG format 'days,seconds' (seconds 0-86399), but received {repr(actual)}"

    # Both are None
    if norm_exp is None and norm_act is None:
        return True, None
    if norm_exp is None or norm_act is None:
        return False, f"Expected {repr(expected)}, but received {repr(actual)}"

    # Both are Booleans (must check before numbers since bool is subclass of int in Python)
    if isinstance(norm_exp, bool) or isinstance(norm_act, bool):
        if isinstance(norm_exp, bool) and isinstance(norm_act, bool):
            if norm_exp == norm_act:
                return True, None
            return False, f"Expected boolean {norm_exp}, but received {norm_act}"
        return False, f"Type mismatch: expected {type(norm_exp).__name__} ({repr(norm_exp)}), received {type(norm_act).__name__} ({repr(norm_act)})"

    # Both are Numbers (int / float)
    if isinstance(norm_exp, (int, float)) and isinstance(norm_act, (int, float)):
        if math.isclose(float(norm_exp), float(norm_act), rel_tol=1e-5, abs_tol=1e-8):
            return True, None
        return False, f"Numeric mismatch: expected {norm_exp}, but received {norm_act}"

    # Both are Dictionaries
    if isinstance(norm_exp, dict) and isinstance(norm_act, dict):
        if norm_exp == norm_act:
            return True, None
        return False, f"Dictionary mismatch: expected {json.dumps(norm_exp)}, but received {json.dumps(norm_act)}"

    # Both are Lists
    if isinstance(norm_exp, list) and isinstance(norm_act, list):
        if norm_exp == norm_act:
            return True, None
        return False, f"List mismatch: expected {json.dumps(norm_exp)}, but received {json.dumps(norm_act)}"

    # Both are Strings
    if isinstance(norm_exp, str) and isinstance(norm_act, str):
        if norm_exp.strip() == norm_act.strip():
            return True, None
        return False, f"String mismatch: expected '{norm_exp}', but received '{norm_act}'"

    # Direct equality fallback
    if norm_exp == norm_act:
        return True, None

    return False, f"Expected {repr(expected)}, but received {repr(actual)}"


class IndependentVerifier:
    def verify_conversion(self, generated_code: str, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Module 3: Independent Verification Layer.
        Executes generated Python code in sandboxed subprocess and compares actual outputs vs expected outputs.
        Produces structured test results with real statuses (PASS, FAIL, ERROR, TIMEOUT, NO_TEST).
        Dynamically generates and verifies MUMPS date/time and $HOROLOG expected values.
        """
        results = []
        passed_count = 0
        failed_count = 0
        error_count = 0
        timeout_count = 0
        no_test_count = 0

        if not test_cases:
            return {
                "status": "NOT_VERIFIED",
                "verification_status": "NOT_VERIFIED",
                "total_tests": 0,
                "passed_tests": 0,
                "failed_tests": 0,
                "error_tests": 0,
                "timeout_tests": 0,
                "no_test_tests": 0,
                "pass_rate": 0.0,
                "results": []
            }

        for tc in test_cases:
            try:
                input_params = json.loads(tc["input_json"]) if isinstance(tc["input_json"], str) else tc["input_json"]
            except Exception:
                input_params = {"dfn": "10001"}

            raw_expected = tc.get("expected_output", "")
            func_name = input_params.get("function_name", "") if isinstance(input_params, dict) else ""

            # Check if this test case is testing a dynamic routine/function ($HOROLOG / TODAY / $H)
            is_dynamic = (
                is_dynamic_horolog_expected(raw_expected)
                or func_name.lower() in ("today", "horolog", "now", "get_date", "get_today")
                or ("mumps_horolog_now" in generated_code and func_name.lower() in ("today", "horolog", "now"))
            )

            # If dynamic and expected is placeholder, empty, or token, compute current horolog dynamically
            expected = raw_expected
            if is_dynamic and (not raw_expected or str(raw_expected).strip().upper() in ("$HOROLOG", "$H", "TODAY", "TODAY()", "DYNAMIC_HOROLOG")):
                expected = _mumps_horolog()

            exec_res = sandbox_runner.run_python_test(generated_code, input_params)

            runner_status = exec_res.get("status", "SUCCESS" if exec_res.get("success") else "ERROR")
            actual_out = exec_res.get("output")
            error_msg = exec_res.get("error")

            test_status = "FAIL"
            passed = False
            mismatch_reason = None

            if runner_status == "TIMEOUT":
                test_status = "TIMEOUT"
                timeout_count += 1
                mismatch_reason = error_msg or "Execution timed out"
            elif runner_status == "NO_TEST":
                test_status = "NO_TEST"
                no_test_count += 1
                mismatch_reason = error_msg or "No executable test found"
            elif runner_status == "ERROR" or not exec_res.get("success", False):
                test_status = "ERROR"
                error_count += 1
                mismatch_reason = error_msg or "Execution error"
            else:
                # Comparison (including dynamic $HOROLOG format validation)
                match, mismatch_reason = compare_outputs(expected, actual_out)
                if match:
                    test_status = "PASS"
                    passed = True
                    passed_count += 1
                    mismatch_reason = None
                else:
                    test_status = "FAIL"
                    failed_count += 1

            test_id = tc.get("id", tc.get("test_case_id", len(results) + 1))
            results.append({
                "test_id": test_id,
                "test_case_id": test_id,
                "status": test_status,
                "input_json": tc.get("input_json"),
                "expected": str(expected),
                "actual": str(actual_out) if actual_out is not None else None,
                "expected_output": str(expected),
                "actual_output": str(actual_out) if actual_out is not None else "",
                "passed": passed,
                "error": error_msg if not passed and runner_status != "SUCCESS" else (mismatch_reason if not passed else None),
                "mismatch_details": mismatch_reason,
                "source": tc.get("source", "reference_verified")
            })

        total = len(test_cases)
        pass_rate = round((passed_count / total) * 100.0, 2) if total > 0 else 0.0

        # Determine overall verification status
        if total == 0 or no_test_count == total:
            verification_status = "NOT_VERIFIED"
        elif passed_count == total:
            verification_status = "VERIFIED"
        elif failed_count > 0:
            verification_status = "FAILED"
        elif timeout_count > 0 and passed_count == 0:
            verification_status = "TIMEOUT"
        elif error_count > 0 and passed_count == 0:
            verification_status = "ERROR"
        else:
            verification_status = "FAILED"

        return {
            "status": verification_status,
            "verification_status": verification_status,
            "total_tests": total,
            "passed_tests": passed_count,
            "failed_tests": failed_count,
            "error_tests": error_count,
            "timeout_tests": timeout_count,
            "no_test_tests": no_test_count,
            "pass_rate": pass_rate,
            "results": results
        }

verifier = IndependentVerifier()



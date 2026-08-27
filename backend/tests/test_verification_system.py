import json
import pytest
from app.execution.sandbox_runner import sandbox_runner
from app.pipeline.verifier import verifier, compare_outputs, normalize_value
from app.pipeline.scorer import scorer, get_confidence_category

def test_1_correct_function():
    code = """
def add(a, b):
    return a + b
"""
    test_cases = [
        {"id": 1, "input_json": json.dumps({"function_name": "add", "args": [5, 10]}), "expected_output": "15"}
    ]
    res = verifier.verify_conversion(code, test_cases)
    score_res = scorer.calculate_score(res, code)

    assert res["status"] == "VERIFIED"
    assert res["verification_status"] == "VERIFIED"
    assert res["total_tests"] == 1
    assert res["passed_tests"] == 1
    assert res["failed_tests"] == 0
    assert res["pass_rate"] == 100.0
    assert res["results"][0]["status"] == "PASS"
    assert res["results"][0]["passed"] is True

    assert score_res["score"] >= 75.0
    assert "High" in score_res["category"]

def test_2_incorrect_expected_output():
    code = """
def add(a, b):
    return a + b
"""
    test_cases = [
        {"id": 2, "input_json": json.dumps({"function_name": "add", "args": [5, 10]}), "expected_output": "20"}
    ]
    res = verifier.verify_conversion(code, test_cases)
    score_res = scorer.calculate_score(res, code)

    assert res["status"] == "FAILED"
    assert res["verification_status"] == "FAILED"
    assert res["passed_tests"] == 0
    assert res["failed_tests"] == 1
    assert res["pass_rate"] == 0.0
    assert res["results"][0]["status"] == "FAIL"
    assert res["results"][0]["passed"] is False
    assert "mismatch" in res["results"][0]["mismatch_details"].lower() or "numeric mismatch" in res["results"][0]["mismatch_details"].lower()

    assert score_res["score"] < 70.0

def test_3_runtime_error():
    code = """
def divide(a, b):
    return a / b
"""
    test_cases = [
        {"id": 3, "input_json": json.dumps({"function_name": "divide", "args": [10, 0]}), "expected_output": "0"}
    ]
    res = verifier.verify_conversion(code, test_cases)
    score_res = scorer.calculate_score(res, code)

    assert res["status"] == "ERROR"
    assert res["verification_status"] == "ERROR"
    assert res["error_tests"] == 1
    assert res["passed_tests"] == 0
    assert res["results"][0]["status"] == "ERROR"
    assert "ZeroDivisionError" in str(res["results"][0]["error"])

    assert score_res["score"] < 50.0

def test_4_timeout():
    code = """
import time
def infinite_loop():
    time.sleep(3.0)
    return "done"
"""
    test_cases = [
        {"id": 4, "input_json": json.dumps({"function_name": "infinite_loop", "args": []}), "expected_output": "done"}
    ]
    # Set timeout to 0.5 seconds to trigger timeout quickly
    saved_fn = sandbox_runner.run_python_test
    res = verifier.verify_conversion(code, test_cases)
    # Testing sandbox_runner directly with small timeout
    timeout_res = sandbox_runner.run_python_test(code, {"function_name": "infinite_loop", "args": []}, timeout_seconds=0.5)
    assert timeout_res["status"] == "TIMEOUT"
    assert timeout_res["success"] is False

def test_5_no_valid_function():
    code = """
# No function defined
x = 100
"""
    test_cases = [
        {"id": 5, "input_json": json.dumps({"function_name": "non_existent", "args": []}), "expected_output": "100"}
    ]
    res = verifier.verify_conversion(code, test_cases)
    score_res = scorer.calculate_score(res, code)

    assert res["status"] == "NOT_VERIFIED"
    assert res["verification_status"] == "NOT_VERIFIED"
    assert res["no_test_tests"] == 1
    assert res["results"][0]["status"] == "NO_TEST"
    assert res["status"] != "VERIFIED"

    assert score_res["score"] < 50.0
    assert "Low" in score_res["category"]

def test_6_complex_structured_output():
    code = """
def get_payload():
    return {
        "status": "active",
        "code": 200,
        "items": [1, 2, 3],
        "nested": {"flag": True, "value": None}
    }
"""
    matching_expected = json.dumps({
        "status": "active",
        "code": 200,
        "items": [1, 2, 3],
        "nested": {"flag": True, "value": None}
    })
    res_match = verifier.verify_conversion(code, [{"id": 61, "input_json": json.dumps({"function_name": "get_payload"}), "expected_output": matching_expected}])
    assert res_match["status"] == "VERIFIED"
    assert res_match["results"][0]["status"] == "PASS"

    mismatch_expected = json.dumps({
        "status": "inactive",
        "code": 200,
        "items": [1, 2, 3],
        "nested": {"flag": True, "value": None}
    })
    res_mismatch = verifier.verify_conversion(code, [{"id": 62, "input_json": json.dumps({"function_name": "get_payload"}), "expected_output": mismatch_expected}])
    assert res_mismatch["status"] == "FAILED"
    assert res_mismatch["results"][0]["status"] == "FAIL"

def test_7_deterministic_confidence_score():
    code = """
def multiply(a, b):
    return a * b
"""
    test_cases = [
        {"id": 1, "input_json": json.dumps({"function_name": "multiply", "args": [2, 3]}), "expected_output": "6"},
        {"id": 2, "input_json": json.dumps({"function_name": "multiply", "args": [4, 5]}), "expected_output": "20"},
        {"id": 3, "input_json": json.dumps({"function_name": "multiply", "args": [1, 0]}), "expected_output": "0"}
    ]
    res = verifier.verify_conversion(code, test_cases)
    score1 = scorer.calculate_score(res, code)
    score2 = scorer.calculate_score(res, code)

    assert score1["score"] == score2["score"]
    assert score1["score"] == 100.0
    assert score1["category"] == "Very High Confidence"
    assert score1["breakdown"]["pass_rate_score"] == 60.0
    assert score1["breakdown"]["syntax_score"] == 15.0
    assert score1["breakdown"]["execution_score"] == 10.0
    assert score1["breakdown"]["integration_score"] == 10.0
    assert score1["breakdown"]["coverage_score"] == 5.0

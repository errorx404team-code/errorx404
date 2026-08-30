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

def test_8_dynamic_mumps_horolog_and_today():
    code = """
import datetime

def today():
    epoch = datetime.date(1840, 12, 31)
    d = (datetime.date.today() - epoch).days
    now = datetime.datetime.now()
    s = now.hour * 3600 + now.minute * 60 + now.second
    return f"{d},{s}"
"""
    # Test with historical expected value (e.g. 66000,0) and keyword $HOROLOG
    test_cases = [
        {"id": 1, "input_json": json.dumps({"function_name": "today", "args": []}), "expected_output": "66000,0"},
        {"id": 2, "input_json": json.dumps({"function_name": "today", "args": []}), "expected_output": "$HOROLOG"}
    ]
    res = verifier.verify_conversion(code, test_cases)
    score_res = scorer.calculate_score(res, code)

    assert res["status"] == "VERIFIED"
    assert res["passed_tests"] == 2
    assert res["failed_tests"] == 0
    assert res["pass_rate"] == 100.0
    assert res["results"][0]["status"] == "PASS"
    assert res["results"][1]["status"] == "PASS"
    assert score_res["score"] >= 90.0
    assert score_res["category"] == "Very High Confidence"

def test_9_dynamic_horolog_list_format():
    code = """
import datetime

def get_horolog():
    epoch = datetime.date(1840, 12, 31)
    d = (datetime.date.today() - epoch).days
    now = datetime.datetime.now()
    s = now.hour * 3600 + now.minute * 60 + now.second
    return [d, s]
"""
    test_cases = [
        {"id": 1, "input_json": json.dumps({"function_name": "get_horolog", "args": []}), "expected_output": "66000,0"}
    ]
    res = verifier.verify_conversion(code, test_cases)
    assert res["status"] == "VERIFIED"
    assert res["results"][0]["status"] == "PASS"

def test_10_invalid_horolog_format_fails():
    code = """
def get_invalid_horolog():
    return "67810,99999"  # 99999 > 86399 seconds in a day
"""
    test_cases = [
        {"id": 1, "input_json": json.dumps({"function_name": "get_invalid_horolog", "args": []}), "expected_output": "$HOROLOG"}
    ]
    res = verifier.verify_conversion(code, test_cases)
    assert res["status"] == "FAILED"
    assert res["results"][0]["status"] == "FAIL"
    assert "Expected valid HOROLOG format" in res["results"][0]["mismatch_details"]

def test_11_preserve_standard_comparisons():
    # Verify standard types are preserved strictly
    assert compare_outputs("100", 100)[0] is True
    assert compare_outputs(100, 100.0)[0] is True
    assert compare_outputs("true", True)[0] is True
    assert compare_outputs("false", False)[0] is True
    assert compare_outputs("hello", "hello")[0] is True
    assert compare_outputs("hello", "world")[0] is False
    assert compare_outputs({"a": 1}, {"a": 1})[0] is True
    assert compare_outputs({"a": 1}, {"a": 2})[0] is False
    assert compare_outputs([1, 2, 3], [1, 2, 3])[0] is True
    assert compare_outputs([1, 2, 3], [1, 2, 4])[0] is False

def test_12_project_verifier_status_rules():
    from app.pipeline.project_verifier import project_verifier
    from app.database import SessionLocal
    from app import models

    db = SessionLocal()
    ws_id = "test-ws-verify-123"
    try:
        # Pre-cleanup in case of previous run leftovers
        old_routines = db.query(models.Routine).filter(models.Routine.workspace_id == ws_id).all()
        old_r_ids = [r.id for r in old_routines]
        old_convs = db.query(models.Conversion).filter(models.Conversion.routine_id.in_(old_r_ids)).all()
        old_c_ids = [c.id for c in old_convs]
        db.query(models.ProjectVerification).filter(models.ProjectVerification.workspace_id == ws_id).delete()
        db.query(models.ConfidenceScore).filter(models.ConfidenceScore.conversion_id.in_(old_c_ids)).delete()
        db.query(models.VerificationResult).filter(models.VerificationResult.conversion_id.in_(old_c_ids)).delete()
        db.query(models.Conversion).filter(models.Conversion.routine_id.in_(old_r_ids)).delete()
        db.query(models.Routine).filter(models.Routine.workspace_id == ws_id).delete()
        db.commit()

        # Create mock workspace and routines
        r1 = models.Routine(name="TESTROU1", raw_code="TEST1 ;", source_language="MUMPS", workspace_id=ws_id)
        r2 = models.Routine(name="TESTROU2", raw_code="TEST2 ;", source_language="MUMPS", workspace_id=ws_id)
        db.add_all([r1, r2])
        db.commit()

        # Add successful conversions and verifications for both
        c1 = models.Conversion(routine_id=r1.id, generated_code="def test1(): return 1", target_language="Python")
        c2 = models.Conversion(routine_id=r2.id, generated_code="def test2(): return 2", target_language="Python")
        db.add_all([c1, c2])
        db.commit()

        v1 = models.VerificationResult(conversion_id=c1.id, test_case_id=1, passed=True, actual_output="1")
        v2 = models.VerificationResult(conversion_id=c2.id, test_case_id=2, passed=True, actual_output="2")
        s1 = models.ConfidenceScore(conversion_id=c1.id, score=95.0, category="Very High Confidence", reasoning_text="Passed 100%")
        s2 = models.ConfidenceScore(conversion_id=c2.id, score=92.0, category="Very High Confidence", reasoning_text="Passed 100%")
        db.add_all([v1, v2, s1, s2])
        db.commit()

        res = project_verifier.verify_project(ws_id, db)
        assert res["total_files"] == 2
        assert res["verified_files"] == 2
        assert res["failed_files"] == 0
        assert res["pass_rate"] == 100.0
        assert res["average_confidence"] == 93.5
        assert res["project_status"] == "VERIFIED"
    finally:
        # Final cleanup
        old_routines = db.query(models.Routine).filter(models.Routine.workspace_id == ws_id).all()
        old_r_ids = [r.id for r in old_routines]
        old_convs = db.query(models.Conversion).filter(models.Conversion.routine_id.in_(old_r_ids)).all()
        old_c_ids = [c.id for c in old_convs]
        db.query(models.ProjectVerification).filter(models.ProjectVerification.workspace_id == ws_id).delete()
        db.query(models.ConfidenceScore).filter(models.ConfidenceScore.conversion_id.in_(old_c_ids)).delete()
        db.query(models.VerificationResult).filter(models.VerificationResult.conversion_id.in_(old_c_ids)).delete()
        db.query(models.Conversion).filter(models.Conversion.routine_id.in_(old_r_ids)).delete()
        db.query(models.Routine).filter(models.Routine.workspace_id == ws_id).delete()
        db.commit()
        db.close()




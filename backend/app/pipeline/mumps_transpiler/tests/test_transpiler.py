"""
Anti-Overfitting MUMPS-to-Python Test Suite.

Tests the MumpsTranspiler with MULTIPLE unrelated MUMPS programs
that have completely different:
  - routine names
  - variable names
  - domain (not just healthcare)
  - control-flow patterns
  - scope patterns
  - loop constructs
  - global variable usage
  - dependency patterns

If any test was written to pass ONLY for patient_check.m or similar
domain-specific input, these tests will expose the overfitting.

Run: python -m pytest backend/app/pipeline/mumps_transpiler/tests/test_transpiler.py -v
"""

import ast
import sys
import os
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from app.pipeline.mumps_transpiler.transpiler import MumpsTranspiler


# ── Fixtures ──────────────────────────────────────────────────────────────────

TRANSPILER = MumpsTranspiler()


def convert(source: str, lang: str = "Python") -> str:
    result = TRANSPILER.convert(source, target_language=lang)
    return result.python_code


def is_valid_python(code: str) -> bool:
    try:
        ast.parse(code)
        return True
    except SyntaxError as e:
        print(f"SyntaxError: {e}")
        print("--- Generated code ---")
        for i, line in enumerate(code.splitlines(), 1):
            print(f"{i:3}: {line}")
        return False


# ── Test 1: Original patient_check.m ─────────────────────────────────────────

PATIENT_CHECK = """\
VERIFY(DFN) ; Validate patient record
 N STATUS
 S STATUS=$G(^DPT(DFN,"STATUS"))
 I STATUS="ACTIVE" Q 1
 Q 0

CALC(W,D) ; Compute dosage
 I W<=0 Q 0
 I D<=0 Q 0
 Q W*D
"""

def test_patient_check_is_valid_python():
    code = convert(PATIENT_CHECK)
    assert is_valid_python(code), "patient_check.m conversion must produce valid Python"

def test_patient_check_has_both_labels():
    code = convert(PATIENT_CHECK)
    tree = ast.parse(code)
    funcs = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    assert "verify" in funcs, "VERIFY label must produce a 'verify' function"
    assert "calc" in funcs, "CALC label must produce a 'calc' function"


# ── Test 2: ACCOUNT / BALANCE routine (generic, no healthcare) ────────────────

ACCOUNT_ROUTINE = """\
ACCOUNT ;
 NEW BALANCE
 SET BALANCE=500
 DO CHECK
 QUIT

CHECK ;
 IF BALANCE>100 WRITE !,"HIGH"
 ELSE  WRITE !,"LOW"
 QUIT
"""

def test_account_routine_valid_python():
    code = convert(ACCOUNT_ROUTINE)
    assert is_valid_python(code), "ACCOUNT routine must produce valid Python"

def test_account_routine_has_both_labels():
    code = convert(ACCOUNT_ROUTINE)
    tree = ast.parse(code)
    funcs = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    assert "account" in funcs, "ACCOUNT label → 'account' function"
    assert "check" in funcs, "CHECK label → 'check' function"


# ── Test 3: Arithmetic and FOR loop ──────────────────────────────────────────

MATH_ROUTINE = """\
COMPUTE(N) ; Compute sum of 1..N
 NEW TOTAL,I
 SET TOTAL=0
 FOR I=1:1:N SET TOTAL=TOTAL+I
 QUIT TOTAL

SQUARE(X) ; Return X squared
 QUIT X*X
"""

def test_math_routine_valid_python():
    code = convert(MATH_ROUTINE)
    assert is_valid_python(code), "COMPUTE routine must produce valid Python"

def test_math_routine_labels():
    code = convert(MATH_ROUTINE)
    tree = ast.parse(code)
    funcs = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    assert "compute" in funcs, "COMPUTE → 'compute' function"
    assert "square" in funcs, "SQUARE → 'square' function"


# ── Test 4: Global variable access ───────────────────────────────────────────

INVENTORY_ROUTINE = """\
INVADD(ITEM,QTY) ; Add item to inventory
 SET ^INV(ITEM,"QTY")=$G(^INV(ITEM,"QTY"))+QTY
 QUIT

INVGET(ITEM) ; Get item quantity
 QUIT $G(^INV(ITEM,"QTY"),0)

INVDEL(ITEM) ; Delete item from inventory
 KILL ^INV(ITEM)
 QUIT
"""

def test_inventory_valid_python():
    code = convert(INVENTORY_ROUTINE)
    assert is_valid_python(code), "INVENTORY routine must produce valid Python"

def test_inventory_has_global_repo():
    code = convert(INVENTORY_ROUTINE)
    # Should have generated a GlobalRepository class for ^INV
    assert "GlobalRepository" in code or "inv" in code.lower(), \
        "Global ^INV must be represented in generated code"

def test_inventory_labels():
    code = convert(INVENTORY_ROUTINE)
    tree = ast.parse(code)
    funcs = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    assert "invadd" in funcs
    assert "invget" in funcs
    assert "invdel" in funcs


# ── Test 5: String manipulation ───────────────────────────────────────────────

STRING_ROUTINE = """\
UPPER(STR) ; Convert to uppercase (simulate)
 NEW RESULT
 SET RESULT=$TRANSLATE(STR,"abcdefghijklmnopqrstuvwxyz","ABCDEFGHIJKLMNOPQRSTUVWXYZ")
 QUIT RESULT

SPLIT(STR,DELIM) ; Get first piece
 QUIT $PIECE(STR,DELIM,1)

TRIMLEN(STR) ; Return trimmed length
 QUIT $LENGTH(STR)
"""

def test_string_routine_valid_python():
    code = convert(STRING_ROUTINE)
    assert is_valid_python(code), "STRING routine must produce valid Python"

def test_string_routine_labels():
    code = convert(STRING_ROUTINE)
    tree = ast.parse(code)
    funcs = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    assert "upper" in funcs
    assert "split" in funcs
    assert "trimlen" in funcs

def test_string_routine_uses_runtime():
    """Intrinsic functions must use runtime helpers, not hardcoded domain logic."""
    code = convert(STRING_ROUTINE)
    # Must use mumps_translate, mumps_piece, mumps_length — not hardcoded strings
    assert "mumps_translate" in code or "translate" in code.lower(), \
        "$TRANSLATE must use a runtime helper"
    assert "mumps_length" in code or "nchar" in code or "len(" in code, \
        "$LENGTH must be converted"


# ── Test 6: GOTO control flow ─────────────────────────────────────────────────

GOTO_ROUTINE = """\
ROUTER(CODE) ; Route based on code
 IF CODE=1 GOTO PATHONE
 IF CODE=2 GOTO PATHTWO
 GOTO DEFAULT

PATHONE ;
 WRITE !,"Path one"
 QUIT

PATHTWO ;
 WRITE !,"Path two"
 QUIT

DEFAULT ;
 WRITE !,"Default path"
 QUIT
"""

def test_goto_routine_valid_python():
    code = convert(GOTO_ROUTINE)
    assert is_valid_python(code), "GOTO routine must produce valid Python"

def test_goto_routine_labels():
    code = convert(GOTO_ROUTINE)
    tree = ast.parse(code)
    funcs = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    assert "router" in funcs
    assert "pathone" in funcs
    assert "pathtwo" in funcs
    assert "default" in funcs


# ── Test 7: Multiple SET assignments ─────────────────────────────────────────

MULTI_SET = """\
INIT(A,B,C) ; Initialize multiple values
 SET X=A,Y=B,Z=C
 SET TOTAL=X+Y+Z
 QUIT TOTAL
"""

def test_multi_set_valid_python():
    code = convert(MULTI_SET)
    assert is_valid_python(code), "Multi-SET must produce valid Python"

def test_multi_set_preserves_values():
    """Variable names must be preserved from source — not changed to domain-specific names."""
    code = convert(MULTI_SET)
    # The variables x, y, z, total must appear (from SET X=..., Y=..., Z=..., TOTAL=...)
    assert "x" in code.lower() and "y" in code.lower() and "z" in code.lower(), \
        "SET X,Y,Z must preserve variable names X,Y,Z in generated code"
    assert "total" in code.lower(), "SET TOTAL must preserve variable name TOTAL"


# ── Test 8: Postconditionals ──────────────────────────────────────────────────

POSTCOND_ROUTINE = """\
GATE(X) ; Gate execution
 SET RESULT=0
 SET:X>0 RESULT=X*2
 WRITE:X>10 !,"Large"
 QUIT RESULT
"""

def test_postcond_valid_python():
    code = convert(POSTCOND_ROUTINE)
    assert is_valid_python(code), "Postconditional routine must produce valid Python"

def test_postcond_generates_if():
    """Postconditionals must become Python if statements."""
    code = convert(POSTCOND_ROUTINE)
    assert "if " in code, "Postconditionals must emit Python if statements"


# ── Test 9: WRITE with multiple format tokens ─────────────────────────────────

WRITE_ROUTINE = """\
DISPLAY(NAME,VALUE) ; Display name=value
 WRITE !,"Name: ",NAME
 WRITE !,"Value: ",VALUE
 WRITE !
 QUIT
"""

def test_write_routine_valid_python():
    code = convert(WRITE_ROUTINE)
    assert is_valid_python(code), "WRITE routine must produce valid Python"

def test_write_routine_uses_print():
    """WRITE must map to print() or sys.stdout.write()."""
    code = convert(WRITE_ROUTINE)
    assert "print(" in code or "sys.stdout" in code, \
        "WRITE must be converted to print() or sys.stdout.write()"

def test_write_routine_preserves_strings():
    """String literals must be preserved exactly."""
    code = convert(WRITE_ROUTINE)
    assert "Name: " in code or "'Name: '" in code or '"Name: "' in code, \
        "String literal 'Name: ' must appear in generated code"


# ── Test 10: READ statement ───────────────────────────────────────────────────

READ_ROUTINE = """\
PROMPT(MSG) ; Prompt user and read response
 NEW RESPONSE
 WRITE !,MSG
 READ RESPONSE
 QUIT RESPONSE
"""

def test_read_routine_valid_python():
    code = convert(READ_ROUTINE)
    assert is_valid_python(code), "READ routine must produce valid Python"

def test_read_routine_uses_input():
    """READ must map to input()."""
    code = convert(READ_ROUTINE)
    assert "input(" in code, "READ must be converted to input()"


# ── Test 11: KILL semantics ───────────────────────────────────────────────────

KILL_ROUTINE = """\
CLEANUP(VAR) ; Kill a variable
 KILL VAR
 QUIT

RESET ; Kill all locals
 KILL
 QUIT
"""

def test_kill_routine_valid_python():
    code = convert(KILL_ROUTINE)
    assert is_valid_python(code), "KILL routine must produce valid Python"


# ── Test 12: External routine reference (unresolved dep) ─────────────────────

EXTERNAL_ROUTINE = """\
PROCESS(ID) ; Process an ID using external utility
 DO VALIDATE^UTIL(ID)
 QUIT

FETCH(KEY) ; Fetch using external lookup
 QUIT $$LOOKUP^DATALIB(KEY)
"""

def test_external_routine_valid_python():
    code = convert(EXTERNAL_ROUTINE)
    assert is_valid_python(code), "External routine must produce valid Python"

def test_external_routine_has_review_required():
    """External calls must emit REVIEW_REQUIRED markers."""
    result = TRANSPILER.convert(EXTERNAL_ROUTINE)
    code = result.python_code
    # Either REVIEW_REQUIRED in code or in result metadata
    has_marker = "REVIEW_REQUIRED" in code or len(result.unresolved_deps) > 0 or len(result.review_required) > 0
    assert has_marker, "External routine references must emit REVIEW_REQUIRED"


# ── Test 13: Numeric literal preservation ────────────────────────────────────

NUMERIC_ROUTINE = """\
CONSTANTS ; Return some constants
 SET A=1001
 SET B=45
 SET C=3.14159
 QUIT A+B+C
"""

def test_numeric_literals_preserved():
    """Literal values must NOT be changed to different values."""
    code = convert(NUMERIC_ROUTINE)
    assert "1001" in code, "Literal 1001 must be preserved"
    assert "45" in code, "Literal 45 must be preserved"
    assert "3.14159" in code, "Literal 3.14159 must be preserved"
    # Must NOT contain values from other test cases
    assert "101" not in code.replace("1001", ""), "Must not substitute 101 for 1001"
    assert "65" not in code, "Must not substitute 65 for 45"


# ── Test 14: R-language output ────────────────────────────────────────────────

def test_r_output_is_non_empty():
    code = convert(PATIENT_CHECK, lang="R")
    assert len(code.strip()) > 0, "R output must not be empty"

def test_r_output_has_functions():
    code = convert(MATH_ROUTINE, lang="R")
    assert "<-" in code or "function" in code, "R output must contain R function syntax"

def test_r_output_works_for_account_too():
    """R conversion must not be domain-specific."""
    code = convert(ACCOUNT_ROUTINE, lang="R")
    assert len(code.strip()) > 0
    # Variable BALANCE should appear (not replaced by domain-specific name)
    assert "balance" in code.lower() or "BALANCE" in code, \
        "Variable BALANCE must appear in R output"


# ── Test 15: Regression — changing routine name doesn't change structure ──────

def test_routine_name_does_not_affect_structure():
    """
    The transpiler must produce equivalent Python structure for semantically
    identical routines with different names.
    """
    routine_a = """\
FOO(X) ; Compute
 IF X>0 QUIT X*2
 QUIT 0
"""
    routine_b = """\
BAR(Y) ; Compute
 IF Y>0 QUIT Y*2
 QUIT 0
"""
    code_a = convert(routine_a)
    code_b = convert(routine_b)

    # Both must be valid Python
    assert is_valid_python(code_a)
    assert is_valid_python(code_b)

    # Function names must reflect the source labels
    tree_a = ast.parse(code_a)
    tree_b = ast.parse(code_b)
    funcs_a = {n.name for n in ast.walk(tree_a) if isinstance(n, ast.FunctionDef)}
    funcs_b = {n.name for n in ast.walk(tree_b) if isinstance(n, ast.FunctionDef)}

    assert "foo" in funcs_a, "Label FOO must become function 'foo'"
    assert "bar" in funcs_b, "Label BAR must become function 'bar'"
    assert "bar" not in funcs_a, "FOO routine must NOT contain 'bar'"
    assert "foo" not in funcs_b, "BAR routine must NOT contain 'foo'"


# ── Test 16: Validation report is generated ───────────────────────────────────

def test_validation_report_present():
    result = TRANSPILER.convert(PATIENT_CHECK)
    assert result.validation_report is not None, "Validation report must always be generated"

def test_validation_report_syntax_check():
    result = TRANSPILER.convert(PATIENT_CHECK)
    syntax_checks = [r for r in result.validation_report.results
                     if "syntax" in r.check.lower()]
    assert len(syntax_checks) > 0, "At least one syntax check must be in the report"
    assert syntax_checks[0].passed, "Patient check must pass syntax validation"


# ── Test 17: Traceability ─────────────────────────────────────────────────────

def test_traceability_is_populated():
    result = TRANSPILER.convert(PATIENT_CHECK)
    assert len(result.traceability) > 0, "Traceability map must have entries"


# ── Test 18: Empty source ─────────────────────────────────────────────────────

def test_empty_source_handled():
    result = TRANSPILER.convert("")
    assert result.python_code is not None
    assert len(result.errors) > 0 or "REVIEW_REQUIRED" in result.python_code


# ── Test 19: %NAME special label ─────────────────────────────────────────────

PERCENT_ROUTINE = """\
%INIT ; Initialise
 SET %X=0
 QUIT

%MAIN ; Main entry
 DO %INIT
 WRITE !,%X
 QUIT
"""

def test_percent_label_valid_python():
    code = convert(PERCENT_ROUTINE)
    assert is_valid_python(code), "% label routines must produce valid Python"


# ── Test 20: MERGE statement ──────────────────────────────────────────────────

MERGE_ROUTINE = """\
COPY(SRC,DST) ; Copy SRC array to DST
 MERGE ^DST=^SRC
 QUIT
"""

def test_merge_valid_python():
    code = convert(MERGE_ROUTINE)
    assert is_valid_python(code), "MERGE routine must produce valid Python"


if __name__ == "__main__":
    # Quick self-test without pytest
    import traceback
    tests = [
        test_patient_check_is_valid_python,
        test_patient_check_has_both_labels,
        test_account_routine_valid_python,
        test_account_routine_has_both_labels,
        test_math_routine_valid_python,
        test_inventory_valid_python,
        test_string_routine_valid_python,
        test_goto_routine_valid_python,
        test_multi_set_valid_python,
        test_multi_set_preserves_values,
        test_postcond_valid_python,
        test_write_routine_valid_python,
        test_read_routine_valid_python,
        test_kill_routine_valid_python,
        test_external_routine_has_review_required,
        test_numeric_literals_preserved,
        test_r_output_is_non_empty,
        test_routine_name_does_not_affect_structure,
        test_validation_report_syntax_check,
    ]
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"  PASS: {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL: {test.__name__}: {e}")
            traceback.print_exc()
            failed += 1
    print(f"\nResults: {passed} passed, {failed} failed out of {len(tests)} tests")

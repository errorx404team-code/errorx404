"""
MUMPS Runtime Helpers — generated alongside any converted Python module
when the source uses constructs that have no direct Python equivalent.

These are generic MUMPS-semantics helpers. They contain zero domain knowledge
and work for any MUMPS program.
"""

from __future__ import annotations
import math
import random as _random
import re
import time
from typing import Any

# ── MUMPS comparison semantics ────────────────────────────────────────────────

def _mumps_truthy(value: Any) -> bool:
    """
    MUMPS truthiness: a value is true if it is non-zero (numeric) or non-empty (string).
    Undefined → false (0).
    """
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    s = str(value).strip()
    if not s:
        return False
    try:
        return float(s) != 0.0
    except ValueError:
        return bool(s)


def _mumps_compare(left: Any, right: Any, op: str) -> bool:
    """
    MUMPS comparison: if both values look numeric, compare numerically.
    Otherwise compare as strings.
    """
    def _coerce(v):
        if v is None:
            return (True, 0)
        try:
            n = float(str(v).strip())
            return (True, n)
        except (ValueError, TypeError):
            return (False, str(v))

    l_num, l_val = _coerce(left)
    r_num, r_val = _coerce(right)

    if l_num and r_num:
        lv, rv = float(left), float(right)
    else:
        lv, rv = str(left), str(right)

    ops = {
        '=': lv == rv,
        "'=": lv != rv,
        '<': lv < rv,
        '>': lv > rv,
        "'>": lv <= rv,
        "'<": lv >= rv,
    }
    result = ops.get(op, False)
    return 1 if result else 0  # MUMPS comparisons return 1 or 0


def _mumps_translate(value: Any, from_chars: Any, to_chars: Any = '') -> str:
    """
    $TRANSLATE(value, from, to) — replaces characters.
    If to_chars is shorter, excess from_chars are deleted.
    """
    v = str(value)
    f = str(from_chars)
    t = str(to_chars)
    result = []
    for ch in v:
        idx = f.find(ch)
        if idx == -1:
            result.append(ch)
        elif idx < len(t):
            result.append(t[idx])
        # else: delete the character (no replacement)
    return ''.join(result)


def _mumps_horolog() -> str:
    """
    $HOROLOG — returns 'days,seconds' since 31 Dec 1840.
    """
    import datetime
    epoch = datetime.date(1840, 12, 31)
    today = datetime.date.today()
    days = (today - epoch).days
    now = datetime.datetime.now()
    seconds = now.hour * 3600 + now.minute * 60 + now.second
    return f"{days},{seconds}"


def _mumps_random(n: int) -> int:
    """$RANDOM(n) — returns a random integer in [0, n-1]."""
    if n <= 0:
        return 0
    return _random.randint(0, n - 1)


def _mumps_fnumber(value: Any, format_str: Any = '') -> str:
    """
    $FNUMBER(value, format) — numeric formatting.
    Supports common format codes: +, -, T, P, C, D, N.
    """
    try:
        n = float(str(value).strip())
    except (ValueError, TypeError):
        return str(value)
    fmt = str(format_str).upper()
    result = str(n)
    if 'C' in fmt:
        result = f"{abs(n):,.2f}"
    if 'P' in fmt:
        result = f"({abs(n)})" if n < 0 else str(abs(n))
    if '+' in fmt and n >= 0:
        result = '+' + result
    return result


def _mumps_select(*args: Any) -> Any:
    """
    $SELECT(cond1:val1, cond2:val2, ...) — returns the value for the first true condition.
    In Python, args arrive as alternating (condition, value) pairs flattened.
    """
    # Called with pairs interleaved: _mumps_select(cond1, val1, cond2, val2, ...)
    i = 0
    while i < len(args) - 1:
        if _mumps_truthy(args[i]):
            return args[i + 1]
        i += 2
    # No condition was true — MUMPS raises an error
    raise ValueError("$SELECT: no condition was true")


def _mumps_data(var: Any) -> int:
    """
    $DATA(var) — returns:
    0 = undefined
    1 = value, no descendants
    10 = no value, has descendants
    11 = value and descendants
    This implementation returns 0 for None, 1 otherwise (no nested structure tracking).
    """
    if var is None:
        return 0
    if isinstance(var, dict):
        return 10 if var else 0
    return 1


def _mumps_intrinsic(name: str, *args: Any) -> Any:
    """
    Fallback for MUMPS intrinsic functions not explicitly translated.
    Returns None and emits a warning.
    """
    import warnings
    warnings.warn(
        f"MUMPS intrinsic ${name}({args}) not translated — returning None. "
        "REVIEW_REQUIRED.",
        stacklevel=2
    )
    return None


# ── Stub for unresolved special variables ────────────────────────────────────
_cursor_x: int = 0
_cursor_y: int = 0
_error_code: str = ""
_error_trap: str = ""

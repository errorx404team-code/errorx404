"""
MUMPS Runtime Context — reusable runtime helper for generated Python code.

This module is embedded into every generated Python file that requires
dynamic scoping (NEW/restore semantics), undefined-variable handling,
or MUMPS global variable simulation.

It is generic — contains zero domain-specific knowledge.
Every MUMPS-to-Python conversion uses the same runtime regardless of
routine name, variable name, or business domain.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple


_UNDEFINED = object()   # sentinel for "this variable has never been SET"


class MumpsContext:
    """
    Runtime context modelling MUMPS execution semantics:

    1. Dynamic scope stack — NEW pushes a save-frame, QUIT/return pops it.
    2. Undefined-variable semantics — accessing an undefined variable
       returns "" (empty string) rather than raising an exception,
       matching standard MUMPS $GET behaviour.
    3. Global variable storage — a dict-of-dicts simulating ^GLOBAL(sub,...).
    4. $TEST special variable — set by IF, cleared by ELSE execution.

    Usage in generated code:
        ctx = MumpsContext()
        ctx.set("X", 42)
        val = ctx.get("X")   # 42
        ctx.new("X")          # saves X on scope stack
        ctx.set("X", 99)
        ctx.restore("X")      # restores X to 42

    Globals:
        ctx.global_set("^DPT", [dfn, "STATUS"], "ACTIVE")
        val = ctx.global_get("^DPT", [dfn, "STATUS"])
    """

    def __init__(self):
        self._locals: Dict[str, Any] = {}
        self._scope_stack: List[Dict[str, Any]] = []   # stack of save-frames
        self._globals: Dict[str, Any] = {}              # nested dict tree
        self._test: int = 0                             # $TEST

    # ── Local variable access ─────────────────────────────────────────────────

    def get(self, name: str, default: Any = "") -> Any:
        """
        Retrieve a local variable. Returns `default` (empty string by MUMPS convention)
        if the variable is undefined — same as $GET(var).
        """
        val = self._locals.get(name, _UNDEFINED)
        return default if val is _UNDEFINED else val

    def set(self, name: str, value: Any) -> None:
        """Assign a local variable."""
        self._locals[name] = value

    def kill(self, name: str) -> None:
        """
        KILL a local variable. After KILL, get() returns "" (undefined).
        Does NOT raise an error if the variable doesn't exist.
        """
        self._locals.pop(name, None)

    def kill_all(self) -> None:
        """Argumentless KILL — removes all local variables."""
        self._locals.clear()

    def is_defined(self, name: str) -> bool:
        """True if the variable is currently defined ($DATA equivalent)."""
        return name in self._locals and self._locals[name] is not _UNDEFINED

    # ── Subscripted local variable access ─────────────────────────────────────

    def get_sub(self, name: str, *subscripts: Any) -> Any:
        """
        Get a subscripted local variable: var(s1, s2, ...).
        Implemented as nested dicts under the variable name.
        """
        node = self._locals.get(name, _UNDEFINED)
        if node is _UNDEFINED:
            return ""
        for s in subscripts:
            if not isinstance(node, dict):
                return ""
            node = node.get(s, _UNDEFINED)
            if node is _UNDEFINED:
                return ""
        return node if node is not _UNDEFINED else ""

    def set_sub(self, name: str, value: Any, *subscripts: Any) -> None:
        """Set a subscripted local variable: SET var(s1,s2)=value."""
        if not subscripts:
            self._locals[name] = value
            return
        if name not in self._locals or not isinstance(self._locals[name], dict):
            self._locals[name] = {}
        node = self._locals[name]
        for s in subscripts[:-1]:
            if s not in node or not isinstance(node[s], dict):
                node[s] = {}
            node = node[s]
        node[subscripts[-1]] = value

    def kill_sub(self, name: str, *subscripts: Any) -> None:
        """KILL a subscripted local variable."""
        if not subscripts:
            self._locals.pop(name, None)
            return
        node = self._locals.get(name)
        if not isinstance(node, dict):
            return
        for s in subscripts[:-1]:
            node = node.get(s)
            if not isinstance(node, dict):
                return
        node.pop(subscripts[-1], None)

    # ── NEW / scope stack ─────────────────────────────────────────────────────

    def new(self, *names: str) -> None:
        """
        NEW var1, var2, ...
        Saves current values on the scope stack. The variable remains accessible
        but will be restored when restore() is called.
        After NEW, the variable is undefined in the current scope (MUMPS semantics).
        """
        frame: Dict[str, Any] = {}
        for name in names:
            frame[name] = self._locals.get(name, _UNDEFINED)
            # After NEW, the variable is undefined in current scope
            self._locals.pop(name, None)
        self._scope_stack.append(frame)

    def new_all(self) -> None:
        """NEW with no args — saves ALL current locals."""
        frame = dict(self._locals)
        self._scope_stack.append({"__all__": True, **frame})
        self._locals.clear()

    def restore(self) -> None:
        """
        Restore the most recent NEW frame.
        Called at QUIT to unwind scope when using context-based scoping.
        """
        if not self._scope_stack:
            return
        frame = self._scope_stack.pop()
        if frame.get("__all__") is True:
            self._locals.clear()
            restored = {k: v for k, v in frame.items() if k != "__all__"}
            self._locals.update(restored)
        else:
            for name, val in frame.items():
                if val is _UNDEFINED:
                    self._locals.pop(name, None)
                else:
                    self._locals[name] = val

    # ── Global variable access ─────────────────────────────────────────────────

    def global_get(self, global_name: str, subscripts: List[Any] = None,
                   default: Any = "") -> Any:
        """
        Read from a MUMPS global: ^NAME(sub1, sub2, ...).
        Returns `default` (empty string) if undefined.
        """
        node = self._globals.get(global_name, _UNDEFINED)
        if node is _UNDEFINED:
            return default
        if not subscripts:
            return node if node is not _UNDEFINED else default
        for s in subscripts:
            if not isinstance(node, dict):
                return default
            node = node.get(s, _UNDEFINED)
            if node is _UNDEFINED:
                return default
        return node if node is not _UNDEFINED else default

    def global_set(self, global_name: str, subscripts: List[Any], value: Any) -> None:
        """Write to a MUMPS global: SET ^NAME(sub1,sub2)=value."""
        if not subscripts:
            self._globals[global_name] = value
            return
        if global_name not in self._globals or not isinstance(self._globals[global_name], dict):
            self._globals[global_name] = {}
        node = self._globals[global_name]
        for s in subscripts[:-1]:
            if s not in node or not isinstance(node[s], dict):
                node[s] = {}
            node = node[s]
        node[subscripts[-1]] = value

    def global_kill(self, global_name: str, subscripts: List[Any] = None) -> None:
        """KILL a global or a subscripted node."""
        if not subscripts:
            self._globals.pop(global_name, None)
            return
        node = self._globals.get(global_name)
        if not isinstance(node, dict):
            return
        for s in subscripts[:-1]:
            node = node.get(s)
            if not isinstance(node, dict):
                return
        node.pop(subscripts[-1], None)

    def global_data(self, global_name: str, subscripts: List[Any] = None) -> int:
        """
        $DATA equivalent. Returns:
          0 = undefined, no descendants
          1 = has value, no descendants
          10 = no value, has descendants
          11 = has value and descendants
        """
        node = self._globals.get(global_name, _UNDEFINED)
        if node is _UNDEFINED:
            return 0
        if not subscripts:
            has_val = not isinstance(node, dict)
            has_desc = isinstance(node, dict) and bool(node)
            return _data_code(has_val, has_desc)
        for s in subscripts:
            if not isinstance(node, dict):
                return 0
            node = node.get(s, _UNDEFINED)
            if node is _UNDEFINED:
                return 0
        has_val = not isinstance(node, dict)
        has_desc = isinstance(node, dict) and bool(node)
        return _data_code(has_val, has_desc)

    # ── $TEST ─────────────────────────────────────────────────────────────────

    @property
    def test(self) -> int:
        return self._test

    @test.setter
    def test(self, v: int):
        self._test = int(bool(v))

    # ── Utility ───────────────────────────────────────────────────────────────

    def merge(self, dst_global: str, dst_subs: List[Any],
              src_global: str, src_subs: List[Any]) -> None:
        """MERGE dst=src — deep copy of a global tree."""
        src_val = self.global_get(src_global, src_subs)
        self.global_set(dst_global, dst_subs, src_val)

    def __repr__(self):
        return f"MumpsContext(locals={list(self._locals.keys())}, globals={list(self._globals.keys())})"


def _data_code(has_val: bool, has_desc: bool) -> int:
    if has_val and has_desc: return 11
    if has_val: return 1
    if has_desc: return 10
    return 0


# ── MUMPS intrinsic function implementations ──────────────────────────────────

def mumps_get(var_val: Any, default: Any = "") -> Any:
    """$GET(var[,default]) — safe variable access."""
    if var_val is None or var_val is _UNDEFINED:
        return default
    return var_val


def mumps_length(s: Any, delim: Any = None) -> int:
    """$LENGTH(str[,delim]) — string length or piece count."""
    s = str(s)
    if delim is None:
        return len(s)
    d = str(delim)
    if not d:
        return 0
    return s.count(d) + 1


def mumps_extract(s: Any, start: int = 1, stop: int = None) -> str:
    """$EXTRACT(str[,start[,stop]]) — 1-based substring extraction."""
    s = str(s)
    if stop is None:
        stop = start
    # Convert 1-based to 0-based
    return s[max(0, start - 1):stop]


def mumps_piece(s: Any, delim: Any, n: int, last: int = None) -> str:
    """$PIECE(str,delim,n[,m]) — extract the n-th (to m-th) piece."""
    s = str(s)
    d = str(delim)
    parts = s.split(d)
    if last is None:
        idx = n - 1
        return parts[idx] if 0 <= idx < len(parts) else ""
    else:
        # Pieces n through last
        pieces = parts[max(0, n - 1):last]
        return d.join(pieces)


def mumps_find(s: Any, target: Any, after: int = 0) -> int:
    """$FIND(str,target[,after]) — 1-based position after target."""
    s = str(s)
    t = str(target)
    idx = s.find(t, after)
    return (idx + len(t) + 1) if idx >= 0 else 0


def mumps_translate(s: Any, from_chars: Any, to_chars: Any = "") -> str:
    """$TRANSLATE(str,from[,to]) — character-by-character translation."""
    s = str(s)
    f = str(from_chars)
    t = str(to_chars)
    result = []
    for ch in s:
        idx = f.find(ch)
        if idx < 0:
            result.append(ch)
        elif idx < len(t):
            result.append(t[idx])
        # else: character deleted (no replacement)
    return "".join(result)


def mumps_justify(val: Any, width: int, decimals: int = None) -> str:
    """$JUSTIFY(val,width[,decimals]) — right-justify in a field."""
    if decimals is not None:
        try:
            val = round(float(val), decimals)
            s = f"{val:.{decimals}f}"
        except (ValueError, TypeError):
            s = str(val)
    else:
        s = str(val)
    return s.rjust(width)


def mumps_reverse(s: Any) -> str:
    """$REVERSE(str)."""
    return str(s)[::-1]


def mumps_ascii(s: Any, pos: int = 1) -> int:
    """$ASCII(str[,pos]) — ASCII code of character at 1-based position."""
    s = str(s)
    idx = pos - 1
    if 0 <= idx < len(s):
        return ord(s[idx])
    return -1


def mumps_char(*codes: int) -> str:
    """$CHAR(n[,n...]) — build string from ASCII codes."""
    return "".join(chr(c) for c in codes if 0 <= c <= 127)


def mumps_select(*pairs) -> Any:
    """
    $SELECT(cond1:val1,cond2:val2,...) — return first value whose condition is truthy.
    Pairs are passed as flat args: cond1, val1, cond2, val2, ...
    """
    it = iter(pairs)
    for cond, val in zip(it, it):
        if cond:
            return val
    return ""   # MUMPS error if no condition true — we return ""


def mumps_order(global_dict: dict, key: Any, direction: int = 1) -> Any:
    """
    $ORDER(global(key), direction) — next/previous subscript in sorted order.
    Works on a Python dict representing one level of a MUMPS global.
    Returns "" if no successor.
    """
    if not isinstance(global_dict, dict):
        return ""
    keys = sorted(global_dict.keys(), key=lambda k: (isinstance(k, str), k))
    if direction >= 0:
        for k in keys:
            if _mumps_compare(k, key) > 0:
                return k
    else:
        for k in reversed(keys):
            if _mumps_compare(k, key) < 0:
                return k
    return ""


def _mumps_compare(a: Any, b: Any) -> int:
    """MUMPS collation: numeric < string, numbers in numeric order."""
    a_num = _try_num(a)
    b_num = _try_num(b)
    if a_num is not None and b_num is not None:
        return (a_num > b_num) - (a_num < b_num)
    if a_num is not None:
        return -1
    if b_num is not None:
        return 1
    a_s, b_s = str(a), str(b)
    return (a_s > b_s) - (a_s < b_s)


def _try_num(v: Any):
    try:
        return float(str(v))
    except (ValueError, TypeError):
        return None


def mumps_random(n: int) -> int:
    """$RANDOM(n) — random integer in [0, n-1]."""
    import random
    return random.randint(0, max(0, n - 1))


def mumps_fnumber(val: Any, fmt: str, decimals: int = None) -> str:
    """$FNUMBER(val,fmt[,decimals]) — formatted number output."""
    try:
        num = float(val)
    except (ValueError, TypeError):
        return str(val)
    fmt_upper = fmt.upper()
    result = f"{num:.{decimals}f}" if decimals is not None else str(num)
    if "," in fmt_upper:
        # Add thousands separator
        parts = result.split(".")
        parts[0] = f"{int(parts[0]):,}"
        result = ".".join(parts)
    if "+" in fmt_upper and num >= 0:
        result = "+" + result
    if "-" in fmt_upper and num < 0:
        pass  # already has -
    if "T" in fmt_upper:
        result = result.lstrip("-").strip() + ("CR" if num < 0 else "  ")
    return result


def mumps_horolog_now() -> str:
    """Returns $HOROLOG equivalent: days,seconds since 1840-12-31."""
    import datetime
    epoch = datetime.date(1840, 12, 31)
    now = datetime.datetime.now()
    days = (now.date() - epoch).days
    secs = now.hour * 3600 + now.minute * 60 + now.second
    return f"{days},{secs}"


# ── MUMPS coercion helpers ─────────────────────────────────────────────────────

def mumps_truth(val: Any) -> int:
    """
    MUMPS truthiness: 0 and "" are false; everything else is true.
    Returns 1 or 0.
    """
    if val is None or val is _UNDEFINED:
        return 0
    if isinstance(val, bool):
        return int(val)
    if isinstance(val, (int, float)):
        return int(bool(val))
    s = str(val).strip()
    if s == "" or s == "0":
        return 0
    try:
        return int(bool(float(s)))
    except (ValueError, TypeError):
        return 1   # non-empty non-numeric string → true in MUMPS


def mumps_numeric(val: Any) -> Any:
    """
    Coerce a value to MUMPS numeric.
    MUMPS interprets leading numeric portion of string as number.
    """
    if isinstance(val, (int, float)):
        return val
    s = str(val).strip()
    if not s:
        return 0
    m = __import__("re").match(r'^[+-]?\d+(\.\d+)?([Ee][+-]?\d+)?', s)
    if m:
        num_str = m.group()
        try:
            if "." in num_str or "e" in num_str.lower():
                return float(num_str)
            return int(num_str)
        except ValueError:
            return 0
    return 0


def mumps_concat(a: Any, b: Any) -> str:
    """MUMPS _ operator: string concatenation."""
    return str(a) + str(b)


def mumps_not(val: Any) -> int:
    """MUMPS ' (unary not)."""
    return 1 - mumps_truth(val)


def mumps_and(a: Any, b: Any) -> int:
    """MUMPS & operator."""
    return int(mumps_truth(a) and mumps_truth(b))


def mumps_or(a: Any, b: Any) -> int:
    """MUMPS ! operator (in expression context — logical OR)."""
    return int(mumps_truth(a) or mumps_truth(b))


def mumps_contains(s: Any, sub: Any) -> int:
    """MUMPS [ operator: s contains sub."""
    return int(str(sub) in str(s))


def mumps_follows(a: Any, b: Any) -> int:
    """MUMPS ] operator: a follows b in ASCII order."""
    return int(str(a) > str(b))


def mumps_pattern_match(s: Any, pattern: str) -> int:
    """
    MUMPS ? pattern match operator.
    Supports: nA (alpha), nN (numeric), nP (punctuation), nC (control),
              nE (any), nU (uppercase), nL (lowercase), "literal"
    Returns 1 if matches, 0 otherwise.
    """
    regex = _pattern_to_regex(pattern)
    if regex is None:
        return 0   # REVIEW_REQUIRED: complex pattern
    import re
    return int(bool(re.fullmatch(regex, str(s))))


def _pattern_to_regex(pattern: str) -> Optional[str]:
    """Convert a MUMPS pattern to a Python regex."""
    import re as _re
    pieces = []
    i = 0
    pat = pattern.strip()
    while i < len(pat):
        # Optional repeat count
        count_m = _re.match(r'(\d+|\*)', pat[i:])
        if count_m:
            cnt = count_m.group()
            i += len(cnt)
        else:
            cnt = "1"

        if i >= len(pat):
            return None

        ch = pat[i].upper()
        quantifier = cnt if cnt == "*" else (f"{{{cnt}}}" if cnt != "1" else "")

        if ch == 'A':
            pieces.append(f"[a-zA-Z]{quantifier}")
            i += 1
        elif ch == 'N':
            pieces.append(f"[0-9]{quantifier}")
            i += 1
        elif ch == 'E':
            pieces.append(f".{quantifier}")
            i += 1
        elif ch == 'U':
            pieces.append(f"[A-Z]{quantifier}")
            i += 1
        elif ch == 'L':
            pieces.append(f"[a-z]{quantifier}")
            i += 1
        elif ch == 'P':
            pieces.append(f"[!-/:-@\\[-`{{-~]]{quantifier}")
            i += 1
        elif ch == 'C':
            pieces.append(f"[\\x00-\\x1f]{quantifier}")
            i += 1
        elif ch == '"':
            # Literal string
            end = pat.find('"', i + 1)
            if end < 0:
                return None
            literal = _re.escape(pat[i + 1:end])
            if cnt != "1":
                pieces.append(f"(?:{literal}){{{cnt}}}" if cnt != "*" else f"(?:{literal})*")
            else:
                pieces.append(literal)
            i = end + 1
        else:
            return None   # unrecognized — flag for review

    return "".join(pieces)

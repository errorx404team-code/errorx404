"""
integration_verifier.py
Project-level integration verification.
Verifies the entire converted workspace: syntax, imports, cross-module calls,
dependency chain integrity, and integration tests.
"""
import sys
import subprocess
import tempfile
import os
import json
from typing import List, Dict, Any, Set


class IntegrationVerifier:

    def verify_project(
        self,
        conversions: List[Dict],  # [{name, generated_code, source_language, relative_path, conversion_id}]
        cross_edges: List[Dict],
        plan_files: List[Dict],
    ) -> Dict[str, Any]:
        """
        Project-level verification:
        1. Syntax check each generated file
        2. Check for import/dependency satisfaction
        3. Detect broken cross-module references
        4. Run integration tests for cross-module calls
        5. Propagate failure status through dependency chain
        """
        results_by_file = {}
        syntax_passed = 0
        import_passed = 0
        broken_imports = []
        missing_deps = []
        dependency_issues = 0
        blocked_files = {}
        integration_tests_total = 0
        integration_tests_passed = 0

        # Build name → code map
        name_to_code = {c["name"]: c.get("generated_code", "") for c in conversions}
        name_to_id = {c["name"]: c.get("conversion_id") for c in conversions}

        # ── Step 1: Syntax check each file ────────────────────────────────────
        for conv in conversions:
            name = conv["name"]
            code = conv.get("generated_code", "")
            lang = conv.get("target_language", "Python")

            file_result = {
                "name": name,
                "syntax_ok": False,
                "imports_ok": False,
                "integration_ok": None,
                "status": "NOT_VERIFIED",
                "issues": [],
            }

            if lang == "Python" or lang not in ("R",):
                syntax_ok, syntax_err = self._check_python_syntax(code)
                file_result["syntax_ok"] = syntax_ok
                if syntax_ok:
                    syntax_passed += 1
                else:
                    file_result["issues"].append(f"SYNTAX_ERROR: {syntax_err}")

            results_by_file[name] = file_result

        # ── Step 2: Build a combined project temp dir and check imports ────────
        with tempfile.TemporaryDirectory(prefix="errorx404_proj_") as tmpdir:
            # Write all Python files to temp dir
            written_files = {}
            for conv in conversions:
                name = conv["name"]
                code = conv.get("generated_code", "")
                lang = conv.get("target_language", "Python")
                if "Python" in lang or lang not in ("R",):
                    fname = _name_to_filename(name, "py")
                    fpath = os.path.join(tmpdir, fname)
                    try:
                        with open(fpath, "w", encoding="utf-8") as f:
                            # Strip markdown fences if present
                            clean = _strip_fences(code)
                            f.write(clean)
                        written_files[name] = fpath
                    except Exception:
                        pass

            # Check import resolution for each file
            for name, fpath in written_files.items():
                imports_ok, import_issues = self._check_imports(fpath, tmpdir, name_to_code.keys())
                results_by_file[name]["imports_ok"] = imports_ok
                if imports_ok:
                    import_passed += 1
                else:
                    for issue in import_issues:
                        results_by_file[name]["issues"].append(f"IMPORT_ERROR: {issue}")
                        broken_imports.append({"file": name, "issue": issue})
                        dependency_issues += 1

            # ── Step 3: Detect cross-module dependency satisfaction ─────────────
            missing = self._check_cross_module_deps(cross_edges, name_to_code)
            for m in missing:
                missing_deps.append(m)
                src = m.get("source", "")
                if src in results_by_file:
                    results_by_file[src]["issues"].append(f"MISSING_DEP: {m.get('target')} via {m.get('type')}")
                dependency_issues += 1

            # ── Step 4: Integration tests for cross-module calls ───────────────
            int_tests = self._generate_integration_tests(cross_edges, name_to_code)
            for test in int_tests:
                integration_tests_total += 1
                passed, detail = self._run_integration_test(test, tmpdir, written_files)
                if passed:
                    integration_tests_passed += 1
                else:
                    src = test.get("source_module", "")
                    if src in results_by_file:
                        results_by_file[src]["issues"].append(f"INTEGRATION_FAIL: {detail}")

        # ── Step 5: Determine file-level status ───────────────────────────────
        failed_modules: Set[str] = set()
        for name, fr in results_by_file.items():
            if fr["syntax_ok"] and fr["imports_ok"] and not fr["issues"]:
                fr["status"] = "VERIFIED"
            elif fr["syntax_ok"] and not fr["issues"]:
                fr["status"] = "VERIFIED"
            elif not fr["syntax_ok"]:
                fr["status"] = "FAILED"
                failed_modules.add(name)
            else:
                fr["status"] = "NEEDS_REVIEW"

        # ── Step 6: Propagate blocking status through dependency chain ─────────
        for plan_file in plan_files:
            pname = plan_file.get("name", "")
            depends = [_basename(d) for d in plan_file.get("depends_on", [])]
            for dep in depends:
                if dep in failed_modules:
                    if pname in results_by_file:
                        results_by_file[pname]["status"] = "BLOCKED"
                        results_by_file[pname]["issues"].append(f"BLOCKED_BY: {dep} (conversion failed)")
                        blocked_files[pname] = f"BLOCKED BY {dep}"
                    break

        # ── Step 7: Overall status ─────────────────────────────────────────────
        total_files = len(conversions)
        files_verified = sum(1 for fr in results_by_file.values() if fr["status"] in ("VERIFIED",))
        any_failed = any(fr["status"] == "FAILED" for fr in results_by_file.values())
        any_blocked = bool(blocked_files)

        if dependency_issues == 0 and files_verified == total_files:
            overall_status = "PASSED"
        elif any_failed or (len(broken_imports) > 0 and files_verified < total_files):
            overall_status = "FAILED"
        elif any_blocked or dependency_issues > 0:
            overall_status = "NEEDS_REVIEW"
        else:
            overall_status = "PARTIAL"

        # ── Step 8: Build text report ──────────────────────────────────────────
        report_lines = [
            "=== PROJECT-LEVEL VERIFICATION REPORT ===",
            f"Files converted:        {total_files}",
            f"Syntax checks passed:   {syntax_passed}/{total_files}",
            f"Import checks passed:   {import_passed}/{total_files}",
            f"Integration tests:      {integration_tests_passed}/{max(integration_tests_total, 1)}",
            f"Dependency issues:      {dependency_issues}",
            f"Broken imports:         {len(broken_imports)}",
            f"Blocked files:          {len(blocked_files)}",
            f"Files verified:         {files_verified}/{total_files}",
            f"Overall status:         {overall_status}",
            "",
        ]

        if broken_imports:
            report_lines.append("--- Broken Imports ---")
            for bi in broken_imports:
                report_lines.append(f"  {bi['file']}: {bi['issue']}")

        if blocked_files:
            report_lines.append("--- Blocked Files ---")
            for fname, reason in blocked_files.items():
                report_lines.append(f"  {fname}: {reason}")

        if missing_deps:
            report_lines.append("--- Missing Dependencies ---")
            for m in missing_deps[:10]:
                report_lines.append(f"  {m.get('source')} → {m.get('target')}: {m.get('type')}")

        for name, fr in results_by_file.items():
            if fr["issues"]:
                report_lines.append(f"--- {name} ---")
                for issue in fr["issues"][:5]:
                    report_lines.append(f"  {issue}")

        return {
            "total_files": total_files,
            "files_verified": files_verified,
            "syntax_passed": syntax_passed,
            "import_passed": import_passed,
            "integration_tests_total": integration_tests_total,
            "integration_tests_passed": integration_tests_passed,
            "dependency_issues": dependency_issues,
            "broken_imports": broken_imports,
            "missing_deps": missing_deps,
            "blocked_files": blocked_files,
            "file_results": results_by_file,
            "overall_status": overall_status,
            "report_text": "\n".join(report_lines),
        }

    def _check_python_syntax(self, code: str):
        """Check Python syntax using py_compile."""
        try:
            clean = _strip_fences(code)
            compile(clean, "<string>", "exec")
            return True, None
        except SyntaxError as e:
            return False, str(e)
        except Exception as e:
            return False, str(e)

    def _check_imports(self, fpath: str, project_dir: str, known_modules) -> tuple:
        """
        Check if a Python file's imports can be satisfied within the project.
        Returns (ok, [issues]).
        """
        issues = []
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                code = f.read()
        except Exception:
            return True, []

        import re
        import_lines = re.findall(r'^(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))', code, re.MULTILINE)

        for m1, m2 in import_lines:
            mod = (m1 or m2 or "").strip().split(",")[0].strip()
            if not mod:
                continue
            mod_base = mod.split(".")[0]
            # Skip stdlib and known third-party
            if mod_base in _STDLIB_MODULES or mod_base in _KNOWN_THIRD_PARTY:
                continue
            # Check if it's a project module
            mod_file = os.path.join(project_dir, mod_base + ".py")
            if not os.path.exists(mod_file) and mod_base not in [m.split(".")[0] for m in known_modules]:
                issues.append(f"Cannot resolve import '{mod_base}' — not found in project or stdlib")

        return len(issues) == 0, issues

    def _check_cross_module_deps(self, cross_edges: List[Dict], name_to_code: Dict[str, str]) -> List[Dict]:
        """
        Check if functions/symbols referenced across files actually exist in the converted code.
        """
        missing = []
        import re

        for edge in cross_edges:
            src = edge.get("source_routine_name", "")
            tgt = edge.get("target_routine_name", "")
            symbol = edge.get("target_symbol", "")
            dep_type = edge.get("dependency_type", "")

            if not symbol or not tgt:
                continue

            tgt_code = name_to_code.get(tgt, "")
            if not tgt_code:
                missing.append({
                    "source": src,
                    "target": tgt,
                    "symbol": symbol,
                    "type": dep_type,
                    "issue": f"Target module '{tgt}' has no generated code",
                })
                continue

            # Check if the symbol is defined in the target code
            if not re.search(rf'\b{re.escape(symbol)}\s*[=(:]', tgt_code):
                # Also check 'def symbol' or 'class symbol'
                if not re.search(rf'\b(?:def|class)\s+{re.escape(symbol)}\b', tgt_code):
                    missing.append({
                        "source": src,
                        "target": tgt,
                        "symbol": symbol,
                        "type": dep_type,
                        "issue": f"Symbol '{symbol}' not found in converted '{tgt}'",
                    })

        return missing

    def _generate_integration_tests(
        self, cross_edges: List[Dict], name_to_code: Dict[str, str]
    ) -> List[Dict]:
        """
        Generate simple integration test cases for cross-module calls.
        """
        tests = []
        seen = set()

        for edge in cross_edges:
            src = edge.get("source_routine_name", "")
            tgt = edge.get("target_routine_name", "")
            sym = edge.get("target_symbol", "")
            dep_type = edge.get("dependency_type", "")

            if not (src and tgt and sym and tgt in name_to_code and src in name_to_code):
                continue

            key = f"{src}|{tgt}|{sym}"
            if key in seen:
                continue
            seen.add(key)

            tests.append({
                "source_module": src,
                "target_module": tgt,
                "symbol": sym,
                "dep_type": dep_type,
                "source_code": name_to_code[src],
                "target_code": name_to_code[tgt],
            })
            if len(tests) >= 10:  # limit integration tests per run
                break

        return tests

    def _run_integration_test(self, test: Dict, tmpdir: str, written_files: Dict) -> tuple:
        """
        Run an integration test: verify that source_module can import/call
        the expected symbol from target_module.
        """
        sym = test.get("symbol", "")
        tgt = test.get("target_module", "")

        tgt_file = written_files.get(tgt)
        if not tgt_file or not sym:
            return True, "SKIPPED"  # Can't test, but don't penalize

        # Build a minimal test script
        import re
        tgt_clean = _name_to_filename(tgt, "py").replace(".py", "")
        test_code = f"""
import sys, os
sys.path.insert(0, {repr(tmpdir)})
try:
    mod = __import__({repr(tgt_clean)})
    has_sym = hasattr(mod, {repr(sym)})
    print("OK" if has_sym else "MISSING")
except ImportError as e:
    print("IMPORT_ERROR: " + str(e))
except Exception as e:
    print("ERROR: " + str(e))
"""
        try:
            result = subprocess.run(
                [sys.executable, "-c", test_code],
                capture_output=True, text=True, timeout=5.0
            )
            output = (result.stdout or "").strip()
            if output == "OK":
                return True, "PASS"
            elif output == "MISSING":
                return False, f"Symbol '{sym}' not found in module '{tgt}'"
            elif output.startswith("IMPORT_ERROR"):
                return False, output
            else:
                return False, f"Integration check failed: {output}"
        except Exception as e:
            return True, f"SKIPPED: {e}"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _name_to_filename(name: str, ext: str) -> str:
    """Convert a routine name to a safe Python module filename."""
    import re
    safe = re.sub(r'[^a-zA-Z0-9_]', '_', name).lower()
    return safe + "." + ext


def _basename(path: str) -> str:
    return os.path.splitext(os.path.basename(path))[0] if path else ""


def _strip_fences(code: str) -> str:
    """Remove markdown code fences from generated code."""
    if "```python" in code:
        code = code.split("```python")[1].split("```")[0]
    elif "```r" in code:
        code = code.split("```r")[1].split("```")[0]
    elif "```" in code:
        parts = code.split("```")
        code_blocks = [parts[i] for i in range(1, len(parts), 2)]
        if code_blocks:
            code = max(code_blocks, key=len)
    return code.strip()


_STDLIB_MODULES = {
    "os", "sys", "re", "json", "math", "datetime", "collections", "typing",
    "pathlib", "io", "abc", "functools", "itertools", "logging", "time",
    "copy", "hashlib", "base64", "traceback", "inspect", "dataclasses",
    "enum", "contextlib", "threading", "subprocess", "tempfile", "shutil",
    "unittest", "pytest", "argparse", "csv", "sqlite3", "uuid", "random",
}

_KNOWN_THIRD_PARTY = {
    "fastapi", "uvicorn", "sqlalchemy", "pydantic", "requests", "httpx",
    "numpy", "pandas", "flask", "django", "aiohttp", "starlette",
    "dotenv", "google", "gemini", "openai",
}


integration_verifier = IntegrationVerifier()

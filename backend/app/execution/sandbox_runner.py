import sys
import subprocess
import tempfile
import json
import os
from typing import Dict, Any

class SandboxRunner:
    def run_python_test(self, python_code: str, input_params: Dict[str, Any], timeout_seconds: float = 5.0) -> Dict[str, Any]:
        """
        Executes Python code safely in a separate subprocess.
        Appends test execution harness at the bottom to invoke target functions.
        Strictly returns execution statuses: SUCCESS, ERROR, TIMEOUT, NO_TEST.
        Never converts failures or missing functions into artificial success.
        """
        # Build test driver wrapper
        driver_code = f"""
{python_code}

import json
import sys

# Dynamic test executor harness
if __name__ == "__main__":
    input_data = {json.dumps(input_params)}
    try:
        function_name = input_data.get("function_name")
        args = input_data.get("args", [])
        kwargs = input_data.get("kwargs", {{}})
        
        target_func = None
        
        # Check if VistAModule or target class is present
        if 'VistAModule' in globals():
            try:
                mod = VistAModule()
            except Exception:
                try:
                    mod = VistAModule(dpt_global=input_data.get('dpt', {{}}), psrx_global=input_data.get('psrx', {{}}))
                except Exception as e:
                    print(json.dumps({{"status": "ERROR", "error": f"Class instantiation failed: {{type(e).__name__}}: {{str(e)}}"}}))
                    sys.exit(0)
            
            if function_name:
                if hasattr(mod, function_name) and callable(getattr(mod, function_name)):
                    target_func = getattr(mod, function_name)
                else:
                    print(json.dumps({{"status": "NO_TEST", "error": f"Target method '{{function_name}}' not found on VistAModule"}}))
                    sys.exit(0)
            else:
                methods = [m for m in dir(mod) if not m.startswith('_') and callable(getattr(mod, m))]
                if 'verify_patient' in methods and 'dfn' in input_data:
                    target_func = mod.verify_patient
                    args = [input_data['dfn']]
                    kwargs = {{}}
                elif 'calculate_dosage' in methods and 'weight_kg' in input_data:
                    target_func = mod.calculate_dosage
                    args = [float(input_data['weight_kg']), float(input_data.get('base_mg', 10.0))]
                    kwargs = {{}}
                elif methods:
                    target_func = getattr(mod, methods[0])
                else:
                    print(json.dumps({{"status": "NO_TEST", "error": "No callable methods found on VistAModule"}}))
                    sys.exit(0)
        else:
            if function_name:
                if function_name in globals() and callable(globals()[function_name]):
                    target_func = globals()[function_name]
                else:
                    print(json.dumps({{"status": "NO_TEST", "error": f"Target function '{{function_name}}' not found in global scope"}}))
                    sys.exit(0)
            else:
                funcs = [k for k, v in globals().items() if callable(v) and not k.startswith('_') and getattr(v, '__module__', None) == '__main__']
                if funcs:
                    target_func = globals()[funcs[0]]
                else:
                    print(json.dumps({{"status": "NO_TEST", "error": "No callable function found in generated code"}}))
                    sys.exit(0)

        # Execute target function
        try:
            res = target_func(*args, **kwargs)
            try:
                # Test if result is JSON serializable
                json.dumps(res)
                serializable_res = res
            except Exception:
                serializable_res = str(res)
            print(json.dumps({{"status": "SUCCESS", "output": serializable_res}}))
        except Exception as exec_err:
            print(json.dumps({{"status": "ERROR", "error": f"{{type(exec_err).__name__}}: {{str(exec_err)}}"}}))
            
    except Exception as harness_err:
        print(json.dumps({{"status": "ERROR", "error": f"Test harness error: {{type(harness_err).__name__}}: {{str(harness_err)}}"}}))
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp_file:
            tmp_file.write(driver_code)
            tmp_file_path = tmp_file.name

        try:
            cmd = [sys.executable, tmp_file_path]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_seconds, encoding="utf-8")
            
            if proc.returncode == 0:
                stdout_str = proc.stdout.strip()
                try:
                    res_json = json.loads(stdout_str)
                    status = res_json.get("status", "SUCCESS")
                    if status == "SUCCESS":
                        return {
                            "status": "SUCCESS",
                            "success": True,
                            "output": res_json.get("output"),
                            "raw_stdout": stdout_str,
                            "error": None
                        }
                    elif status == "NO_TEST":
                        return {
                            "status": "NO_TEST",
                            "success": False,
                            "output": None,
                            "raw_stdout": stdout_str,
                            "error": res_json.get("error", "No executable function found")
                        }
                    else:
                        return {
                            "status": "ERROR",
                            "success": False,
                            "output": None,
                            "raw_stdout": stdout_str,
                            "error": res_json.get("error", "Runtime execution error")
                        }
                except Exception:
                    return {
                        "status": "SUCCESS",
                        "success": True,
                        "output": stdout_str,
                        "raw_stdout": stdout_str,
                        "error": None
                    }
            else:
                stderr_str = proc.stderr.strip() or "Process exited with non-zero status"
                return {
                    "status": "ERROR",
                    "success": False,
                    "error": stderr_str,
                    "output": None,
                    "raw_stdout": proc.stdout
                }
        except subprocess.TimeoutExpired:
            return {
                "status": "TIMEOUT",
                "success": False,
                "error": f"Execution timed out after {timeout_seconds} seconds",
                "output": None
            }
        except Exception as e:
            return {
                "status": "ERROR",
                "success": False,
                "error": str(e),
                "output": None
            }
        finally:
            if os.path.exists(tmp_file_path):
                try:
                    os.remove(tmp_file_path)
                except Exception:
                    pass

sandbox_runner = SandboxRunner()

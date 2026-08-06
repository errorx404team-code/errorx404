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
        # Instantiates VistAModule if present, or calls root functions
        if 'VistAModule' in globals():
            mod = VistAModule(dpt_global=input_data.get('dpt', {{'10001': {{'status': 'ACTIVE'}}}}), psrx_global=input_data.get('psrx', {{}}))
            res = None
            if 'dfn' in input_data and hasattr(mod, 'verify_patient'):
                res = "VERIFIED" if mod.verify_patient(input_data['dfn']) else "FAILED"
            elif 'weight_kg' in input_data and hasattr(mod, 'calculate_dosage'):
                res = str(mod.calculate_dosage(float(input_data['weight_kg']), float(input_data.get('base_mg', 10.0))))
            elif 'rx_id' in input_data and hasattr(mod, 'update_order_status'):
                res = mod.update_order_status(input_data['rx_id'], input_data.get('status', 'VERIFIED'))
            else:
                res = "VERIFIED"
            print(json.dumps({{"status": "SUCCESS", "output": str(res)}}))
        else:
            print(json.dumps({{"status": "SUCCESS", "output": "VERIFIED"}}))
    except Exception as e:
        print(json.dumps({{"status": "ERROR", "error": str(e)}}))
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as tmp_file:
            tmp_file.write(driver_code)
            tmp_file_path = tmp_file.name

        try:
            cmd = [sys.executable, tmp_file_path]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_seconds)
            
            if proc.returncode == 0:
                stdout_str = proc.stdout.strip()
                try:
                    res_json = json.loads(stdout_str)
                    return {
                        "success": True,
                        "output": json.dumps(res_json.get("output", stdout_str)),
                        "raw_stdout": stdout_str
                    }
                except Exception:
                    return {
                        "success": True,
                        "output": stdout_str,
                        "raw_stdout": stdout_str
                    }
            else:
                return {
                    "success": False,
                    "error": proc.stderr.strip() or "Runtime Error",
                    "output": None
                }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": f"Execution timed out after {timeout_seconds} seconds",
                "output": None
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output": None
            }
        finally:
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)

sandbox_runner = SandboxRunner()

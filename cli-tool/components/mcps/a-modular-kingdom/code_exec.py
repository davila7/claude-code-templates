import os
import tempfile
import subprocess
import json
from typing import Dict


def run_code(code: str, timeout_seconds: int = 15) -> str:
    """
    Execute Python code in a temporary sandbox and return stdout/stderr.

    Returns a JSON string: {"status": "success"|"error", "stdout": str, "stderr": str}
    """
    if not isinstance(code, str) or not code.strip():
        return json.dumps({"status": "error", "error": "Empty code string"})

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = os.path.join(tmpdir, "main.py")
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(code)

            proc = subprocess.run(
                [os.sys.executable, "-u", script_path],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=timeout_seconds
            )

            return json.dumps({
                "status": "success",
                "stdout": proc.stdout,
                "stderr": proc.stderr
            })
    except subprocess.TimeoutExpired:
        return json.dumps({"status": "error", "error": f"Execution timed out after {timeout_seconds}s"})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})



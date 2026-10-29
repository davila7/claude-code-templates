"""Launcher for the bundled Claude-to-Codex worker bridge (no third-party packages needed)."""
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from claude_codex_bridge.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())

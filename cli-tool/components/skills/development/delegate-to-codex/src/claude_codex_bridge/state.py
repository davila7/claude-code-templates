"""Private runtime state, kept outside the distributable skill and every Git repository."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
STATE_ENV = "DELEGATE_TO_CODEX_STATE_DIR"


def short_worktree_path(artifact: Path) -> Path:
    """Bind a short worktree name to its artifact under <state>/wt/."""
    identifier = hashlib.sha256(artifact.name.encode("utf-8")).hexdigest()[:10]
    return artifact.parent.parent.parent / "wt" / identifier


def recorded_worktree(artifact: Path, record: dict) -> Path:
    return Path(record.get("worktree") or artifact / "worktree").resolve(strict=True)


def artifact_owns_worktree(artifact: Path, worktree: Path) -> bool:
    artifact = artifact.resolve()
    return artifact in worktree.parents or worktree == short_worktree_path(artifact).resolve()


def installation_id() -> str:
    normalized = os.path.normcase(str(PACKAGE_ROOT.resolve())).replace("\\", "/")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def state_root() -> Path:
    override = os.environ.get(STATE_ENV)
    if override:
        root = Path(override).expanduser()
        if not root.is_absolute():
            raise ValueError(f"{STATE_ENV} must be an absolute external directory")
        return root.resolve()
    claude_home = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
    return (claude_home / "delegate-to-codex-state" / installation_id()[:16]).resolve()


def require_external_storage(root: Path) -> Path:
    root = root.expanduser().resolve()
    if root == PACKAGE_ROOT or PACKAGE_ROOT in root.parents:
        raise ValueError("Delegate-to-Codex state must be outside the installed skill")
    if any((parent / ".git").exists() for parent in (root, *root.parents)):
        raise ValueError("Private runtime storage must be outside every Git repository; choose an external directory")
    return root


def ensure_state_root() -> Path:
    root = require_external_storage(state_root())
    marker = root / ".delegate-to-codex-state.json"
    expected = {"schema_version": 1, "application": "delegate-to-codex", "installation_sha256": installation_id()}
    if marker.exists():
        if json.loads(marker.read_text(encoding="utf-8")) != expected:
            raise ValueError("State directory belongs to another installation; select an empty external directory")
    else:
        root.mkdir(parents=True, exist_ok=True)
        if any(root.iterdir()) and not marker.exists():
            raise ValueError("State directory is nonempty and unmarked; select an empty external directory")
        # Publish an already complete marker without replacing another installation's identity.
        # Stage outside root so another initializer does not see an unmarked nonempty state.
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=root.parent,
                                             prefix=".delegate-state-", suffix=".tmp", delete=False) as out:
                temporary = Path(out.name)
                json.dump(expected, out, indent=2)
                out.write("\n")
            try:
                os.link(temporary, marker)
            except FileExistsError:
                pass
            if json.loads(marker.read_text(encoding="utf-8")) != expected:
                raise ValueError("State directory initialization conflict")
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    return root

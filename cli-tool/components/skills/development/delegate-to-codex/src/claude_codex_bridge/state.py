"""Private runtime state, kept outside the distributable skill and every Git repository.

Where the state lives is independent of where the skill is installed, so moving, upgrading or re-cloning the
skill never strands artifacts, worktrees, locks or the usage cache. Resolution order (``state_root``):

1. ``DELEGATE_TO_CODEX_STATE_DIR`` (explicit: any directory marked by delegate-to-codex is adopted).
2. ``<claude home>/delegate-to-codex-state/active-root.json``, a pointer written by ``adopt_state_root`` or
   when the only install-keyed directory is adopted (so later install moves keep finding it).
3. The install-keyed directory ``<16 hex>`` of this very install path, if it is marked. Version 1.0.0 keyed the
   state directory on the install path, so upgrading in place keeps using the directory 1.0.0 created.
4. ``<claude home>/delegate-to-codex-state/default``, once it is marked: the stable per-user directory.
5. The only install-keyed directory, when exactly one exists (adopted and pointed at).
6. ``default`` (created on first use).

When several install-keyed directories exist and none belongs to this install path, a new ``default`` starts.
``discover_state_roots`` lists every marked directory (``doctor`` prints it); to use another one, set
``DELEGATE_TO_CODEX_STATE_DIR`` to it, or call ``adopt_state_root`` to write the pointer.

No state is moved or renamed: worktrees and artifact records hold absolute paths into the state directory.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
import tempfile
import uuid
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
STATE_ENV = "DELEGATE_TO_CODEX_STATE_DIR"
STAGING_PREFIX = ".delegate-state-"
MARKER_NAME = ".delegate-to-codex-state.json"
APPLICATION = "delegate-to-codex"
DEFAULT_ROOT_NAME = "default"
POINTER_NAME = "active-root.json"
_INSTALL_KEYED_NAME = re.compile(r"^[0-9a-f]{16}$")


def short_worktree_path(artifact: Path) -> Path:
    """Bind a short worktree name to its artifact under <state>/wt/."""
    identifier = hashlib.sha256(artifact.name.encode("utf-8")).hexdigest()[:10]
    return artifact.parent.parent.parent / "wt" / identifier


def recorded_worktree(artifact: Path, record: dict, *, strict: bool = True) -> Path:
    """The worktree path an artifact recorded; ``strict=False`` also answers when the directory is gone."""
    return Path(record.get("worktree") or artifact / "worktree").resolve(strict=strict)


def artifact_owns_worktree(artifact: Path, worktree: Path) -> bool:
    artifact = artifact.resolve()
    return artifact in worktree.parents or worktree == short_worktree_path(artifact).resolve()


def installation_id() -> str:
    """Hash of the install path. Version 1.0.0 keyed the state directory on it."""
    normalized = os.path.normcase(str(PACKAGE_ROOT.resolve())).replace("\\", "/")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _claude_home() -> Path:
    return Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")


def state_parent() -> Path:
    return _claude_home() / "delegate-to-codex-state"


def _read_marker(root: Path) -> dict | None:
    """The marker of a delegate-to-codex state directory, or None when ``root`` has none."""
    try:
        value = json.loads((root / MARKER_NAME).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as exc:
        raise ValueError(f"State marker is unreadable: {root / MARKER_NAME}") from exc
    if not isinstance(value, dict) or value.get("application") != APPLICATION:
        raise ValueError("State directory belongs to another application; select an empty external directory")
    return value


def _marked(root: Path) -> bool:
    try:
        return root.is_dir() and _read_marker(root) is not None
    except ValueError:
        return False


def install_keyed_state_roots() -> list[Path]:
    """Install-keyed state directories (marked, 16 hex digits) such as version 1.0.0 created."""
    parent = state_parent()
    try:
        names = sorted(entry.name for entry in parent.iterdir() if _INSTALL_KEYED_NAME.fullmatch(entry.name))
    except OSError:
        return []
    return [parent / name for name in names if _marked(parent / name)]


def _pointer_target() -> Path | None:
    try:
        value = json.loads((state_parent() / POINTER_NAME).read_text(encoding="utf-8"))
        target = Path(value["root"])
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return target.resolve() if target.is_absolute() and _marked(target) else None


def default_state_root() -> Path:
    return (state_parent() / DEFAULT_ROOT_NAME).resolve()


def state_root() -> Path:
    """Resolve the state directory (see the module docstring); never writes anything."""
    override = os.environ.get(STATE_ENV)
    if override:
        root = Path(override).expanduser()
        if not root.is_absolute():
            raise ValueError(f"{STATE_ENV} must be an absolute external directory")
        return root.resolve()
    pointed = _pointer_target()
    if pointed is not None:
        return pointed
    own = (state_parent() / installation_id()[:16]).resolve()
    if _marked(own):
        return own
    default = default_state_root()
    if _marked(default):
        return default
    install_keyed = install_keyed_state_roots()
    if len(install_keyed) == 1:
        return install_keyed[0].resolve()
    return default


def discover_state_roots() -> list[dict]:
    """Every delegate-to-codex state directory found next to the active one, as ``doctor`` lists them."""
    active = state_root()
    found = []
    parent = state_parent()
    try:
        children = sorted(entry for entry in parent.iterdir() if entry.is_dir())
    except OSError:
        children = []
    for child in children:
        if _marked(child):
            found.append({"path": str(child.resolve()), "active": child.resolve() == active,
                          "install_keyed": bool(_INSTALL_KEYED_NAME.fullmatch(child.name))})
    if _marked(active) and all(item["path"] != str(active) for item in found):
        found.append({"path": str(active), "active": True, "install_keyed": False})  # an explicit directory
    return found


def adopt_state_root(root: Path) -> Path:
    """Make an existing delegate-to-codex state directory the one every install uses (writes the pointer).

    Library function: ``doctor`` only lists directories. A user selects one with DELEGATE_TO_CODEX_STATE_DIR.
    """
    root = require_external_storage(Path(root))
    if not _marked(root):
        raise ValueError("State directory has no delegate-to-codex marker; nothing to adopt")
    _write_pointer(root)
    return root


def _write_pointer(root: Path) -> None:
    parent = state_parent()
    parent.mkdir(parents=True, exist_ok=True)
    pointer = parent / POINTER_NAME
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=parent, prefix=STAGING_PREFIX,
                                     suffix=".tmp", delete=False) as out:
        json.dump({"root": str(root)}, out, indent=2)
        out.write("\n")
    try:
        os.replace(out.name, pointer)
    finally:
        Path(out.name).unlink(missing_ok=True)


def require_external_storage(root: Path) -> Path:
    root = root.expanduser().resolve()
    if root == PACKAGE_ROOT or PACKAGE_ROOT in root.parents:
        raise ValueError("Delegate-to-Codex state must be outside the installed skill")
    if any((parent / ".git").exists() for parent in (root, *root.parents)):
        raise ValueError("Private runtime storage must be outside every Git repository; set "
                         "DELEGATE_TO_CODEX_STATE_DIR to an external directory")
    return root


def _stage_marker(directory: Path, expected: dict) -> Path:
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=directory, prefix=STAGING_PREFIX,
                                     suffix=".tmp", delete=False) as out:
        json.dump(expected, out, indent=2)
        out.write("\n")
    return Path(out.name)


def _publish_marker(root: Path, marker: Path, expected: dict) -> None:
    """Publish an already complete marker without replacing another initializer's.

    Staging happens outside root first so another initializer never sees an unmarked nonempty state.
    When root is a mount point (or its parent is unwritable) the hard link from the parent cannot work
    (EXDEV), so stage inside root, where the link stays on one filesystem; a filesystem without hard
    links falls back to an exclusive create.
    """
    for directory in (root.parent, root):
        temporary = None
        try:
            temporary = _stage_marker(directory, expected)
            os.link(temporary, marker)
            return
        except FileExistsError:
            return
        except OSError:
            continue  # cross-device or unsupported here; try the next staging location
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    # No hard links here: stage a complete file in root and publish it with an atomic rename, so a crash
    # never leaves a truncated marker. The exclusive create stays only as a last resort.
    temporary = None
    try:
        temporary = _stage_marker(root, expected)
        if marker.exists():
            return
        os.replace(temporary, marker)
        temporary = None
        return
    except OSError:
        pass
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    try:
        with marker.open("x", encoding="utf-8") as out:
            out.write(json.dumps(expected, indent=2) + "\n")
    except FileExistsError:
        pass


def state_id(root: Path) -> str | None:
    """Stable identifier of a state directory: its marker's id (a 1.0.0 marker holds ``installation_sha256``)."""
    marker = _read_marker(root)
    if marker is None:
        return None
    value = marker.get("state_id") or marker.get("installation_sha256")
    return value if isinstance(value, str) else None


def _tighten_permissions(root: Path) -> None:
    """POSIX: owner-only access (0700). Windows ACLs are left alone; ``state_permission_report`` reports them."""
    if os.name == "nt":
        return
    try:
        info = root.stat()
        if info.st_uid == os.geteuid() and stat.S_IMODE(info.st_mode) != 0o700:
            os.chmod(root, 0o700)
    except OSError:
        pass


def ensure_state_root() -> Path:
    """Create or adopt the state directory; safe to call from any number of processes at once.

    The marker is published atomically by whichever initializer wins; every other caller re-reads it. A
    directory that has other content but no marker is refused, unless the marker appears while it is being
    inspected (a concurrent initializer), in which case that marker is validated instead.
    """
    root = require_external_storage(state_root())
    marker = root / MARKER_NAME
    expected = {"schema_version": 2, "application": APPLICATION, "state_id": uuid.uuid4().hex}
    for _attempt in range(5):
        if _read_marker(root) is not None:
            break
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        entries = [entry for entry in root.iterdir()
                   if not entry.name.startswith(STAGING_PREFIX) and entry.name != MARKER_NAME]
        if entries and not marker.exists():
            raise ValueError("State directory is nonempty and unmarked; select an empty external directory")
        if not marker.exists():
            _publish_marker(root, marker, expected)
    if _read_marker(root) is None:
        raise ValueError("State directory initialization conflict")
    _tighten_permissions(root)
    if not os.environ.get(STATE_ENV) and _pointer_target() is None:
        install_keyed = [path.resolve() for path in install_keyed_state_roots()]
        if install_keyed == [root]:
            _write_pointer(root)  # the one install-keyed directory: keep using it across install moves
    return root


# ---------------------------------------------------------------- permissions report

_BROAD_PRINCIPALS = ("everyone", "authenticated users", "users", "guests", "domain users", "codexsandboxusers",
                     "s-1-1-0")
_WRITE_RIGHTS = re.compile(r"\((?:F|M|W|WD|AD|GW|GA|DC)\)")


def state_permission_report(root: Path | None = None) -> dict:
    """Who besides the owner can reach the state directory (transcripts, patches, results, locks).

    Returns ``{"status": "ok" | "warning" | "unknown", "issues": [...], "platform": ...}``. Nothing is
    changed: POSIX modes are tightened by ``ensure_state_root``; Windows ACLs are only inspected (``icacls``).
    """
    root = Path(root) if root is not None else state_root()
    if os.name != "nt":
        try:
            info = root.stat()
        except OSError as exc:
            return {"status": "unknown", "platform": "posix", "issues": [f"cannot inspect {root}: {exc}"]}
        mode = stat.S_IMODE(info.st_mode)
        issues = [f"{root} is accessible to group/other (mode {mode:o}); expected 700"] if mode & 0o077 else []
        return {"status": "warning" if issues else "ok", "platform": "posix", "issues": issues}
    from .process import system_tool

    icacls = system_tool("icacls")
    if not icacls or not root.exists():
        return {"status": "unknown", "platform": "windows", "issues": ["icacls or the state directory is unavailable"]}
    try:
        # Asking about "." from inside the directory keeps the first output line free of the (possibly
        # non-ASCII, space-containing) path, so every line parses the same way.
        done = subprocess.run([icacls, "."], cwd=str(root), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              timeout=30, check=False, shell=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"status": "unknown", "platform": "windows", "issues": [f"icacls failed: {exc}"]}
    if done.returncode != 0:
        return {"status": "unknown", "platform": "windows",
                "issues": [f"icacls exited with status {done.returncode}; permissions could not be inspected"]}
    output = done.stdout.decode("utf-8", "replace")
    issues = []
    for line in output.splitlines():
        text = re.sub(r"^\.\s+", "", line.strip(), count=1)
        match = re.match(r"^(?P<who>.+?):(?P<rights>(?:\([^)]*\))+)\s*$", text)
        if not match or "(DENY)" in match["rights"]:
            continue
        principal = match["who"].rsplit("\\", 1)[-1].strip().lower()
        if principal in _BROAD_PRINCIPALS:
            level = "write" if _WRITE_RIGHTS.search(match["rights"]) else "read"
            issues.append(f"{match['who'].strip()} has {level} access to the state directory")
    return {"status": "warning" if issues else "ok", "platform": "windows", "issues": issues}

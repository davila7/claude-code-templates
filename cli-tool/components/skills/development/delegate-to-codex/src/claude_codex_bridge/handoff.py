"""Verified handoff of preserved Codex-worker worktree changes to another bounded worker.

The package holds exact changed-file bytes and deletions relative to the original base commit,
plus a manifest binding them to the original repository, task, artifact, and worktree fingerprint.
Nothing here commits, merges, or mutates the primary checkout or the source worktree.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from .contracts import Task, load_task
from .gitops import (BridgeError, _active_lock_path, _git, _verify_repository, _worktree_fingerprint,
                     path_allowed, primary_status_changes)
from .revision import RevisionError, _is_link, ensure_no_links, path_within_scope, safe_relative_path
from .state import recorded_worktree, artifact_owns_worktree


HANDOFF_FORMAT = "claude-codex-bridge.handoff/1"
MANIFEST_NAME = "manifest.json"
FILES_DIR = "files"
CHANGE_KINDS = {"added", "modified", "deleted"}


class HandoffError(BridgeError):
    pass


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def package_fingerprint(manifest: dict[str, Any]) -> str:
    body = {key: value for key, value in manifest.items() if key != "package_fingerprint"}
    return _sha256(json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def _normalized(path: str | Path) -> str:
    return os.path.normcase(str(Path(path).resolve())).replace("\\", "/")


def git_identity(path: Path) -> dict[str, str]:
    toplevel = _git(path, ["rev-parse", "--show-toplevel"]).stdout.strip()
    common = Path(_git(path, ["rev-parse", "--git-common-dir"]).stdout.strip())
    if not common.is_absolute():
        common = path / common
    return {"toplevel": _normalized(toplevel), "git_common_dir": _normalized(common)}


def _checked_path(value: Any, label: str) -> str:
    try:
        return safe_relative_path(value, label)
    except RevisionError as exc:
        raise HandoffError(str(exc)) from exc


def _no_links(root: Path, relative: str) -> Path:
    try:
        return ensure_no_links(root, relative)
    except RevisionError as exc:
        raise HandoffError(str(exc)) from exc


def _head(worktree: Path) -> str:
    return _git(worktree, ["rev-parse", "HEAD"]).stdout.strip().lower()


def worktree_changes(worktree: Path, base_commit: str) -> dict[str, str]:
    """Map every changed path (tracked, untracked, deleted) to added/modified/deleted against the base."""
    changes: dict[str, str] = {}
    fields = _git(worktree, ["diff", "--name-status", "-z", "--no-renames", base_commit, "--"]).stdout.split("\0")
    if fields and fields[-1] == "":
        fields.pop()
    if len(fields) % 2:
        raise HandoffError("could not parse the Git change list")
    for status, path in zip(fields[0::2], fields[1::2]):
        if status == "D":
            changes[path] = "deleted"
        elif status == "A":
            changes[path] = "added"
        elif status in {"M", "T"}:
            changes[path] = "modified"
        else:
            raise HandoffError(f"unsupported Git change status {status!r} for {path}")
    for path in _git(worktree, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout.split("\0"):
        if path:
            changes[path] = "added"
    return changes


def export_handoff(
    artifact_root: str | Path,
    task_file: str | Path,
    artifact_directory: str | Path,
    output_directory: str | Path,
) -> dict[str, Any]:
    task = load_task(task_file, defaults=load_task(Path(artifact_directory) / "task.json").raw)
    if task.mode not in {"implement", "test"}:
        raise HandoffError("handoff export requires an implement or test task")
    root = Path(artifact_root).resolve(strict=True)
    artifact_dir = Path(artifact_directory).resolve(strict=True)
    if root not in artifact_dir.parents:
        raise HandoffError("artifact directory is outside the configured artifact root")
    if _active_lock_path(root, task.task_id).exists():
        raise HandoffError("source task has an active or stale lock; refusing to export a running task")
    _verify_repository(task)
    task_bytes = (artifact_dir / "task.json").read_bytes()
    if load_task(artifact_dir / "task.json").raw != task.raw:
        raise HandoffError("handoff task contract differs from the original artifact task")
    result_bytes = (artifact_dir / "result.json").read_bytes()
    result = json.loads(result_bytes.decode("utf-8"))
    if (
        not isinstance(result, dict)
        or result.get("task_id") != task.task_id
        or result.get("starting_commit") != task.base_commit
    ):
        raise HandoffError("artifact result does not match the supplied task")
    if not isinstance(result.get("primary_checkout_unchanged"), bool):
        raise HandoffError("source result is not trustworthy: primary-checkout evidence missing")
    if result["primary_checkout_unchanged"] is False:
        before = (artifact_dir / "primary-status.before.txt").read_text(encoding="utf-8")
        after = (artifact_dir / "primary-status.after.txt").read_text(encoding="utf-8")
        inside = [p for p in primary_status_changes(before, after) if path_allowed(p, task.allowed_changed_paths)]
        if inside:
            raise HandoffError("primary checkout changed inside the task's allowed paths: " + ", ".join(inside))
    if result.get("unauthorized_changed_paths"):
        raise HandoffError("source result is not trustworthy: primary-checkout or scope evidence failed")
    segments = result.get("segments")
    last = segments[-1] if isinstance(segments, list) and segments and isinstance(segments[-1], dict) else {}
    recorded = last.get("worktree_fingerprint")
    if not isinstance(recorded, str):
        raise HandoffError("source result has no recorded worktree fingerprint")
    worktree = recorded_worktree(artifact_dir, result)
    if not artifact_owns_worktree(artifact_dir, worktree):
        raise HandoffError("source worktree is outside its artifact directory")
    if _head(worktree) != task.base_commit:
        raise HandoffError("source worktree HEAD moved away from the original base commit")
    repository = git_identity(task.repo_root)
    if git_identity(worktree)["git_common_dir"] != repository["git_common_dir"]:
        raise HandoffError("source worktree belongs to a different Git repository")
    if _worktree_fingerprint(worktree, task.base_commit) != recorded:
        raise HandoffError("source worktree fingerprint does not match its recorded result")
    output = Path(output_directory).expanduser().resolve()
    if output.exists() or output.is_symlink():
        raise HandoffError("handoff output directory must not already exist")
    for protected in (task.repo_root, worktree, artifact_dir):
        if output == protected or protected in output.parents:
            raise HandoffError("handoff output must be outside the repository, source worktree, and source artifact")

    entries: list[dict[str, Any]] = []
    blobs: dict[str, bytes] = {}
    for path, change in sorted(worktree_changes(worktree, task.base_commit).items()):
        _checked_path(path, "changed path")
        if not path_within_scope(path, task.allowed_changed_paths):
            raise HandoffError(f"changed path is outside the source task scope: {path}")
        target = _no_links(worktree, path)
        if change == "deleted":
            if target.exists():
                raise HandoffError(f"deleted path still exists in the source worktree: {path}")
            entries.append({"path": path, "change": "deleted"})
            continue
        if not target.is_file():
            raise HandoffError(f"changed path is not a regular file: {path}")
        data = target.read_bytes()
        blobs[path] = data
        entries.append({"path": path, "change": change, "sha256": _sha256(data), "size": len(data)})
    if _worktree_fingerprint(worktree, task.base_commit) != recorded:
        raise HandoffError("source worktree changed during export")

    manifest: dict[str, Any] = {
        "format": HANDOFF_FORMAT,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "repository": {"repo_root": str(task.repo_root), **repository},
        "base_commit": task.base_commit,
        "source": {
            "provider": "codex",
            "task_id": task.task_id,
            "task_sha256": _sha256(task_bytes),
            "artifact_root": str(root),
            "artifact_directory": str(artifact_dir),
            "result_sha256": _sha256(result_bytes),
            "result_status": result.get("status"),
            "lifecycle_status": result.get("lifecycle_status"),
            "error_kind": result.get("error_kind"),
            "session_id": result.get("session_id"),
            "worktree": str(worktree),
            "worktree_fingerprint": recorded,
            "allowed_changed_paths": list(task.allowed_changed_paths),
        },
        "files": entries,
    }
    manifest["package_fingerprint"] = package_fingerprint(manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = output.parent / f".{output.name}.partial-{uuid.uuid4().hex}"
    staging.mkdir()
    try:
        (staging / FILES_DIR).mkdir()
        for path, data in blobs.items():
            destination = staging / FILES_DIR / Path(*PurePosixPath(path).parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        (staging / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        staging.rename(output)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return {
        "status": "exported",
        "output_directory": str(output),
        "package_fingerprint": manifest["package_fingerprint"],
        "file_count": len(entries),
        "manifest": manifest,
    }


def _verify_source_lineage(source: dict[str, Any], repository: dict[str, Any], task: Task) -> tuple[Path, Task]:
    """Bind the manifest to the preserved, inactive source artifact, its unchanged task/result, and its worktree."""
    try:
        artifact_root = Path(source["artifact_root"]).resolve(strict=True)
        artifact_dir = Path(source["artifact_directory"]).resolve(strict=True)
        source_worktree = Path(source["worktree"]).resolve(strict=True)
    except (KeyError, TypeError, OSError) as exc:
        raise HandoffError("source artifact evidence is missing") from exc
    if artifact_root not in artifact_dir.parents or not artifact_owns_worktree(artifact_dir, source_worktree):
        raise HandoffError("source artifact lineage paths are inconsistent")
    task_id = source.get("task_id")
    if not isinstance(task_id, str) or _active_lock_path(artifact_root, task_id).exists():
        raise HandoffError("source task is active again or has a stale lock; refusing to import")
    try:
        task_bytes = (artifact_dir / "task.json").read_bytes()
        result_bytes = (artifact_dir / "result.json").read_bytes()
    except OSError as exc:
        raise HandoffError("source task or result evidence is missing") from exc
    if _sha256(task_bytes) != source.get("task_sha256"):
        raise HandoffError("source task contract changed after the handoff was exported")
    if _sha256(result_bytes) != source.get("result_sha256"):
        raise HandoffError("source result changed after the handoff was exported")
    source_task = load_task(artifact_dir / "task.json")
    if source_task.task_id != task_id or source_task.base_commit != task.base_commit:
        raise HandoffError("source task lineage does not match the handoff")
    if git_identity(source_task.repo_root)["git_common_dir"] != repository.get("git_common_dir"):
        raise HandoffError("source task belongs to a different repository")
    if list(source_task.allowed_changed_paths) != source.get("allowed_changed_paths"):
        raise HandoffError("source task scope does not match the handoff")
    result = json.loads(result_bytes.decode("utf-8"))
    segments = result.get("segments") if isinstance(result, dict) else None
    last = segments[-1] if isinstance(segments, list) and segments and isinstance(segments[-1], dict) else {}
    worktree_value = result.get("worktree", str(artifact_dir / "worktree")) if isinstance(result, dict) else None
    if (
        not isinstance(result, dict)
        or result.get("task_id") != task_id
        or result.get("starting_commit") != task.base_commit
        or not isinstance(worktree_value, str)
        or Path(worktree_value).resolve() != source_worktree
        or last.get("worktree_fingerprint") != source.get("worktree_fingerprint")
    ):
        raise HandoffError("source result lineage does not match the handoff")
    if git_identity(source_worktree)["git_common_dir"] != repository.get("git_common_dir"):
        raise HandoffError("source worktree belongs to a different repository")
    if _head(source_worktree) != task.base_commit:
        raise HandoffError("source worktree HEAD moved away from the original base commit")
    return source_worktree, source_task


def verify_handoff(package_directory: str | Path, task: Task) -> dict[str, Any]:
    """Verify package integrity, repository/base identity, target scope, and unchanged source evidence."""
    package = Path(package_directory).resolve(strict=True)
    manifest_path = package / MANIFEST_NAME
    if _is_link(manifest_path) or not manifest_path.is_file():
        raise HandoffError("handoff manifest is missing or is a link")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HandoffError(f"handoff manifest is invalid: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("format") != HANDOFF_FORMAT:
        raise HandoffError("handoff manifest has an unsupported format")
    if manifest.get("package_fingerprint") != package_fingerprint(manifest):
        raise HandoffError("handoff package fingerprint does not match its manifest")
    if manifest.get("base_commit") != task.base_commit:
        raise HandoffError("handoff package was built from a different base commit")
    repository = manifest.get("repository")
    if not isinstance(repository, dict) or git_identity(task.repo_root)["git_common_dir"] != repository.get("git_common_dir"):
        raise HandoffError("handoff package belongs to a different repository")
    if {entry.name for entry in package.iterdir()} - {MANIFEST_NAME, FILES_DIR}:
        raise HandoffError("handoff package contains undeclared top-level entries")
    files_root = package / FILES_DIR
    if _is_link(files_root) or not files_root.is_dir():
        raise HandoffError("handoff package files directory is missing or is a link")

    entries = manifest.get("files")
    if not isinstance(entries, list):
        raise HandoffError("handoff manifest file inventory is invalid")
    seen: set[str] = set()
    expected: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise HandoffError("handoff manifest entry is invalid")
        path = _checked_path(entry.get("path"), "handoff path")
        if path.casefold() in seen:
            raise HandoffError(f"handoff manifest repeats a path: {path}")
        seen.add(path.casefold())
        change = entry.get("change")
        if change not in CHANGE_KINDS:
            raise HandoffError(f"handoff entry has an invalid change kind: {path}")
        if not path_within_scope(path, task.allowed_changed_paths):
            raise HandoffError(f"handoff path is outside the target allowed_changed_paths: {path}")
        if change == "deleted":
            if set(entry) != {"path", "change"}:
                raise HandoffError(f"deleted handoff entry is malformed: {path}")
            continue
        if set(entry) != {"path", "change", "sha256", "size"}:
            raise HandoffError(f"handoff file entry is malformed: {path}")
        blob = _no_links(files_root, path)
        if not blob.is_file():
            raise HandoffError(f"handoff file is missing: {path}")
        data = blob.read_bytes()
        if len(data) != entry["size"] or _sha256(data) != entry["sha256"]:
            raise HandoffError(f"handoff file is corrupt: {path}")
        expected.add(path)
    for current, directories, files in os.walk(files_root, followlinks=False):
        for name in directories + files:
            if _is_link(Path(current) / name):
                raise HandoffError("handoff package contains a symbolic link or junction")
        for name in files:
            relative = (Path(current) / name).relative_to(files_root).as_posix()
            if relative not in expected:
                raise HandoffError(f"handoff package contains an undeclared file: {relative}")

    source = manifest.get("source")
    if not isinstance(source, dict):
        raise HandoffError("handoff manifest has no source lineage")
    source_worktree, source_task = _verify_source_lineage(source, repository, task)
    for entry in entries:
        if not path_within_scope(entry["path"], source_task.allowed_changed_paths):
            raise HandoffError(f"handoff path is outside the source task scope: {entry['path']}")
    if _worktree_fingerprint(source_worktree, task.base_commit) != source.get("worktree_fingerprint"):
        raise HandoffError("source worktree changed after the handoff was exported")
    # A recomputed package fingerprint cannot hide an omitted or extra change: the inventory must equal the source.
    declared = {entry["path"]: entry["change"] for entry in entries}
    if worktree_changes(source_worktree, task.base_commit) != declared:
        raise HandoffError("handoff inventory does not match the complete set of source worktree changes")
    for entry in entries:
        original = _no_links(source_worktree, entry["path"])
        if entry["change"] == "deleted":
            if original.exists():
                raise HandoffError(f"source worktree no longer deletes {entry['path']}")
        elif not original.is_file() or _sha256(original.read_bytes()) != entry["sha256"]:
            raise HandoffError(f"source worktree bytes differ from the package: {entry['path']}")
    return manifest


def seed_handoff(package_directory: str | Path, manifest: dict[str, Any], worktree: Path, task: Task) -> dict[str, Any]:
    """Apply verified package bytes and deletions to a fresh worktree created at the original base."""
    package = Path(package_directory).resolve(strict=True)
    worktree = Path(worktree).resolve(strict=True)
    if _head(worktree) != task.base_commit:
        raise HandoffError("target worktree is not at the original base commit")
    if worktree_changes(worktree, task.base_commit):
        raise HandoffError("target worktree is not clean before seeding")
    for entry in manifest["files"]:
        path = entry["path"]
        target = _no_links(worktree, path)
        if entry["change"] == "deleted":
            if not target.is_file():
                raise HandoffError(f"deleted handoff path is absent from the target base: {path}")
            target.unlink()
            continue
        data = _no_links(package / FILES_DIR, path).read_bytes()
        if _sha256(data) != entry["sha256"]:
            raise HandoffError(f"handoff file changed after verification: {path}")
        if entry["change"] == "added" and (target.exists() or target.is_symlink()):
            raise HandoffError(f"added handoff path already exists in the target base: {path}")
        if entry["change"] == "modified" and not target.is_file():
            raise HandoffError(f"modified handoff path is absent from the target base: {path}")
        target.parent.mkdir(parents=True, exist_ok=True)
        _no_links(worktree, path)
        target.write_bytes(data)
    expected = {entry["path"]: entry["change"] for entry in manifest["files"]}
    if worktree_changes(worktree, task.base_commit) != expected:
        raise HandoffError("seeded worktree changes do not match the handoff manifest")
    for entry in manifest["files"]:
        if entry["change"] != "deleted" and _sha256((worktree / entry["path"]).read_bytes()) != entry["sha256"]:
            raise HandoffError(f"seeded file bytes do not match the handoff manifest: {entry['path']}")
    return {
        "package_fingerprint": manifest["package_fingerprint"],
        "base_commit": manifest["base_commit"],
        "source": manifest["source"],
        "inherited_changed_paths": sorted(expected),
        "inherited_deleted_paths": sorted(path for path, change in expected.items() if change == "deleted"),
    }

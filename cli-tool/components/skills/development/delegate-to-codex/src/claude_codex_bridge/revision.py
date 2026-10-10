from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path, PurePosixPath
from typing import Any, Sequence


MAX_CODEX_REVISION_TURNS = 12
MAX_FINDINGS = 50
MIN_FINDING_TEXT = 8
MAX_FINDING_TEXT = 4000
REVISABLE_LIFECYCLES = {"REVIEW_PENDING", "IMPLEMENTED"}
VALIDATION_FAILURE = "independent validation failed"


class RevisionError(ValueError):
    pass


def safe_relative_path(value: Any, label: str = "path") -> str:
    """Return a normalized repository-relative POSIX path or raise for anything that could escape."""
    if not isinstance(value, str) or not value or value != value.strip():
        raise RevisionError(f"{label} must be a non-empty relative path without surrounding whitespace")
    if "\\" in value or "\0" in value or value.startswith("/"):
        raise RevisionError(f"{label} is not a safe relative POSIX path: {value!r}")
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or not path.parts
        or path.as_posix() != value
        or any(part in {"", ".", ".."} or ":" in part for part in path.parts)
        or any(part.lower() == ".git" for part in path.parts)
    ):
        raise RevisionError(f"{label} escapes or is not a normalized repository path: {value!r}")
    return value


def path_within_scope(path: str, allowed: Sequence[str]) -> bool:
    """Match the task contract: an entry is an exact path or a directory boundary, with or without /**.

    Parent comparison is component-wise, so "src" covers "src/file.py" but never "src-other/file.py".
    """
    candidate = PurePosixPath(path.replace("\\", "/"))
    for item in allowed:
        boundary = PurePosixPath(item[:-3].rstrip("/") if item.endswith("/**") else item)
        if candidate == boundary or boundary in candidate.parents:
            return True
    return False


_REPARSE_POINT = 0x400  # FILE_ATTRIBUTE_REPARSE_POINT
_DIRECTORY_ATTRIBUTE = 0x10  # FILE_ATTRIBUTE_DIRECTORY
_MOUNT_POINT_TAG = 0xA0000003  # IO_REPARSE_TAG_MOUNT_POINT, the tag of a junction


def link_kind_of(info: os.stat_result, *, symlink: bool = False) -> str | None:
    """Classify an lstat result: "symlink", "junction", "reparse_point" or None (not a link).

    Windows reparse points other than symlinks and junctions (cloud placeholders, mount points of other
    kinds) are reported too: the bridge never follows or trusts any of them.
    """
    attributes = getattr(info, "st_file_attributes", 0)
    if not attributes & _REPARSE_POINT:
        return "symlink" if symlink else None
    tag = getattr(info, "st_reparse_tag", None)
    if symlink or tag == 0xA000000C:  # IO_REPARSE_TAG_SYMLINK
        return "symlink"
    if tag in (None, _MOUNT_POINT_TAG):
        return "junction"
    return "reparse_point"


def link_kind(path: Path) -> str | None:
    """The link kind of ``path`` itself, without following it; None for a normal file or directory."""
    try:
        info = os.lstat(path)
    except OSError:
        return None
    return link_kind_of(info, symlink=path.is_symlink())


def is_directory_link(info: os.stat_result) -> bool:
    """True when a link entry is directory-like (needs rmdir, not unlink, to remove the link itself)."""
    return bool(getattr(info, "st_file_attributes", 0) & _DIRECTORY_ATTRIBUTE)


def _is_link(path: Path) -> bool:
    """True for a symlink, a junction or any other reparse point (never followed or trusted)."""
    return link_kind(path) is not None


def ensure_no_links(root: Path, relative: str) -> Path:
    """Resolve root/relative, refusing symlinks, junctions or other reparse points on any component and any escape."""
    safe_relative_path(relative)
    try:
        base = root.resolve(strict=True)
    except OSError as exc:
        raise RevisionError(f"worktree cannot be read: {exc}") from exc
    current = base
    for part in PurePosixPath(relative).parts:
        current = current / part
        if _is_link(current):
            raise RevisionError(f"path traverses a symbolic link, junction or reparse point: {relative}")
    resolved = current.resolve()
    if resolved != base and base not in resolved.parents:
        raise RevisionError(f"path resolves outside its root: {relative}")
    return current


def context_path_observed(context_path: str, transcript: str) -> bool:
    """Whether a worker command transcript mentions a named context path.

    A context path ending in ``/**`` names a directory, which no command can print literally; it counts as
    observed when the transcript mentions the directory (or anything below it) on a path boundary, so
    ``src/**`` matches ``src/app.py`` and ``ls src`` but never ``src-other/x``. Other paths match as
    case-insensitive substrings; backslashes count as slashes on both sides.
    """
    wanted = context_path.replace("\\", "/").lower()
    text = transcript.replace("\\", "/").lower()
    if not wanted.endswith("/**"):
        return wanted in text
    directory = wanted[:-3].rstrip("/")
    if not directory:
        return True
    return re.search(r"(?<![\w.-])" + re.escape(directory) + r"(?![\w.-])", text) is not None


def revision_target_state(result: dict[str, Any]) -> str:
    """Accept only reviewed completions or blocks caused solely by recorded independent validation failure."""
    status = result.get("status")
    lifecycle = result.get("lifecycle_status")
    if status == "complete" and lifecycle in REVISABLE_LIFECYCLES and not result.get("failures"):
        return "complete"
    validation = result.get("validation")
    process = result.get("process")
    if (
        status == "failed"
        and lifecycle == "BLOCKED"
        and result.get("failures") == [VALIDATION_FAILURE]
        and isinstance(validation, dict)
        and validation.get("status") == "failed"
        and isinstance(process, dict)
        and process.get("timed_out") is False
        and not result.get("unauthorized_changed_paths")
        and result.get("primary_checkout_unchanged") is True
        and result.get("error_kind") in {None, "sandbox_policy_rejected"}
    ):
        return "validation_failed"
    raise RevisionError(
        "artifact is not a revisable result; revise accepts only REVIEW_PENDING/IMPLEMENTED completions or "
        "blocks caused solely by recorded independent validation failure"
    )


def load_feedback(
    feedback_file: str | Path | dict[str, Any], *, allowed_changed_paths: Sequence[str], worktree: Path
) -> dict[str, Any]:
    """Validate lead (Claude) review feedback and return its normalized findings plus a content digest."""
    try:
        value = (feedback_file if isinstance(feedback_file, dict) else
                 json.loads(Path(feedback_file).resolve(strict=True).read_text(encoding="utf-8")))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RevisionError(f"feedback file is not valid UTF-8 JSON: {exc}") from exc
    except OSError as exc:
        raise RevisionError(f"feedback file cannot be read: {exc}") from exc
    if not isinstance(value, dict) or set(value) != {"findings"}:
        raise RevisionError("feedback must be a JSON object containing only 'findings'")
    findings = value["findings"]
    if not isinstance(findings, list) or not findings or len(findings) > MAX_FINDINGS:
        raise RevisionError(f"feedback findings must be a list of 1 through {MAX_FINDINGS} entries")
    normalized: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for index, item in enumerate(findings):
        if not isinstance(item, dict) or set(item) != {"path", "issue", "expected_behavior"}:
            raise RevisionError(f"finding {index} must contain exactly path, issue, and expected_behavior")
        path = safe_relative_path(item["path"], f"finding {index} path")
        if not path_within_scope(path, allowed_changed_paths):
            raise RevisionError(f"finding {index} path is outside the task's allowed_changed_paths: {path}")
        ensure_no_links(worktree, path)
        texts = {}
        for key in ("issue", "expected_behavior"):
            text = item[key]
            if not isinstance(text, str) or not MIN_FINDING_TEXT <= len(text.strip()) <= MAX_FINDING_TEXT:
                raise RevisionError(
                    f"finding {index} {key} must be a precise description of "
                    f"{MIN_FINDING_TEXT} through {MAX_FINDING_TEXT} characters"
                )
            texts[key] = text.strip()
        # NTFS paths are case-insensitive: the same file spelled with another case is the same finding.
        key = (os.path.normcase(path), texts["issue"])
        if key in seen:
            raise RevisionError(f"finding {index} duplicates an earlier finding")
        seen.add(key)
        normalized.append({"path": path, **texts})
    digest_findings = [{**finding, "path": os.path.normcase(finding["path"])} for finding in normalized]
    digest = hashlib.sha256(
        json.dumps({"findings": digest_findings}, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    return {"findings": normalized, "sha256": digest}

from __future__ import annotations

import json
import re
import warnings
from dataclasses import dataclass, asdict
from pathlib import Path, PurePosixPath
from typing import Any


TASK_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
COMMIT_RE = re.compile(r"^[0-9a-fA-F]{40}$")
MODES = {"analyze", "implement", "review", "test"}
# One identifier: no leading "-" (it would be read as an option by `codex -m`), no whitespace or control characters.
MODEL_RE = re.compile(r"^[^\s\x00-\x1f\x7f-][^\s\x00-\x1f\x7f]{0,127}$")
RISK_LEVELS = {"low", "medium", "high"}
# Defaults for fields that are almost always the same, so the lead writes only task-specific values.
DEFAULT_MAX_TURNS = 6
DEFAULT_TIMEOUT_SECONDS = 900
TASK_FIELDS = {
    "task_id",
    "repo_root",
    "base_commit",
    "mode",
    "objective",
    "context_paths",
    "forbidden_context",
    "allowed_changed_paths",
    "acceptance_criteria",
    "plan_status",
    "risk",
    "review_required",
    "locked_decisions",
    "stop_conditions",
    "model",
    "max_turns",
    "max_total_turns",
    "max_extensions",
    "copy_ignored",
    "auto_continue",
    "timeout_seconds",
    "validation_command",
    "validation_timeout_seconds",
    "allow_subagents",
    "require_subscription_auth",
    "auto_review",
}


class ContractError(ValueError):
    pass


@dataclass(frozen=True)
class Task:
    task_id: str
    repo_root: Path
    base_commit: str
    mode: str
    objective: str
    context_paths: tuple[str, ...]
    forbidden_context: tuple[str, ...]
    allowed_changed_paths: tuple[str, ...]
    acceptance_criteria: tuple[str, ...]
    plan_status: str
    risk: str
    review_required: bool
    locked_decisions: tuple[str, ...]
    stop_conditions: tuple[str, ...]
    model: str | None
    max_turns: int
    max_total_turns: int | None
    max_extensions: int | None
    copy_ignored: tuple[str, ...]
    auto_continue: int
    timeout_seconds: int
    validation_command: tuple[str, ...] | None
    validation_timeout_seconds: int
    allow_subagents: bool
    require_subscription_auth: bool
    auto_review: bool | None  # None: follow the user setting; False: never use auto-review for this task
    raw: dict[str, Any]


def _string_list(raw: dict[str, Any], key: str, *, required: bool = True) -> tuple[str, ...]:
    value = raw.get(key)
    if value is None and not required:
        return ()
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise ContractError(f"{key} must be a list of non-empty strings")
    return tuple(item.strip() for item in value)


def _git_component(part: str) -> bool:
    """A path component Git or Windows treats as a repository directory (".git", ".git.", "git~1")."""
    folded = part.rstrip(". ").lower()
    return folded == ".git" or folded == "git~1"


def _relative_path(value: str, key: str) -> str:
    normalized = value.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise ContractError(f"{key} contains a path outside the repository: {value!r}")
    if "\x00" in normalized:
        raise ContractError(f"{key} contains an unsafe repository path: {value!r}")
    # Every component, not only the first: "src/file.txt:stream" is an NTFS alternate data stream and "a/C:x" a drive path.
    if any(":" in part for part in path.parts):
        raise ContractError(f"{key} contains ':' (a drive letter or alternate data stream): {value!r}")
    if any(_git_component(part) for part in path.parts):
        raise ContractError(f"{key} contains an unsafe repository path (the .git directory): {value!r}")
    wildcard_chars = {"*", "?", "[", "]"}
    if key != "copy_ignored" and any(char in normalized for char in wildcard_chars):
        is_directory_boundary = key in {"allowed_changed_paths", "context_paths"} and normalized.endswith("/**")
        prefix = normalized[:-3] if is_directory_boundary else normalized
        if not is_directory_boundary or any(char in prefix for char in wildcard_chars):
            raise ContractError(f"{key} supports only a trailing /** directory boundary: {value!r}")
    return path.as_posix()


def load_task(path: str | Path, *, defaults: dict[str, Any] | None = None,
              allow_missing_validation: bool = False) -> Task:
    """Load and validate a task file.

    ``allow_missing_validation`` is only for reading the task of an existing artifact (cleanup, inspection):
    version 1.0.0 let an implement or test task omit ``validation_command``, and its artifacts must stay
    readable. New work keeps the default, which requires the command.
    """
    task_path = Path(path).expanduser().resolve(strict=True)
    try:
        raw = json.loads(task_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ContractError(f"task file is not valid JSON: {exc}") from exc
    if not isinstance(raw, dict):
        raise ContractError("task file must contain a JSON object")
    defaults = defaults or {}
    for key in ("task_id", "repo_root", "base_commit", "context_paths"):
        if key not in raw and key in defaults:
            raw[key] = defaults[key]
    raw.setdefault("task_id", task_path.stem)
    def git_value(cwd: Path, *args: str) -> str:
        # The bridge's own resolver and isolated environment: git comes from PATH (never the current
        # directory, which may be the repository being inspected) and inherited GIT_DIR and friends are dropped.
        from .gitops import BridgeError, _git
        try:
            return _git(cwd, list(args)).stdout.strip()
        except BridgeError as exc:
            raise ContractError(str(exc)) from exc
    if "repo_root" not in raw:
        raw["repo_root"] = git_value(Path.cwd(), "rev-parse", "--show-toplevel")
    if "base_commit" not in raw:
        if not isinstance(raw["repo_root"], str):
            raise ContractError("repo_root must be an absolute path")
        root = Path(raw["repo_root"])
        raw["base_commit"] = git_value(root, "rev-parse", "HEAD")
        if git_value(root, "status", "--porcelain=v1", "--untracked-files=no"):
            warnings.warn("inferred base_commit uses HEAD; uncommitted tracked changes are excluded", stacklevel=2)
    raw.setdefault("context_paths", raw.get("allowed_changed_paths"))
    return validate_task(raw, allow_missing_validation=allow_missing_validation)


def validate_task(raw: dict[str, Any], *, allow_missing_validation: bool = False) -> Task:
    unknown = sorted(set(raw) - TASK_FIELDS)
    if unknown:
        raise ContractError(f"task contains unsupported fields: {', '.join(unknown)}")

    task_id = raw.get("task_id")
    if not isinstance(task_id, str) or not TASK_ID_RE.fullmatch(task_id):
        raise ContractError("task_id must match ^[a-z0-9][a-z0-9._-]{0,63}$")

    repo_value = raw.get("repo_root")
    if not isinstance(repo_value, str) or not Path(repo_value).is_absolute():
        raise ContractError("repo_root must be an absolute path")
    repo_root = Path(repo_value).expanduser().resolve(strict=True)
    if not repo_root.is_dir():
        raise ContractError("repo_root must be a directory")

    base_commit = raw.get("base_commit")
    if not isinstance(base_commit, str) or not COMMIT_RE.fullmatch(base_commit):
        raise ContractError("base_commit must be a full 40-character Git commit ID")

    mode = raw.get("mode")
    if not isinstance(mode, str) or mode not in MODES:
        raise ContractError(f"mode must be one of {sorted(MODES)}")

    objective = raw.get("objective")
    if not isinstance(objective, str) or not objective.strip() or len(objective) > 10_000:
        raise ContractError("objective must be a non-empty string no longer than 10,000 characters")

    context_paths = tuple(_relative_path(item, "context_paths") for item in _string_list(raw, "context_paths"))
    allowed_changed_paths = tuple(
        _relative_path(item, "allowed_changed_paths")
        for item in _string_list(raw, "allowed_changed_paths")
    )
    forbidden_context = _string_list(raw, "forbidden_context", required=False)
    copy_ignored = tuple(_relative_path(item, "copy_ignored")
                         for item in _string_list(raw, "copy_ignored", required=False))
    auto_continue = raw.get("auto_continue", 0)
    if isinstance(auto_continue, bool) or not isinstance(auto_continue, int) or not 0 <= auto_continue <= 3:
        raise ContractError("auto_continue must be an integer from 0 through 3")
    acceptance_criteria = _string_list(raw, "acceptance_criteria")
    if not acceptance_criteria:
        raise ContractError("acceptance_criteria must list at least one observable criterion")
    plan_status = raw.get("plan_status", "READY")
    if plan_status != "READY":
        raise ContractError("plan_status must be READY before delegation")
    risk = raw.get("risk", "medium")
    if not isinstance(risk, str) or risk not in RISK_LEVELS:
        raise ContractError(f"risk must be one of {sorted(RISK_LEVELS)}")
    review_required = raw.get("review_required", True)
    if not isinstance(review_required, bool):
        raise ContractError("review_required must be a boolean")
    locked_decisions = _string_list(raw, "locked_decisions", required=False)
    stop_conditions = _string_list(raw, "stop_conditions", required=False)

    if mode in {"analyze", "review"} and allowed_changed_paths:
        raise ContractError(f"{mode} tasks cannot allow changed paths")
    if mode == "implement" and not allowed_changed_paths:
        raise ContractError("implement tasks require at least one allowed_changed_path")

    model = raw.get("model")
    if model is not None and (not isinstance(model, str) or not model.strip()):
        raise ContractError("model must be null or a non-empty string")
    if isinstance(model, str) and not MODEL_RE.fullmatch(model.strip()):
        raise ContractError("model must be one identifier: no whitespace and not starting with '-'")

    max_turns = raw.get("max_turns", DEFAULT_MAX_TURNS)
    if not isinstance(max_turns, int) or isinstance(max_turns, bool) or not 1 <= max_turns <= 12:
        raise ContractError("max_turns must be an integer from 1 through 12")
    # max_total_turns is accepted and ignored, so a task file written for 1.0.0 still loads.
    # max_extensions caps automatic grants only; manual continuation remains unbounded.
    max_total_turns = raw.get("max_total_turns")
    if max_total_turns is not None and (
        not isinstance(max_total_turns, int) or isinstance(max_total_turns, bool) or max_total_turns < 1
    ):
        raise ContractError("max_total_turns must be a positive integer when present")
    max_extensions = raw.get("max_extensions")
    if max_extensions is not None and (
        not isinstance(max_extensions, int) or isinstance(max_extensions, bool) or max_extensions < 0
    ):
        raise ContractError("max_extensions must be a non-negative integer when present")
    timeout_seconds = raw.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS)
    if not isinstance(timeout_seconds, int) or isinstance(timeout_seconds, bool) or not 5 <= timeout_seconds <= 1800:
        raise ContractError("timeout_seconds must be an integer from 5 through 1800")

    validation = raw.get("validation_command")
    if validation is not None:
        if (
            not isinstance(validation, list)
            or not validation
            or len(validation) > 24
            or any(not isinstance(item, str) or not item for item in validation)
        ):
            raise ContractError("validation_command must be null or a non-empty argument array")
        validation_command: tuple[str, ...] | None = tuple(validation)
    else:
        validation_command = None
    # A writing task is accepted only after independent validation passed, so it cannot omit the command.
    if mode in {"implement", "test"} and validation_command is None and not allow_missing_validation:
        raise ContractError(f"{mode} tasks require a validation_command")
    validation_timeout = raw.get("validation_timeout_seconds", 600)
    if not isinstance(validation_timeout, int) or isinstance(validation_timeout, bool) or not 1 <= validation_timeout <= 1800:
        raise ContractError("validation_timeout_seconds must be an integer from 1 through 1800")

    allow_subagents = raw.get("allow_subagents", False)
    if allow_subagents is not False:
        raise ContractError("allow_subagents must be false (omit it to use the default)")
    require_subscription_auth = raw.get("require_subscription_auth", True)
    if require_subscription_auth is not True:
        raise ContractError("require_subscription_auth must be true (omit it to use the default)")
    # A task can only opt out: whether auto-review is on at all is the user's setting, and a task file must
    # stay valid on a machine where that setting is off (true is then ignored with a warning, not refused).
    auto_review = raw.get("auto_review")
    if auto_review is not None and not isinstance(auto_review, bool):
        raise ContractError("auto_review must be true, false or null (omit it to follow the user setting)")

    task = Task(
        task_id=task_id,
        repo_root=repo_root,
        base_commit=base_commit.lower(),
        mode=mode,
        objective=objective.strip(),
        context_paths=context_paths,
        forbidden_context=forbidden_context,
        allowed_changed_paths=allowed_changed_paths,
        acceptance_criteria=acceptance_criteria,
        plan_status=plan_status,
        risk=risk,
        review_required=review_required,
        locked_decisions=locked_decisions,
        stop_conditions=stop_conditions,
        model=model.strip() if isinstance(model, str) else None,
        max_turns=max_turns,
        max_total_turns=max_total_turns,
        max_extensions=max_extensions,
        copy_ignored=copy_ignored,
        auto_continue=auto_continue,
        timeout_seconds=timeout_seconds,
        validation_command=validation_command,
        validation_timeout_seconds=validation_timeout,
        allow_subagents=allow_subagents,
        require_subscription_auth=require_subscription_auth,
        auto_review=auto_review,
        raw=raw,
    )
    resolved = asdict(task)
    resolved.pop("raw")
    resolved["repo_root"] = str(repo_root)
    for key, value in resolved.items():
        if isinstance(value, tuple):
            resolved[key] = list(value)
    return Task(**{**task.__dict__, "raw": resolved})

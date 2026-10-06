"""Claude-led bridge: run one bounded Codex CLI worker per task in an isolated Git worktree.

The lead (Claude) owns scope, review and acceptance. Codex implements inside its sandbox.
Everything the bridge produces stays in private external state, never in the repository.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import time
from dataclasses import replace
from pathlib import Path
from typing import Any

from . import handoff as shared_handoff
from .codexcli import CodexCliError, CodexCommand, billing_overrides, check_subscription_account, codex_version
from .codexcli import fetch_usage, find_codex, read_account_and_limits, classify_usage, read_usage_cache
from .contracts import Task, load_task
from .gitops import (
    BridgeError, _git, _git_retry, _verify_repository, _worktree_fingerprint, active_task_record, changed_paths,
    atomic_write_json, clear_stale_task_lock, complete_diff, path_allowed, primary_status,
    primary_status_changes, task_lock, utc_now, utc_stamp, write_json,
    snapshot_tree, tree_diff, tree_diffstat,
)
from .process import ProcessResult, run_process
from .revision import MAX_CODEX_REVISION_TURNS, load_feedback, revision_target_state, safe_relative_path, ensure_no_links
from .state import (PACKAGE_ROOT, ensure_state_root, state_root, short_worktree_path,
                    recorded_worktree, artifact_owns_worktree)

REPLY_SCHEMA_PATH = PACKAGE_ROOT / "schemas" / "reply.schema.json"
EFFORTS = {"low", "medium", "high", "xhigh", "max"}
WRITING_MODES = {"implement", "test"}
CHECKPOINT_TIMEOUT_SECONDS = 180
FORBIDDEN_ITEM_TYPES = {"web_search", "mcp_tool_call", "collab_tool_call"}


def artifact_root() -> Path:
    return state_root() / "artifacts" / "codex"


def usage_cache() -> Path:
    return state_root() / "cache" / "codex-usage.json"


def _shadow(create: bool = False) -> Path:
    ensure_state_root()
    root = artifact_root()
    if create:
        root.mkdir(parents=True, exist_ok=True)
    return root


# ------------------------------------------------------------------ preflight

def preflight() -> dict[str, Any]:
    overrides = billing_overrides()
    if overrides:
        raise BridgeError("Billing overrides are set; subscription-only routing cannot be confirmed: " + ", ".join(overrides))
    command = find_codex()
    cached = read_usage_cache(usage_cache())
    version = cached.get("_codex_version") if cached is not None else codex_version(command)
    account, limits, limits_error = read_account_and_limits(command)
    auth = check_subscription_account(account)
    usage = classify_usage(limits) if limits is not None else {
        "gate": "unknown", "fallback_eligible": False, "gate_reason": f"usage unavailable: {limits_error}"}
    return {"command": command.public(), "version": version, **auth, "api_key_used": False,
            "conflicting_overrides": [], "usage": usage}


def _command_from(record: dict[str, Any]) -> CodexCommand:
    cmd = record.get("command") or {}
    return CodexCommand(Path(cmd["executable"]), tuple(cmd.get("prefix_args") or ()))


def usage(refresh: bool = False) -> dict[str, Any]:
    _shadow()
    command = find_codex()
    return fetch_usage(command, usage_cache(), use_cache=not refresh)


def _gate_preflight(pre: dict[str, Any]) -> dict[str, Any]:
    """Use the usage that preflight already read as the launch gate (no second app-server start)."""
    record = dict(pre.get("usage") or {"gate": "unknown", "gate_reason": "preflight returned no usage"})
    record["retrieval"] = {"mode": "live", "age_seconds": 0, "via": "preflight"}
    if record.get("gate") != "available":
        raise CapacityPaused(record)
    try:
        cache = usage_cache()
        atomic_write_json(cache, {**record, "_cached_at": time.time(), "_codex_version": pre.get("version")})
    except OSError:
        pass
    return record


class CapacityPaused(BridgeError):
    def __init__(self, usage_record: dict[str, Any]):
        super().__init__(f"Codex capacity gate is {usage_record.get('gate')}: {usage_record.get('gate_reason')}")
        self.usage = usage_record


# ------------------------------------------------------------------ assignment and arguments

WORKER_CHECK_MODES = {"auto", "run", "skip"}
SANDBOX_GROUP = "CodexSandboxUsers"


def _acl_text(directory: Path) -> str:
    try:
        return run_process(Path(shutil.which("icacls") or "icacls"), [str(directory)], cwd=Path.home(),
                           timeout_seconds=15).stdout
    except (OSError, ValueError):
        return ""


def sandbox_can_run(executable: Path, *, home: Path | None = None, acl_text=_acl_text) -> bool:
    """Whether Codex's Windows sandbox accounts can start this executable.

    The elevated sandbox runs commands as separate local accounts (group CodexSandboxUsers). They can
    read programs outside the user's profile, but not inside it unless the program's folder grants
    that group access (for example `icacls <python folder> /grant "CodexSandboxUsers:(OI)(CI)RX"`).
    Store programs under Program Files/WindowsApps are also unavailable to these accounts.
    """
    home = (home or Path.home()).resolve()
    resolved = executable.resolve()
    parts = str(resolved).replace("\\", "/").lower().split("/")
    if any(a == "program files" and b == "windowsapps" for a, b in zip(parts, parts[1:])):
        return False
    if home not in resolved.parents:
        return True
    return SANDBOX_GROUP.lower() in acl_text(resolved.parent).lower()


def _validation_executable(task: Task) -> Path | None:
    if not task.validation_command:
        return None
    first = Path(task.validation_command[0])
    if first.is_absolute():
        return first if first.is_file() else None
    found = shutil.which(task.validation_command[0])
    return Path(found) if found else None


def worker_checks_mode(task: Task | None = None) -> str:
    """Whether the worker runs checks itself before reporting.

    `auto` (the default) runs them unless that would fail: on Windows the elevated sandbox cannot start an
    interpreter inside the user's profile unless its folder grants the sandbox group access. The bridge always
    runs validation_command itself, outside the sandbox, and that is the acceptance record.
    """
    mode = os.environ.get("CODEX_BRIDGE_WORKER_CHECKS", "auto").strip().lower()
    if mode not in WORKER_CHECK_MODES:
        raise BridgeError("CODEX_BRIDGE_WORKER_CHECKS must be auto, run or skip")
    if mode != "auto":
        return mode
    if os.name != "nt":
        return "run"
    executable = _validation_executable(task) if task is not None else None
    return "run" if executable is not None and sandbox_can_run(executable) else "skip"


def _check_rule(task: Task | None = None) -> str:
    if worker_checks_mode(task) == "skip":
        return ("- Do not run tests, the validation_command or language interpreters, and do not run git status or git "
                "diff: interpreters cannot start in this sandbox, and after you finish the bridge runs "
                "validation_command and checks every changed path itself. Read the code carefully instead and report "
                "checks as not_run.\n")
    return ("- Run validation_command (or a narrower focused check) before you finish and fix what it shows; repeat "
            "only after a change. Run Python with -B (or PYTHONDONTWRITEBYTECODE=1) and remove any other files your "
            "checks create, since every file outside allowed_changed_paths blocks the result. Do not run git status "
            "or git diff to confirm scope: the bridge checks changed paths itself.\n")


FINAL_RULE = ("Your final message must be only the JSON object required by the output schema; keep summary short "
              "and list repository-relative paths in files_read and files_changed.")


def _assignment(task: Task, *, continuation: dict | None = None, granted: int | None = None,
                revision: list | None = None, handoff: dict | None = None) -> str:
    # Continuations and revisions resume the same session, which already holds the contract and rules,
    # so only the new instruction is sent.
    if continuation is not None:
        return (f"The lead granted about {granted} more work steps in this same session. Continue without repeating "
                "completed work; keep the same contract, scope and stop conditions. Your prior extension request: "
                + json.dumps(continuation, ensure_ascii=False) + "\n" + FINAL_RULE)
    if revision is not None:
        return (f"The lead reviewed your completed work and grants about {granted} work steps to correct these "
                "findings. Fix only these defects inside allowed_changed_paths, keep everything else as it is, and do "
                "not redo unrelated work. Findings: " + json.dumps(revision, ensure_ascii=False) + "\n"
                + ("Re-run your check after the fix. " if worker_checks_mode(task) == "run" else "") + FINAL_RULE)
    contract: dict[str, Any] = {
        "task_id": task.task_id, "mode": task.mode, "objective": task.objective,
        "context_paths": list(task.context_paths), "allowed_changed_paths": list(task.allowed_changed_paths),
        "acceptance_criteria": list(task.acceptance_criteria),
    }
    for key, value in (("locked_decisions", task.locked_decisions), ("stop_conditions", task.stop_conditions),
                       ("forbidden_context", task.forbidden_context)):
        if value:
            contract[key] = list(value)
    contract["risk"] = task.risk
    contract["validation_command"] = list(task.validation_command) if task.validation_command else None
    writing = task.mode in WRITING_MODES
    text = (
        "You are a single bounded Codex worker. A Claude lead owns planning, review and acceptance; you implement "
        "only this contract, only in the current working directory.\n"
        "Rules:\n"
        "- Open every named context path before drawing conclusions; never claim a file was read unless you read it.\n"
        "- Read other files only when needed for this change"
        + (" and never the forbidden_context" if task.forbidden_context else "") + ".\n"
        + ("- Edit only allowed_changed_paths. Do not create, modify or delete anything else.\n" if writing else
           "- This is a read-only task: do not change any file.\n")
        + "- Do not use the network, install packages, spawn agents, use web search or MCP tools, change credentials "
          "or configuration, or run git commit, push, reset, stash, checkout, rebase or clean.\n"
        + _check_rule(task)
        + "- If you cannot finish within this segment, stop at a safe point and return extension_requested with exact "
          "completed_work, remaining_work, reason and requested_turns (1-24 work steps). Otherwise requested_turns is 0 "
          "and the lists are empty.\n"
          "- Return blocked with concrete blockers if a stop condition applies or the scope must change.\n"
          f"- {FINAL_RULE}\n"
          f"- Budget: about {task.max_turns} focused work steps for this segment.\n"
    )
    if handoff is not None:
        text += ("\nThe working directory already contains verified inherited changes from a previous worker on the "
                 "same base commit: " + json.dumps(handoff["inherited_changed_paths"], ensure_ascii=False)
                 + ". Treat them as part of the combined change and continue from that state.\n")
    return text + "\nContract:\n" + json.dumps(contract, indent=2, ensure_ascii=False)


def _strict_schema(destination: Path) -> Path:
    """Structured outputs reject numeric bounds; the bridge validates those itself."""
    schema = json.loads(REPLY_SCHEMA_PATH.read_text(encoding="utf-8"))

    def strip(node: Any) -> Any:
        if isinstance(node, dict):
            return {k: strip(v) for k, v in node.items() if k not in {"minimum", "maximum"}}
        if isinstance(node, list):
            return [strip(v) for v in node]
        return node

    destination.write_text(json.dumps(strip(schema), indent=2), encoding="utf-8")
    return destination


WINDOWS_SANDBOX_MODES = {"elevated", "unelevated", "mxc"}
POLICY_REJECTION = "blocked by policy"


def windows_sandbox_mode() -> str:
    """Codex enforces its sandbox on Windows only when `windows.sandbox` is configured.

    `--ignore-user-config` drops the user's setting, so the bridge always passes one explicitly.
    Without it, every worker command is rejected under approvals=never.
    """
    mode = os.environ.get("CODEX_BRIDGE_WINDOWS_SANDBOX", "elevated").strip().lower()
    if mode not in WINDOWS_SANDBOX_MODES:
        raise BridgeError("CODEX_BRIDGE_WINDOWS_SANDBOX must be elevated, unelevated or mxc")
    return mode


def _windows_args(is_windows: bool) -> list[str]:
    return ["-c", f'windows.sandbox="{windows_sandbox_mode()}"'] if is_windows else []


def _common_config(task: Task, sandbox: str, effort: str | None) -> list[str]:
    args = [
        "--json", "--ignore-user-config",
        "-c", 'approval_policy="never"',
        "-c", f'sandbox_mode="{sandbox}"',
        "-c", "sandbox_workspace_write.network_access=false",
        "-c", 'web_search="disabled"',
        *_windows_args(os.name == "nt"),
    ]
    if task.model:
        args.extend(["-m", task.model])
    if effort:
        args.extend(["-c", f'model_reasoning_effort="{effort}"'])
    return args


def _exec_args(command: CodexCommand, task: Task, worktree: Path, schema: Path, last: Path,
               *, sandbox: str, effort: str | None, resume: str | None) -> list[str]:
    common = _common_config(task, sandbox, effort) + ["--output-schema", str(schema), "-o", str(last)]
    if resume:
        return command.args("exec", "resume", *common, resume, "-")
    return command.args("exec", *common, "-s", sandbox, "-C", str(worktree), "-")


# ------------------------------------------------------------------ event parsing

def parse_events(stdout: str) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            events.append(value)
    thread_id = None
    messages: list[str] = []
    commands: list[dict[str, Any]] = []
    file_changes: list[dict[str, Any]] = []
    forbidden: list[str] = []
    errors: list[str] = []
    usage: dict[str, int] = {}
    turn_failed = None
    turns_completed = 0
    for event in events:
        kind = event.get("type")
        if kind == "thread.started" and isinstance(event.get("thread_id"), str):
            thread_id = event["thread_id"]
        elif kind == "turn.completed":
            turns_completed += 1
            for key, value in (event.get("usage") or {}).items():
                if isinstance(value, int) and not isinstance(value, bool):
                    usage[key] = usage.get(key, 0) + value
        elif kind == "turn.failed":
            error = event.get("error") or {}
            turn_failed = error.get("message") if isinstance(error, dict) else str(error)
        elif kind == "error" and isinstance(event.get("message"), str):
            errors.append(event["message"])
        elif kind == "item.completed" and isinstance(event.get("item"), dict):
            item = event["item"]
            item_type = item.get("type")
            if item_type == "agent_message" and isinstance(item.get("text"), str):
                messages.append(item["text"])
            elif item_type == "command_execution":
                commands.append({"command": item.get("command"), "exit_code": item.get("exit_code"),
                                 "status": item.get("status")})
            elif item_type == "file_change":
                for change in item.get("changes") or []:
                    if isinstance(change, dict):
                        file_changes.append({"path": change.get("path"), "kind": change.get("kind")})
            elif item_type in FORBIDDEN_ITEM_TYPES:
                forbidden.append(item_type)
    return {"thread_id": thread_id, "messages": messages, "commands": commands, "file_changes": file_changes,
            "forbidden_items": forbidden, "errors": errors, "usage": usage, "turn_failed": turn_failed,
            "turns_completed": turns_completed, "event_count": len(events)}


def classify_error(text: str | None) -> str | None:
    if not text:
        return None
    lower = text.lower()
    if any(term in lower for term in ("usage limit", "rate limit", "429", "quota")):
        return "rate_limit"
    if any(term in lower for term in ("401", "unauthorized", "not logged in", "log in", "login")):
        return "authentication"
    return "codex_error"


def parse_claim(text: str | None) -> tuple[dict[str, Any] | None, str | None]:
    if not text or not text.strip():
        return None, "missing structured reply"
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        raw = raw[raw.find("{"):] if "{" in raw else raw
    try:
        claim = json.loads(raw)
    except json.JSONDecodeError:
        return None, "Codex final message was not structured JSON"
    expected = {"status", "summary", "findings", "files_read", "files_changed", "checks", "blockers", "extension_request"}
    if not isinstance(claim, dict) or set(claim) != expected:
        return None, "Codex reply did not match the result contract"
    if claim["status"] not in {"complete", "partial", "blocked", "extension_requested"} or not isinstance(claim["summary"], str):
        return None, "Codex reply had no valid status"
    for key in ("findings", "files_read", "files_changed", "blockers"):
        if not isinstance(claim[key], list) or any(not isinstance(x, str) for x in claim[key]):
            return None, f"Codex reply has invalid {key}"
    for check in claim["checks"] if isinstance(claim["checks"], list) else [None]:
        if (not isinstance(check, dict) or set(check) != {"description", "reported_outcome", "evidence"}
                or check["reported_outcome"] not in {"passed", "failed", "not_run"}):
            return None, "Codex reply has invalid checks"
    request = claim["extension_request"]
    if not isinstance(request, dict) or set(request) != {"completed_work", "remaining_work", "reason", "requested_turns"}:
        return None, "Codex reply has invalid extension_request"
    turns = request["requested_turns"]
    if not isinstance(turns, int) or isinstance(turns, bool) or not 0 <= turns <= 24:
        return None, "Codex reply requested an invalid number of turns"
    if claim["status"] != "extension_requested" and turns != 0:
        return None, "non-extension Codex reply requested turns"
    return claim, None


def extension_of(claim: dict[str, Any] | None) -> dict[str, Any] | None:
    if not claim or claim.get("status") != "extension_requested":
        return None
    request = claim["extension_request"]
    if not request["remaining_work"] or not request["reason"].strip() or not 1 <= request["requested_turns"] <= 24:
        return None
    return request


def _context_evidence(task: Task, parsed: dict[str, Any]) -> dict[str, Any]:
    text = "\n".join(str(c.get("command") or "") for c in parsed["commands"]).replace("\\", "/").lower()
    observed = [p for p in task.context_paths if p.lower() in text]
    missing = [p for p in task.context_paths if p not in observed]
    return {"status": "verified" if not missing else "not_observed", "method": "command transcript match",
            "observed_context_paths": observed, "missing_context_paths": missing}


# ------------------------------------------------------------------ segments

def _run_codex(command: CodexCommand, task: Task, worktree: Path, artifact: Path, label: str, prompt: str,
               *, sandbox: str, effort: str | None, resume: str | None, timeout: int) -> tuple[ProcessResult, dict, str]:
    schema = _strict_schema(artifact / "reply.output-schema.json")
    last = artifact / f"{label}.last-message.txt"
    (artifact / f"{label}.prompt.txt").write_text(prompt, encoding="utf-8")
    process = run_process(command.executable, _exec_args(command, task, worktree, schema, last, sandbox=sandbox,
                                                         effort=effort, resume=resume),
                          cwd=worktree, timeout_seconds=timeout, stdin_text=prompt)
    (artifact / f"{label}.events.jsonl").write_text(process.stdout, encoding="utf-8")
    (artifact / f"{label}.stderr.log").write_text(process.stderr, encoding="utf-8")
    parsed = parse_events(process.stdout)
    final = last.read_text(encoding="utf-8") if last.is_file() else (parsed["messages"][-1] if parsed["messages"] else "")
    return process, parsed, final


def _segment(command: CodexCommand, task: Task, worktree: Path, artifact: Path, label: str, prompt: str,
             *, effort: str | None, resume: str | None = None) -> dict[str, Any]:
    sandbox = "workspace-write" if task.mode in WRITING_MODES else "read-only"
    process, parsed, final = _run_codex(command, task, worktree, artifact, label, prompt, sandbox=sandbox,
                                        effort=effort, resume=resume, timeout=task.timeout_seconds)
    claim, error = parse_claim(final)
    time_cap = bool(process.timed_out and parsed["thread_id"])
    checkpoint = None
    if claim is None and parsed["thread_id"] and not process.interrupted and (process.exit_code == 0 or time_cap):
        claim, error, checkpoint = _checkpoint(command, task, worktree, artifact, label, parsed["thread_id"], effort)
    failure_text = parsed["turn_failed"] or (parsed["errors"][-1] if parsed["errors"] and process.exit_code else None)
    error_kind = classify_error(failure_text)
    rejections = process.stderr.count(POLICY_REJECTION)
    policy_warning = None
    if rejections:
        error_kind = error_kind or "sandbox_policy_rejected"
        policy_warning = f"Codex rejected {rejections} worker command(s) as 'blocked by policy'"
        executed_commands = any(c.get("exit_code") is not None for c in parsed["commands"])
        changed = changed_paths(worktree, task.base_commit) if task.mode in WRITING_MODES else []
        if not executed_commands and not changed:
            error = (error + "; " if error else "") + policy_warning + "; every command was refused and nothing changed"
        else:
            policy_warning += "; warning only because worktree changes or executed commands were observed"
    return {"process": process, "parsed": parsed, "claim": claim, "error": error, "time_cap": time_cap,
            "checkpoint": checkpoint, "label": label, "thread_id": parsed["thread_id"],
            "error_kind": error_kind, "failure_text": failure_text, "policy_warning": policy_warning,
            "context_evidence": _context_evidence(task, parsed)}


def _checkpoint(command: CodexCommand, task: Task, worktree: Path, artifact: Path, label: str, thread_id: str,
                effort: str | None) -> tuple[dict | None, str | None, dict[str, Any]]:
    before = _worktree_fingerprint(worktree, task.base_commit) if task.mode in WRITING_MODES else None
    prompt = ("Do not run commands or change files. Report a structured account of the work already done in this "
              "session as the required JSON object: complete only if finished, blocked if unable to continue, or "
              "extension_requested with exact remaining work. Do not claim reads or changes that did not happen.")
    process, parsed, final = _run_codex(command, task, worktree, artifact, f"{label}.checkpoint", prompt,
                                        sandbox="read-only", effort=effort, resume=thread_id,
                                        timeout=min(task.timeout_seconds, CHECKPOINT_TIMEOUT_SECONDS))
    claim, error = parse_claim(final)
    if before is not None and _worktree_fingerprint(worktree, task.base_commit) != before:
        error = "checkpoint changed the worktree"
    elif parsed["thread_id"] not in (None, thread_id):
        error = "checkpoint resumed a different session"
    elif process.timed_out or process.interrupted:
        error = "checkpoint timed out or was interrupted"
    record = {"process": _process_record(process), "error": error, "usage": parsed["usage"]}
    if claim is not None and error is None and process.exit_code == 0:
        return claim, None, record
    return None, f"checkpoint format failed: {error or process.exit_code}", record


def _process_record(result: ProcessResult) -> dict[str, Any]:
    return {"exit_code": result.exit_code, "elapsed_seconds": result.elapsed_seconds,
            "timed_out": result.timed_out, "interrupted": result.interrupted}


_PYTHON_NAME = re.compile(r"^(?:python(?:3(?:\.\d+)?)?|pythonw|py)(?:\.exe)?$", re.IGNORECASE)


def _validation_arguments(executable: Path, arguments: list[str]) -> list[str]:
    """Stop Python validation interpreters writing bytecode (-B) without copying the environment."""
    if _PYTHON_NAME.match(executable.name) and "-B" not in _leading_flags(arguments):
        return ["-B", *arguments]
    return list(arguments)


def _leading_flags(arguments: list[str]) -> list[str]:
    flags: list[str] = []
    for item in arguments:
        if not item.startswith("-") or item in {"-", "-c", "-m"}:
            break
        flags.append(item)
    return flags


def _validation(task: Task, worktree: Path, artifact: Path) -> tuple[dict[str, Any], str | None]:
    if not task.validation_command:
        return {"status": "not_run", "requested": None}, None
    requested = Path(task.validation_command[0])
    if requested.is_absolute() or requested.parent != Path("."):
        candidates = [requested] if requested.is_absolute() else [worktree / requested, task.repo_root / requested]
        executable = next((p.resolve() for p in candidates if p.is_file()), None)
    else:
        found = shutil.which(task.validation_command[0])
        executable = Path(found).resolve() if found else None
    if executable is None:
        return {"status": "failed", "requested": list(task.validation_command)}, "validation executable not found"
    before = set(changed_paths(worktree, task.base_commit)) if task.mode in WRITING_MODES else set()
    process = run_process(executable, _validation_arguments(executable, task.validation_command[1:]), cwd=worktree,
                          timeout_seconds=task.validation_timeout_seconds)
    byproducts = sorted(set(changed_paths(worktree, task.base_commit)) - before) if task.mode in WRITING_MODES else []
    (artifact / "validation.stdout.log").write_text(process.stdout, encoding="utf-8")
    (artifact / "validation.stderr.log").write_text(process.stderr, encoding="utf-8")
    status = "passed" if process.exit_code == 0 and not process.timed_out else "failed"
    return ({"status": status, "requested": list(task.validation_command), "process": _process_record(process),
             "timeout_seconds": task.validation_timeout_seconds,
             "stdout_path": str(artifact / "validation.stdout.log"), "byproduct_paths": byproducts},
            None if status == "passed" else "independent validation failed")


def _normalized_claims(worktree: Path, paths: list[str]) -> tuple[set[str], list[str]]:
    root = worktree.resolve(strict=True)
    inside: set[str] = set()
    outside: list[str] = []
    for raw in paths:
        candidate = Path(raw)
        resolved = (candidate if candidate.is_absolute() else root / candidate).resolve()
        try:
            inside.add(resolved.relative_to(root).as_posix())
        except ValueError:
            outside.append(raw)
    return inside, outside


def environment_only_blockers(claim: dict[str, Any] | None) -> bool:
    """Fail closed unless every blocker describes an unavailable environment check."""
    blockers = claim.get("blockers") if claim else None
    if not blockers:
        return False
    for blocker in blockers:
        text = blocker.lower()
        if re.search(r"decision|clarif|contradict|scope|requirements?|approval|unfinished|implement|bug|defect|unclear|choose|choice|question|specification|acceptance|need.*(?:owner|user|lead)", text):
            return False
        environment = re.search(r"sandbox|offline|network|policy|permission|access denied|environment|not installed|not found|unavailable|missing (?:jdk|java|gradle|python|tool)", text)
        check = re.search(r"tests?|build|validat|gradle|dependencies|download|network|command|execut|python|jdk|java|toolchain", text)
        unavailable = re.search(r"cannot|can't|could not|unable|blocked|denied|refused|unavailable|missing|not found|not installed|offline|disabled", text)
        if not (environment and check and unavailable):
            return False
    return True


def _finish(task: Task, artifact: Path, worktree: Path, seg: dict[str, Any], primary_before: str,
            run_settings: dict[str, Any], prior: dict[str, Any] | None = None) -> dict[str, Any]:
    process: ProcessResult = seg["process"]
    claim = seg["claim"]
    failures: list[str] = []
    warnings: list[str] = []
    if seg.get("policy_warning"):
        warnings.append(seg["policy_warning"])
    writing = task.mode in WRITING_MODES
    changed = changed_paths(worktree, task.base_commit) if writing else []
    extension = extension_of(claim)
    checkpoint_failed = bool(seg["checkpoint"] and seg["error"])
    if process.timed_out and not (seg["time_cap"] and claim is not None):
        failures.append("Codex work segment timed out")
    if process.exit_code not in (0, None) and not (seg["time_cap"] and claim is not None):
        failures.append(f"Codex exited with {process.exit_code}")
    if seg["failure_text"] and claim is None:
        failures.append(f"Codex reported: {seg['failure_text'][:300]}")
    if seg["error"]:
        failures.append(seg["error"])
    if claim is None:
        failures.append("missing structured reply")
    elif claim["status"] == "blocked":
        if changed and environment_only_blockers(claim):
            warnings.append("environment-only worker blockers with preserved changes: independent validation governs review")
        else:
            failures.append("Codex reported blocked")
            warnings.append("worker blocked rule: no preserved changes or a non-environment/unspecified blocker")
    elif claim["status"] == "partial":
        failures.append("Codex reported partial")
    elif claim["status"] == "extension_requested" and extension is None:
        failures.append("invalid extension request")
    if extension is not None and not seg["thread_id"]:
        failures.append("extension requested without a resumable session ID")
    if seg["parsed"]["forbidden_items"]:
        failures.append("Codex used forbidden tools: " + ", ".join(sorted(set(seg["parsed"]["forbidden_items"]))))
    if seg["context_evidence"]["status"] != "verified":
        warnings.append(f"context not observed: {len(seg['context_evidence']['missing_context_paths'])} named paths (see result.json)")
    if writing and claim is not None and claim["status"] == "complete":
        claimed, outside = _normalized_claims(worktree, claim["files_changed"])
        if outside:
            failures.append("Codex claimed file changes outside the worktree")
        if claimed - set(changed):
            failures.append("Codex claimed file changes that are absent from the worktree")
    unauthorized = [p for p in changed if not path_allowed(p, task.allowed_changed_paths)]
    if unauthorized:
        failures.append("out-of-scope paths changed")
    if writing and _git(worktree, ["rev-parse", "HEAD"]).stdout.strip().lower() != task.base_commit:
        failures.append("worker changed the starting commit")
    diff_path = artifact / "diff.patch"
    write_json(artifact / "changed-paths.json", changed)
    primary_after = primary_status(task)
    (artifact / "primary-status.after.txt").write_text(primary_after, encoding="utf-8")
    primary_unchanged = primary_after == primary_before
    primary_changes = primary_status_changes(primary_before, primary_after)
    inside = [p for p in primary_changes if path_allowed(p, task.allowed_changed_paths)]
    outside = [p for p in primary_changes if not path_allowed(p, task.allowed_changed_paths)]
    if inside:
        failures.append("primary checkout changed inside the task's allowed paths: " + ", ".join(inside))
    if outside:
        warnings.append("primary checkout changed outside the task's paths during delegation "
                        "(another worker, the lead or the user): " + ", ".join(outside[:20]))
    if not failures and extension is None:
        validation, validation_error = _validation(task, worktree, artifact)
        if validation_error:
            failures.append(validation_error)
        if validation.get("byproduct_paths"):
            warnings.append("validation created files in the worktree (remove or ignore them before handoff): "
                            + ", ".join(validation["byproduct_paths"]))
    else:
        validation = {"status": "not_run", "requested": list(task.validation_command) if task.validation_command else None}
    # Snapshot after validation too, since a validation command can edit the worktree.
    changed = changed_paths(worktree, task.base_commit) if writing else []
    unauthorized = [p for p in changed if not path_allowed(p, task.allowed_changed_paths)]
    if unauthorized and "out-of-scope paths changed" not in failures:
        failures.append("out-of-scope paths changed")
    tree = snapshot_tree(worktree, artifact) if writing else task.base_commit
    previous = (prior.get("segments") or [{}])[-1].get("tree", task.base_commit) if prior else task.base_commit
    diff = tree_diff(worktree, task.base_commit, tree) if writing else ""
    diff_path.write_text(diff, encoding="utf-8", newline="\n")
    (artifact / "interdiff.patch").write_text(tree_diff(worktree, previous, tree) if writing else "",
                                             encoding="utf-8", newline="\n")
    write_json(artifact / "changed-paths.json", changed)
    if not failures and extension is not None:
        status, lifecycle = "extension_requested", "EXTENSION_REQUESTED"
    elif failures:
        status = "checkpoint_failed" if checkpoint_failed else "failed"
        lifecycle = "CHECKPOINT_FORMAT_FAILED" if checkpoint_failed else "BLOCKED"
    else:
        status, lifecycle = "complete", "REVIEW_PENDING" if task.review_required else "IMPLEMENTED"
    segment_record = {
        "label": seg["label"], "session_id": seg["thread_id"], "process": _process_record(process),
        "time_cap_reached": seg["time_cap"], "checkpoint": seg["checkpoint"],
        "context_evidence": seg["context_evidence"], "commands_run": len(seg["parsed"]["commands"]),
        "worktree_fingerprint": _worktree_fingerprint(worktree, task.base_commit), "token_usage": seg["parsed"]["usage"],
        "tree": tree,
    }
    record = {
        "provider": "codex", "task_id": task.task_id, "status": status, "lifecycle_status": lifecycle,
        "artifact_directory": str(artifact), "repository": str(task.repo_root), "starting_commit": task.base_commit,
        "worktree": str(worktree), "session_id": seg["thread_id"],
        "requested_model": run_settings.get("model"), "requested_reasoning_effort": run_settings.get("effort"),
        "process": _process_record(process), "codex_claim": claim, "error_kind": seg["error_kind"],
        "changed_paths": changed, "unauthorized_changed_paths": unauthorized, "diff_path": str(diff_path),
        "validation": validation, "primary_checkout_unchanged": primary_unchanged,
        "observed_metrics": {"tokens": seg["parsed"]["usage"], "provenance": "codex exec turn.completed events"},
        "warnings": warnings, "failures": failures, "extension_request": extension,
        "segments": (list(prior.get("segments", [])) if prior else []) + [segment_record],
        "run_settings": run_settings,
        "diffstat": tree_diffstat(worktree, previous, tree),
        "diffstat_base": "previous_segment" if prior and prior.get("segments") else "base_commit",
    }
    if prior:
        for key in ("preflight", "handoff", "revisions", "usage_before", "copy_ignored", "auto_continuations"):
            if key in prior:
                record[key] = prior[key]
    write_json(artifact / "result.json", record)
    return record


def _usage_after(command: CodexCommand, before: dict[str, Any]) -> dict[str, Any]:
    windows = [before.get("five_hour") or {}, before.get("weekly") or {}, *before.get("other_windows", [])]
    near_exhaustion = any(w.get("applicable") and isinstance(w.get("remaining_percent"), (int, float))
                          and w["remaining_percent"] <= 10 for w in windows)
    try:
        if not near_exhaustion:
            cached = read_usage_cache(usage_cache(), max_age=None)
            if cached is not None:
                return cached
        return fetch_usage(command, usage_cache(), use_cache=False)
    except (CodexCliError, OSError, ValueError) as exc:
        return {"gate": "unknown", "gate_reason": f"usage unavailable after run: {exc}"}


# ------------------------------------------------------------------ commands

def check_task(task_file: Path) -> dict[str, Any]:
    task = load_task(task_file)
    _verify_repository(task)
    return {"status": "ready", "task_id": task.task_id, "mode": task.mode}


def _settings(model: str | None, effort: str | None, task: Task) -> tuple[Task, dict[str, Any]]:
    selected = model or task.model
    if selected is not None and (not selected.strip() or any(c.isspace() for c in selected)):
        raise BridgeError("model must be one identifier without spaces")
    if effort is not None and effort not in EFFORTS:
        raise BridgeError(f"effort must be one of {sorted(EFFORTS)}")
    windows = windows_sandbox_mode() if os.name == "nt" else None
    return replace(task, model=selected), {"model": selected, "effort": effort, "windows_sandbox": windows}


MAX_COPY_IGNORED_BYTES = 200 * 1024 * 1024


def _ignored_inventory(task: Task) -> list[dict[str, Any]]:
    """Validate the complete inventory before copying any bytes or launching a worker."""
    files: dict[str, int] = {}
    directories: set[str] = set()
    total = 0

    def inspect(path: Path) -> None:
        nonlocal total
        relative = path.relative_to(task.repo_root).as_posix()
        ensure_no_links(task.repo_root, relative)
        metadata = path.lstat()
        if getattr(metadata, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise BridgeError(f"copy_ignored refuses links or junctions: {relative}")
        tracked = _git(task.repo_root, ["ls-files", "-z", "--", f":(literal){relative}"]).stdout
        if tracked:
            raise BridgeError(f"copy_ignored refuses tracked paths: {relative}")
        ignored = _git(task.repo_root, ["check-ignore", "-q", "--", relative], check=False)
        if ignored.returncode != 0:
            raise BridgeError(f"copy_ignored path is not git-ignored: {relative}")
        if path.is_dir():
            directories.add(relative)
            for child in path.iterdir():
                inspect(child)
            return
        if not path.is_file():
            raise BridgeError(f"copy_ignored requires regular files: {relative}")
        if relative not in files:
            files[relative] = metadata.st_size
            total += metadata.st_size
            if total > MAX_COPY_IGNORED_BYTES:
                raise BridgeError("copy_ignored exceeds 200 MB total")

    for pattern in task.copy_ignored:
        matches = list(task.repo_root.glob(pattern))
        if not matches:
            raise BridgeError(f"copy_ignored path or glob matched nothing: {pattern}")
        for path in matches:
            inspect(path)
    return ([{"path": path, "directory": True, "size_bytes": 0} for path in sorted(directories)]
            + [{"path": path, "size_bytes": size} for path, size in sorted(files.items())])


def _copy_ignored(task: Task, worktree: Path, inventory: list[dict[str, Any]]) -> None:
    for entry in inventory:
        relative = entry["path"]
        source = ensure_no_links(task.repo_root, relative)
        target = ensure_no_links(worktree, relative)
        if _git(worktree, ["ls-files", "-z", "--", f":(literal){relative}"]).stdout:
            raise BridgeError(f"copy_ignored would overwrite a worktree path: {relative}")
        if entry.get("directory"):
            target.mkdir(parents=True, exist_ok=True)
            continue
        if target.exists():
            raise BridgeError(f"copy_ignored would overwrite a worktree path: {relative}")
        target.parent.mkdir(parents=True, exist_ok=True)
        # Bound reads too, in case a file grew after inventory validation.
        with source.open("rb") as handle:
            data = handle.read(entry["size_bytes"] + 1)
        if len(data) != entry["size_bytes"]:
            raise BridgeError(f"copy_ignored file changed size before copying: {relative}")
        target.write_bytes(data)


def _auto_continue(task: Task, artifact: Path, worktree: Path, record: dict,
                   before: str, primary_before: str, settings: dict) -> dict:
    limit = min(task.auto_continue, task.max_extensions if task.max_extensions is not None else 3)
    while (task.mode in WRITING_MODES and record.get("lifecycle_status") == "EXTENSION_REQUESTED"
           and len(record.get("auto_continuations", [])) < limit
           and record["segments"][-1]["worktree_fingerprint"] != before):
        request = record["extension_request"]
        granted = request["requested_turns"]
        # Every automatic segment still needs a fresh subscription/capacity gate.
        try:
            pre = preflight()
            usage_before = _gate_preflight(pre)
        except CapacityPaused as exc:
            record["warnings"].append(f"automatic continuation paused: {exc}")
            break
        command = _command_from(pre)
        label = f"segment-{len(record['segments']) + 1}"
        before = record["segments"][-1]["worktree_fingerprint"]
        record.setdefault("auto_continuations", []).append({
            "label": label, "granted_turns": granted, "request": request,
            "prior_worktree_fingerprint": before, "granted_at": utc_now(),
        })
        write_json(artifact / "result.json", record)
        seg = _segment(command, task, worktree, artifact, label,
                       _assignment(task, continuation=request, granted=granted),
                       effort=settings.get("effort"), resume=record["session_id"])
        if seg["thread_id"] not in (None, record["session_id"]):
            seg["error"] = "Codex resumed a different session"
        seg["thread_id"] = record["session_id"]
        record = _finish(task, artifact, worktree, seg, primary_before, settings, record)
        record["auto_continuations"][-1].update(
            worktree_fingerprint=record["segments"][-1]["worktree_fingerprint"],
            outcome_lifecycle_status=record["lifecycle_status"])
        record["usage_after"] = _usage_after(command, usage_before)
    write_json(artifact / "result.json", record)
    return record


def run(task_file: Path, *, model: str | None = None, effort: str | None = None,
        handoff: Path | None = None) -> dict[str, Any]:
    task = load_task(task_file)
    _verify_repository(task)
    if task.copy_ignored and task.mode not in WRITING_MODES:
        raise BridgeError("copy_ignored requires an implement or test task")
    inventory = _ignored_inventory(task)
    manifest = None
    if handoff is not None:
        if task.mode not in WRITING_MODES:
            raise BridgeError("handoff seeding requires an implement or test task")
        manifest = shared_handoff.verify_handoff(handoff, task)
    task, settings = _settings(model, effort, task)
    root = _shadow(create=True)
    pre = preflight()
    command = _command_from(pre)
    usage_before = _gate_preflight(pre)
    with task_lock(root, task, task_file, "run"):
        artifact = root / f"{task.task_id}-{utc_stamp()}"
        artifact.mkdir()
        write_json(artifact / "task.json", task.raw)
        primary_before = primary_status(task)
        (artifact / "primary-status.before.txt").write_text(primary_before, encoding="utf-8")
        worktree = task.repo_root
        inherited = None
        if task.mode in WRITING_MODES:
            worktree = short_worktree_path(artifact)
            worktree.parent.mkdir(parents=True, exist_ok=True)
            _git_retry(task.repo_root, ["worktree", "add", "-b", f"delegate/codex-{task.task_id}-{utc_stamp().lower()}",
                                       str(worktree), task.base_commit])
            if manifest is not None:
                seeded = shared_handoff.seed_handoff(handoff, manifest, worktree, task)
                write_json(artifact / "handoff-manifest.json", manifest)
                inherited = {**seeded, "package_directory": str(Path(handoff).resolve()),
                             "inherited_fingerprint": _worktree_fingerprint(worktree, task.base_commit)}
            _copy_ignored(task, worktree, inventory)
        write_json(artifact / "worktree.json", {"worktree": str(worktree), "copy_ignored": inventory})
        before = _worktree_fingerprint(worktree, task.base_commit)
        seg = _segment(command, task, worktree, artifact, "initial", _assignment(task, handoff=inherited),
                       effort=settings["effort"])
        prior = {"preflight": pre, "usage_before": usage_before, "copy_ignored": inventory}
        if inherited is not None:
            prior["handoff"] = inherited
        record = _finish(task, artifact, worktree, seg, primary_before, settings, prior | {"segments": []})
        record = _auto_continue(task, artifact, worktree, record, before, primary_before, settings)
    record["usage_after"] = _usage_after(command, usage_before)
    write_json(artifact / "result.json", record)
    return record


def _load_prior(task_file: Path, artifact_path: Path) -> tuple[Task, Path, bytes, dict[str, Any]]:
    root = _shadow(create=True)
    artifact = resolve_artifact(artifact_path, task_file).resolve(strict=True)
    if root.resolve() not in artifact.parents:
        raise BridgeError("artifact is outside the Codex artifact root")
    prior_bytes = (artifact / "result.json").read_bytes()
    prior = json.loads(prior_bytes.decode("utf-8"))
    original = load_task(artifact / "task.json")
    task = load_task(task_file, defaults=original.raw)
    _verify_repository(task)
    if prior.get("task_id") != task.task_id or original.raw != task.raw or prior.get("starting_commit") != task.base_commit:
        raise BridgeError("artifact and task contract do not match")
    session = prior.get("session_id")
    segments = prior.get("segments") or []
    if not isinstance(session, str) or not session or not segments:
        raise BridgeError("artifact has no resumable Codex session")
    if any(not isinstance(s, dict) or s.get("session_id") not in (session,) for s in segments):
        raise BridgeError("artifact session lineage is inconsistent")
    return task, artifact, prior_bytes, prior


def _verified_worktree(task: Task, artifact: Path, prior: dict[str, Any]) -> Path:
    worktree = recorded_worktree(artifact, prior)
    if task.mode in WRITING_MODES:
        if not artifact_owns_worktree(artifact, worktree):
            raise BridgeError("worktree is outside its artifact")
        if _git(worktree, ["rev-parse", "HEAD"]).stdout.strip().lower() != task.base_commit:
            raise BridgeError("worktree HEAD moved away from the original base commit")
    elif worktree != task.repo_root:
        raise BridgeError("read-only worktree does not match the repository")
    if _worktree_fingerprint(worktree, task.base_commit) != prior["segments"][-1]["worktree_fingerprint"]:
        raise BridgeError("worktree changed after the recorded result; refusing to continue")
    return worktree


def continue_task(task_file: Path, artifact_path: Path, granted: int) -> dict[str, Any]:
    task, artifact, _, prior = _load_prior(task_file, artifact_path)
    if prior.get("lifecycle_status") != "EXTENSION_REQUESTED":
        raise BridgeError("artifact is not awaiting an extension decision")
    request = prior.get("extension_request") or {}
    if not isinstance(granted, int) or not 1 <= granted <= int(request.get("requested_turns") or 0):
        raise BridgeError("grant must be at least 1 and no more than the worker's valid request")
    with task_lock(artifact_root(), task, task_file, "continue"):
        worktree = _verified_worktree(task, artifact, prior)
        settings = prior.get("run_settings") or {}
        task = replace(task, model=settings.get("model"))
        pre = preflight()
        command = _command_from(pre)
        usage_before = _gate_preflight(pre)
        label = f"segment-{len(prior['segments']) + 1}"
        seg = _segment(command, task, worktree, artifact, label,
                       _assignment(task, continuation=request, granted=granted),
                       effort=settings.get("effort"), resume=prior["session_id"])
        if seg["thread_id"] not in (None, prior["session_id"]):
            seg["error"] = "Codex resumed a different session"
        seg["thread_id"] = prior["session_id"]
        primary_before = (artifact / "primary-status.before.txt").read_text(encoding="utf-8")
        record = _finish(task, artifact, worktree, seg, primary_before, settings, prior)
        before = prior["segments"][-1]["worktree_fingerprint"]
        progressed = (record["segments"][-1]["worktree_fingerprint"] != before if task.mode in WRITING_MODES
                      else record.get("extension_request") != request)
        if record["lifecycle_status"] == "EXTENSION_REQUESTED" and not progressed:
            record["status"], record["lifecycle_status"] = "failed", "BLOCKED"
            record["failures"].append("continuation requested more time without measurable progress")
        record = _auto_continue(task, artifact, worktree, record, before, primary_before, settings)
    record["usage_after"] = _usage_after(command, usage_before)
    write_json(artifact / "result.json", record)
    return record


def revise_task(task_file: Path, artifact_path: Path, feedback_file: Path | dict[str, Any],
                granted: int = 4) -> dict[str, Any]:
    task, artifact, prior_bytes, prior = _load_prior(task_file, artifact_path)
    if task.mode not in WRITING_MODES:
        raise BridgeError("revision requires an implement or test task")
    if not isinstance(granted, int) or not 1 <= granted <= MAX_CODEX_REVISION_TURNS:
        raise BridgeError(f"revision grants must be 1 through {MAX_CODEX_REVISION_TURNS}")
    # The stored flag describes the whole checkout. Revision eligibility instead needs
    # the scoped evidence, including when validation was the only blocking failure.
    revision_evidence = prior
    if prior.get("primary_checkout_unchanged") is False:
        before = (artifact / "primary-status.before.txt").read_text(encoding="utf-8")
        after = (artifact / "primary-status.after.txt").read_text(encoding="utf-8")
        scope_unchanged = not any(path_allowed(p, task.allowed_changed_paths)
                                  for p in primary_status_changes(before, after))
        revision_evidence = {**prior, "primary_checkout_unchanged": scope_unchanged}
    target_state = revision_target_state(revision_evidence)
    with task_lock(artifact_root(), task, task_file, "revise"):
        worktree = _verified_worktree(task, artifact, prior)
        feedback = load_feedback(feedback_file, allowed_changed_paths=task.allowed_changed_paths, worktree=worktree)
        revisions = list(prior.get("revisions") or [])
        if any(r.get("feedback_sha256") == feedback["sha256"] for r in revisions if isinstance(r, dict)):
            raise BridgeError("identical review feedback was already applied to this artifact")
        number = len(revisions) + 1
        label = f"revision-{number}"
        with (artifact / f"{label}.prior-result.json").open("xb") as handle:
            handle.write(prior_bytes)
        write_json(artifact / f"{label}.feedback.json", {"findings": feedback["findings"]})
        settings = prior.get("run_settings") or {}
        task = replace(task, model=settings.get("model"))
        pre = preflight()
        command = _command_from(pre)
        usage_before = _gate_preflight(pre)
        seg = _segment(command, task, worktree, artifact, label,
                       _assignment(task, revision=feedback["findings"], granted=granted),
                       effort=settings.get("effort"), resume=prior["session_id"])
        if seg["thread_id"] not in (None, prior["session_id"]):
            seg["error"] = "Codex resumed a different session"
        seg["thread_id"] = prior["session_id"]
        primary_before = (artifact / "primary-status.before.txt").read_text(encoding="utf-8")
        record = _finish(task, artifact, worktree, seg, primary_before, settings, prior)
        before = prior["segments"][-1]["worktree_fingerprint"]
        after = record["segments"][-1]["worktree_fingerprint"]
        if after == before:
            record["failures"].append("revision made no measurable change to the worktree")
            if record["status"] not in {"failed", "checkpoint_failed"}:
                record["status"], record["lifecycle_status"] = "failed", "BLOCKED"
        record["revisions"] = revisions + [{
            "index": number, "label": label, "granted_turns": granted,
            "feedback_file": f"{label}.feedback.json", "feedback_sha256": feedback["sha256"],
            "finding_count": len(feedback["findings"]), "prior_result_file": f"{label}.prior-result.json",
            "prior_result_sha256": hashlib.sha256(prior_bytes).hexdigest(), "target_state": target_state,
            "prior_worktree_fingerprint": before, "worktree_fingerprint": after,
            "outcome_lifecycle_status": record["lifecycle_status"], "captured_at": utc_now(),
        }]
        record = _auto_continue(task, artifact, worktree, record, before, primary_before, settings)
    record["usage_after"] = _usage_after(command, usage_before)
    write_json(artifact / "result.json", record)
    return record


def revalidate(task_file: Path, artifact_path: Path, timeout: int | None = None) -> dict[str, Any]:
    task, artifact, _, prior = _load_prior(task_file, artifact_path)
    if timeout is not None:
        if isinstance(timeout, bool) or not isinstance(timeout, int) or not 1 <= timeout <= 1800:
            raise BridgeError("validation timeout must be an integer from 1 through 1800")
        task = replace(task, validation_timeout_seconds=timeout)
    with task_lock(artifact_root(), task, task_file, "revalidate"):
        worktree = _verified_worktree(task, artifact, prior)
        validation, error = _validation(task, worktree, artifact)
        failures = [f for f in prior.get("failures", [])
                    if f not in {"independent validation failed", "validation executable not found"}]
        if error:
            failures.append(error)
        changed = changed_paths(worktree, task.base_commit) if task.mode in WRITING_MODES else []
        unauthorized = [p for p in changed if not path_allowed(p, task.allowed_changed_paths)]
        if unauthorized and "out-of-scope paths changed" not in failures:
            failures.append("out-of-scope paths changed")
        before = (artifact / "primary-status.before.txt").read_text(encoding="utf-8")
        inside = [p for p in primary_status_changes(before, primary_status(task))
                  if path_allowed(p, task.allowed_changed_paths)]
        if inside:
            failure = "primary checkout changed inside the task's allowed paths: " + ", ".join(inside)
            if failure not in failures:
                failures.append(failure)
        claim = prior.get("codex_claim")
        if claim and claim.get("status") == "blocked":
            if changed and environment_only_blockers(claim):
                failures = [f for f in failures if f != "Codex reported blocked"]
                warning = "environment-only worker blockers with preserved changes: independent validation governs review"
                if warning not in prior.get("warnings", []):
                    prior.setdefault("warnings", []).append(warning)
            elif "Codex reported blocked" not in failures:
                failures.append("Codex reported blocked")
        prior.update(validation=validation, failures=failures, changed_paths=changed,
                     unauthorized_changed_paths=unauthorized)
        if failures:
            prior.update(status="failed", lifecycle_status="BLOCKED")
        elif validation.get("status") == "passed" and prior.get("lifecycle_status") in {"BLOCKED", "REVIEW_PENDING", "IMPLEMENTED"}:
            prior.update(status="complete", lifecycle_status="REVIEW_PENDING" if task.review_required else "IMPLEMENTED")
        prior["segments"][-1]["worktree_fingerprint"] = _worktree_fingerprint(worktree, task.base_commit)
        if task.mode in WRITING_MODES:
            tree = snapshot_tree(worktree, artifact)
            prior["segments"][-1]["tree"] = tree
            previous = prior["segments"][-2].get("tree", task.base_commit) if len(prior["segments"]) > 1 else task.base_commit
            (artifact / "diff.patch").write_text(tree_diff(worktree, task.base_commit, tree), encoding="utf-8", newline="\n")
            (artifact / "interdiff.patch").write_text(tree_diff(worktree, previous, tree), encoding="utf-8", newline="\n")
            prior["diffstat"] = tree_diffstat(worktree, previous, tree)
        write_json(artifact / "result.json", prior)
    return {"status": "passed" if error is None else "failed", "validation": validation,
            "lifecycle_status": prior["lifecycle_status"], "artifact": str(artifact)}


def export_handoff(task_file: Path, artifact_path: Path, output: Path) -> dict[str, Any]:
    _shadow()
    return shared_handoff.export_handoff(artifact_root(), task_file, resolve_artifact(artifact_path, task_file), output)


def resolve_artifact(artifact_path: Path, task_file: Path | None = None) -> Path:
    if str(artifact_path) != "latest":
        return artifact_path
    if task_file is None:
        raise BridgeError("--artifact latest requires --task")
    raw = json.loads(Path(task_file).read_text(encoding="utf-8-sig"))
    task_id = raw.get("task_id", Path(task_file).stem)
    from .contracts import TASK_ID_RE
    if not isinstance(task_id, str) or not TASK_ID_RE.fullmatch(task_id):
        raise BridgeError("task_id is invalid")
    repository = Path(raw["repo_root"]).resolve() if "repo_root" in raw else None
    candidates = []
    for path in artifact_root().glob(f"{task_id}-*"):
        if (path / "result.json").is_file():
            result = json.loads((path / "result.json").read_text(encoding="utf-8"))
            if result.get("task_id") == task_id and (repository is None or Path(result.get("repository", "")).resolve() == repository):
                candidates.append(path)
    if not candidates:
        raise BridgeError("no artifact exists for this task")
    return max(candidates, key=lambda p: p.name)


def show_diff(artifact_path: Path, files: list[str] | None = None, since_last: bool = False) -> str:
    artifact = artifact_path.resolve(strict=True)
    if artifact_root().resolve() not in artifact.parents:
        raise BridgeError("artifact is outside the Codex artifact root")
    record = json.loads((artifact / "result.json").read_text(encoding="utf-8"))
    if not files:
        return (artifact / ("interdiff.patch" if since_last else "diff.patch")).read_text(encoding="utf-8")
    files = [safe_relative_path(p, "diff file") for p in files]
    segments = record.get("segments") or []
    before = segments[-2]["tree"] if since_last and len(segments) > 1 else record["starting_commit"]
    return tree_diff(Path(record["repository"]), before, segments[-1]["tree"], files)


def _cleanup_target(task: Task, artifact: Path, record: dict[str, Any]) -> tuple[Path, str]:
    if task.mode not in WRITING_MODES:
        raise BridgeError("cleanup requires an implement or test task")
    worktree = recorded_worktree(artifact, record)
    if not artifact_owns_worktree(artifact, worktree) or worktree == task.repo_root:
        raise BridgeError("refusing to remove a worktree outside its artifact")
    expected_common = _git(task.repo_root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).stdout.strip()
    actual_common = _git(worktree, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).stdout.strip()
    if Path(expected_common).resolve() != Path(actual_common).resolve():
        raise BridgeError("worktree belongs to another repository")
    branch = _git(worktree, ["branch", "--show-current"]).stdout.strip()
    if not branch.startswith(f"delegate/codex-{task.task_id}-"):
        raise BridgeError("refusing to delete a branch outside this task's delegate/codex namespace")
    return worktree, branch


def _cleanup_worktree(task: Task, artifact: Path, record: dict[str, Any]) -> None:
    if record.get("cleaned_at"):
        return
    worktree, branch = _cleanup_target(task, artifact, record)
    _git_retry(task.repo_root, ["worktree", "remove", "--force", str(worktree)])
    _git_retry(task.repo_root, ["branch", "-D", branch])
    record["cleaned_at"] = utc_now()


def cleanup(task_file: Path, artifact_path: Path) -> dict[str, Any]:
    task, artifact, _, record = _load_prior(task_file, artifact_path)
    with task_lock(artifact_root(), task, task_file, "cleanup"):
        _cleanup_worktree(task, artifact, record)
        if record.get("status") != "accepted":
            record.update(status="rejected", lifecycle_status="REJECTED")
        write_json(artifact / "result.json", record)
    return {"status": record["status"], "artifact": str(artifact), "cleaned_at": record["cleaned_at"]}


def accept(task_file: Path, artifact_path: Path, three_way: bool = False,
           already_applied: bool = False) -> dict[str, Any]:
    if three_way and already_applied:
        raise BridgeError("--already-applied and --3way are mutually exclusive")
    task, artifact, _, record = _load_prior(task_file, artifact_path)
    if (task.mode not in WRITING_MODES or record.get("lifecycle_status") not in {"REVIEW_PENDING", "IMPLEMENTED"}
            or record.get("validation", {}).get("status") != "passed" or record.get("failures")
            or record.get("unauthorized_changed_paths")):
        raise BridgeError("accept requires review readiness, passing validation and allowed paths")
    with task_lock(artifact_root(), task, task_file, "accept"):
        worktree = _verified_worktree(task, artifact, record)
        _cleanup_target(task, artifact, record)
        paths = changed_paths(worktree, task.base_commit)
        if paths != record.get("changed_paths") or any(not path_allowed(p, task.allowed_changed_paths) for p in paths):
            raise BridgeError("changed paths differ from the allowed reviewed result")
        for path in paths:
            ensure_no_links(task.repo_root, path)
        patch = artifact / "diff.patch"
        if patch.read_text(encoding="utf-8") != tree_diff(worktree, task.base_commit, record["segments"][-1]["tree"]):
            raise BridgeError("artifact patch differs from the reviewed tree")
        args = ["apply", *(["--3way"] if three_way else []), *(["--reverse"] if already_applied else [])]
        if patch.stat().st_size:
            checked = _git(task.repo_root, [*args, "--check", str(patch)], check=False)
            if checked.returncode:
                conflicts = [p for p in paths if p in checked.stderr]
                return {"status": "failed", "error": checked.stderr.strip(), "conflicting_files": conflicts or paths}
            if not already_applied:
                _git(task.repo_root, [*args, str(patch)])
        record.update(status="accepted", lifecycle_status="ACCEPTED", applied_at=utc_now())
        if already_applied:
            record["applied_manually"] = True
        write_json(artifact / "result.json", record)
        _cleanup_worktree(task, artifact, record)
        write_json(artifact / "result.json", record)
    return {"status": "accepted", "artifact": str(artifact), "applied_at": record["applied_at"],
            "cleaned_at": record["cleaned_at"]}


def active(task_id: str) -> dict[str, Any]:
    return active_task_record(_shadow(), task_id)


def clear_stale_lock(task_id: str) -> dict[str, Any]:
    return clear_stale_task_lock(_shadow(), task_id)


# ------------------------------------------------------------------ compact report for the lead

BRIEF_TAIL_LINES = 20
BRIEF_TAIL_CHARS = 2000


def _tail(path: Path, lines: int) -> list[str]:
    try:
        return [line[:300] for line in path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:]]
    except OSError:
        return []


def _usage_brief(record: Any) -> dict[str, Any] | None:
    if not isinstance(record, dict):
        return None
    out: dict[str, Any] = {"gate": record.get("gate")}
    for name in ("five_hour", "weekly"):
        window = record.get(name)
        if isinstance(window, dict):
            out[name] = window.get("remaining_percent") if window.get("applicable") else "not on this plan"
    return out


def brief(record: dict[str, Any]) -> dict[str, Any]:
    """The lead-relevant part of a result: enough to review and decide without opening other files.

    The complete record stays in the artifact's result.json (and `--full` prints it).
    """
    if "lifecycle_status" not in record:
        return record
    artifact = Path(record.get("artifact_directory", "."))
    claim = record.get("codex_claim") or record.get("grok_claim")
    validation = record.get("validation") or {}
    out: dict[str, Any] = {
        "status": record.get("status"), "lifecycle_status": record.get("lifecycle_status"),
        "task_id": record.get("task_id"), "artifact": str(artifact),
        "failures": record.get("failures", []), "warnings": record.get("warnings", []),
        "changed_paths": record.get("changed_paths", []),
    }
    if record.get("unauthorized_changed_paths"):
        out["unauthorized_changed_paths"] = record["unauthorized_changed_paths"]
    if record.get("error_kind"):
        out["error_kind"] = record["error_kind"]
    if isinstance(claim, dict):
        out["worker"] = {"status": claim.get("status"), "summary": claim.get("summary"),
                         "findings": claim.get("findings", []),
                         "blockers": claim.get("blockers", []),
                         "checks": [f"{c.get('reported_outcome')}: {c.get('description')}"
                                    for c in claim.get("checks", []) if isinstance(c, dict)]}
    if record.get("extension_request"):
        out["extension_request"] = record["extension_request"]
    if record.get("auto_continuations"):
        out["auto_continuations"] = record["auto_continuations"]
    out["validation"] = {"status": validation.get("status")}
    if validation.get("status") == "failed":
        tail = (_tail(artifact / "validation.stdout.log", BRIEF_TAIL_LINES)
                + _tail(artifact / "validation.stderr.log", BRIEF_TAIL_LINES))[-BRIEF_TAIL_LINES:]
        remaining = BRIEF_TAIL_CHARS
        capped = []
        for line in reversed(tail):
            if remaining <= 0:
                break
            line = line[:remaining]
            capped.append(line)
            remaining -= len(line) + 1
        out["validation"]["output_tail"] = list(reversed(capped))
    diff_path = Path(record.get("diff_path") or artifact / "diff.patch")
    try:
        diff = diff_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        diff = ""
    out["diffstat"] = record.get("diffstat", {})
    out["diffstat_base"] = record.get("diffstat_base", "base_commit")
    if diff:
        out["patch"] = str(diff_path)
    segments = record.get("segments") or []
    if segments:
        # Codex records token_usage; Grok records usage (work call plus any separate report call).
        out["tokens_last_segment"] = segments[-1].get("token_usage") or segments[-1].get("usage")
    if "usage_before" in record or "usage_after" in record:
        out["usage"] = _usage_brief(record.get("usage_after"))
    if record.get("provider") == "grok-build":
        out["run"] = {"model": record.get("actual_model") or record.get("requested_model"),
                      "effort": record.get("requested_reasoning_effort")}
    else:
        settings = record.get("run_settings") or {}
        out["run"] = {"model": settings.get("model"), "effort": settings.get("effort")}
    return out

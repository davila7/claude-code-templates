from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from dataclasses import replace
from pathlib import Path, PurePosixPath
from typing import Any, Iterator, Sequence


# The complete runtime ships beside this launcher.
BRIDGE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BRIDGE_ROOT / "src"))

from claude_codex_bridge import handoff as shared_handoff  # noqa: E402
from claude_codex_bridge.bridge import brief  # noqa: E402
from claude_codex_bridge.contracts import ContractError, Task, load_task  # noqa: E402
from claude_codex_bridge.gitops import BridgeError  # noqa: E402
from claude_codex_bridge.process import ProcessResult, run_process  # noqa: E402
from claude_codex_bridge.revision import (  # noqa: E402
    MAX_GROK_REVISION_TURNS,
    load_feedback,
    revision_target_state,
)


from claude_codex_bridge.state import state_root, ensure_state_root

SHADOW_ROOT = state_root()
ARTIFACT_ROOT = SHADOW_ROOT / "artifacts" / "grok"
REPLY_SCHEMA = BRIDGE_ROOT / "schemas" / "reply.schema.json"
CHECKPOINT_SCHEMA = BRIDGE_ROOT / "schemas" / "checkpoint.schema.json"
SESSION_RE = re.compile(r"^[0-9a-fA-F-]{36}$")
DEFAULT_MODEL = "grok-4.7"
DEFAULT_EFFORT = os.environ.get("GROK_BRIDGE_REASONING_EFFORT", "low")
if DEFAULT_EFFORT not in {"low", "medium", "high"}:
    raise ValueError("GROK_BRIDGE_REASONING_EFFORT must be low, medium, or high")


class GrokBridgeError(RuntimeError):
    pass


def check_command(task: Task) -> str | None:
    """The one shell command a writing Grok worker may run to test its work, or None.

    Grok's own sandbox is not enforced on Windows, so the worker gets no general shell: Grok runs in dontAsk
    mode with a single allow rule for validation_command, which the bridge runs itself after the worker
    anyway. Set GROK_BRIDGE_WORKER_CHECKS=skip to withhold it.
    """
    mode = os.environ.get("GROK_BRIDGE_WORKER_CHECKS", "run").strip().lower()
    if mode not in {"run", "skip"}:
        raise GrokBridgeError("GROK_BRIDGE_WORKER_CHECKS must be run or skip")
    if mode == "skip" or task.mode not in ("implement", "test") or not task.validation_command:
        return None
    parts = list(task.validation_command)
    if any(not part or any(ch.isspace() or ch in "\"'`;&|<>$(){}" for ch in part) for part in parts):
        return None  # only plain arguments, so the allow rule matches exactly what the worker types
    return " ".join(parts)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _shadow_root(create: bool = False) -> Path:
    ensure_state_root()
    if create:
        ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    return ARTIFACT_ROOT


def _git(cwd: Path, args: Sequence[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    executable = shutil.which("git")
    if not executable:
        raise GrokBridgeError("Git is unavailable")
    result = subprocess.run(
        [executable, *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8",
        errors="replace", shell=False, timeout=60, check=False,
    )
    if check and result.returncode != 0:
        raise GrokBridgeError(f"Git {' '.join(args)} failed: {result.stderr.strip()}")
    return result


def _verify_repo(task: Task) -> None:
    root = Path(_git(task.repo_root, ["rev-parse", "--show-toplevel"]).stdout.strip()).resolve()
    if root != task.repo_root:
        raise GrokBridgeError("repo_root must be the Git top-level directory")
    resolved = _git(task.repo_root, ["rev-parse", "--verify", f"{task.base_commit}^{{commit}}"])
    if resolved.stdout.strip().lower() != task.base_commit:
        raise GrokBridgeError("base_commit is not the exact requested commit")


def _changed_paths(worktree: Path, base_commit: str) -> list[str]:
    tracked = _git(worktree, ["diff", "--name-only", base_commit, "--"]).stdout.splitlines()
    untracked = _git(worktree, ["ls-files", "--others", "--exclude-standard"]).stdout.splitlines()
    return sorted({path.replace("\\", "/") for path in (*tracked, *untracked) if path})


def _diff(worktree: Path, base_commit: str) -> str:
    pieces = [_git(worktree, ["diff", "--binary", base_commit, "--"]).stdout]
    untracked = _git(worktree, ["ls-files", "--others", "--exclude-standard"]).stdout.splitlines()
    for path in untracked:
        part = _git(worktree, ["diff", "--no-index", "--binary", "--", "/dev/null", path], check=False)
        if part.returncode not in (0, 1):
            raise GrokBridgeError(f"could not render untracked file in diff: {path}")
        pieces.append(part.stdout)
    return "".join(pieces)


def _fingerprint(worktree: Path, base_commit: str) -> str:
    digest = hashlib.sha256()
    for path in _changed_paths(worktree, base_commit):
        digest.update(path.encode("utf-8") + b"\0")
        object_hash = _git(worktree, ["hash-object", "--", path], check=False)
        digest.update((object_hash.stdout.strip() if object_hash.returncode == 0 else "<deleted>").encode())
    return digest.hexdigest()


def _allowed_path(path: str, permitted: tuple[str, ...]) -> bool:
    candidate = PurePosixPath(path.replace("\\", "/"))
    for item in permitted:
        boundary = PurePosixPath(item[:-3].rstrip("/") if item.endswith("/**") else item)
        if candidate == boundary or (item.endswith("/**") and boundary in candidate.parents):
            return True
    return False


def _normalized_claim_paths(worktree: Path, paths: Sequence[str]) -> tuple[set[str], list[str]]:
    root = worktree.resolve(strict=True)
    normalized: set[str] = set()
    outside: list[str] = []
    for raw in paths:
        path = Path(raw)
        resolved = (path if path.is_absolute() else root / path).resolve()
        try:
            relative = resolved.relative_to(root)
        except ValueError:
            outside.append(raw)
        else:
            normalized.add(relative.as_posix())
    return normalized, outside


def _native_executable() -> Path:
    grok_home = Path(os.environ.get("GROK_HOME") or (Path.home() / ".grok"))
    executable = (grok_home / "bin" / ("grok.exe" if os.name == "nt" else "grok")).resolve()
    if not executable.is_file():
        found = shutil.which("grok.exe" if os.name == "nt" else "grok")
        if not found:
            raise GrokBridgeError("Native Grok Build CLI is missing; install it from https://docs.x.ai/build/overview")
        executable = Path(found).resolve(strict=True)
    return executable


def _check_routing_file(path: Path, model: str) -> None:
    if not path.is_file():
        return
    try:
        import tomllib
        config = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise GrokBridgeError("Grok config is unreadable; cannot confirm billing route") from exc
    auth, models = config.get("auth", {}), config.get("model", {})
    if not isinstance(auth, dict) or not isinstance(models, dict):
        raise GrokBridgeError("Grok auth/model configuration must be TOML tables")
    if auth.get("auth_provider_command"):
        raise GrokBridgeError("Grok has an external auth provider configured")
    selected = models.get(model, {})
    if not isinstance(selected, dict):
        raise GrokBridgeError("Selected Grok model configuration must be a TOML table")
    route_keys = ("api_key", "env_key", "base_url", "provider", "api_provider", "auth_provider_command")
    overrides = [key for key in route_keys if selected.get(key)]
    if overrides:
        raise GrokBridgeError("Selected Grok model has unverified billing/provider overrides: " + ", ".join(overrides))


def _runtime_task(task: Task, *, model: str | None = None, prior: dict | None = None) -> Task:
    # Provider settings never change the original task or its handoff fingerprint.
    if prior is not None:
        selected = prior.get("requested_model")
        if not isinstance(selected, str) or not selected.strip():
            raise GrokBridgeError("Preserved Grok result has no verified requested model")
    else:
        selected = model or (task.model if task.model and task.model.startswith("grok-") else DEFAULT_MODEL)
    if not isinstance(selected, str) or not selected.strip() or any(c.isspace() for c in selected):
        raise GrokBridgeError("Select one valid Grok model identifier")
    return replace(task, model=selected)


def _preflight(model: str | None = None) -> dict[str, Any]:
    _shadow_root()
    selected_model = model or DEFAULT_MODEL
    if os.environ.get("XAI_API_KEY"):
        raise GrokBridgeError("XAI_API_KEY is set; subscription-only routing cannot be confirmed")
    config_path = Path(os.environ.get("GROK_HOME") or (Path.home() / ".grok")) / "config.toml"
    _check_routing_file(config_path, selected_model)
    executable = _native_executable()
    version = run_process(executable, ["version"], cwd=Path.home(), timeout_seconds=15)
    if version.exit_code != 0 or version.timed_out:
        raise GrokBridgeError("Grok version check failed")
    models = run_process(executable, ["--no-auto-update", "models"], cwd=Path.home(), timeout_seconds=20)
    if models.exit_code != 0 or models.timed_out or "logged in with grok.com" not in models.stdout.lower():
        raise GrokBridgeError("Grok Build is not confirmed signed in with grok.com")
    if not re.search(rf"(?m)^\s*[-*]\s+{re.escape(selected_model)}\b", models.stdout):
        raise GrokBridgeError(f"requested Grok model is not listed: {selected_model}")
    default_match = re.search(r"(?m)^Default model:\s*(\S+)", models.stdout)
    return {
        "executable": str(executable),
        "version": version.stdout.strip() or version.stderr.strip(),
        "auth_method": "grok.com",
        "default_model": default_match.group(1) if default_match else None,
        "requested_model": selected_model,
        "reasoning_effort": DEFAULT_EFFORT,
        "api_key_used": False,
    }


def _assignment(
    task: Task, *, continuation: dict[str, Any] | None = None, granted_turns: int | None = None,
    revision: list[dict[str, str]] | None = None, handoff: dict[str, Any] | None = None,
) -> str:
    contract = {
        "task_id": task.task_id, "mode": task.mode, "objective": task.objective,
        "context_paths": task.context_paths, "forbidden_context": task.forbidden_context,
        "allowed_changed_paths": task.allowed_changed_paths,
        "acceptance_criteria": task.acceptance_criteria,
        "locked_decisions": task.locked_decisions, "stop_conditions": task.stop_conditions,
        "risk": task.risk, "review_required": task.review_required,
    }
    opening = (
        "You are a single bounded Grok Build worker. Work only on this contract and only in the current repository. "
        "Do not spawn agents, use network tools, install packages, call shell commands (except the check command "
        "below, when one is given), commit, push, or change credentials. "
        "Use the Read tool to open every named context file before drawing conclusions; list a named directory with Glob or ListDir. "
        "Never claim a file was read unless you actually opened it with a tool. If the tool cannot open it, return blocked. "
        "Read only the named context paths and repository instruction files relevant to them. "
        "For analysis or review, do not edit anything. For implementation, use a file-editing tool and edit only allowed_changed_paths; "
        "do not report complete without making the requested change or explaining with evidence why no change was necessary. "
        "The coordinator runs validation after you finish; report unrun checks honestly. "
        "After the tool work, summarize only what actually happened. If material work remains near the segment limit, "
        "state concrete completed work, remaining work, the reason, and how many additional turns you need. "
        "The coordinator asks for a separate structured report after the work turn."
    )
    if continuation is not None:
        opening += (
            f" The lead granted {granted_turns} additional turns in this same session. Continue without repeating completed work. "
            "Preserve the original scope and stop conditions. Prior extension request: "
            + json.dumps(continuation, ensure_ascii=False)
        )
    if revision is not None:
        opening += (
            f" The lead reviewed your completed work in this same session and grants {granted_turns} turns to correct "
            "these concrete findings. Fix only the listed defects inside allowed_changed_paths and do not redo "
            "unrelated work. Review findings: " + json.dumps(revision, ensure_ascii=False)
        )
    if handoff is not None:
        opening += (
            " The worktree already contains verified inherited changes from a previous Codex worker on the same "
            "base commit: " + json.dumps(handoff["inherited_changed_paths"], ensure_ascii=False)
            + ". Treat them as part of the combined change, continue the task from that state, and do not revert "
            "them unless the contract requires it."
        )
    command = check_command(task)
    if command:
        opening += (
            " Check command: before you finish, run exactly `" + command + "` from the repository root with the "
            "terminal tool and fix what it shows; repeat only after a change. No other shell command is permitted. "
            "Report its result in checks."
        )
    return opening + "\n\n" + json.dumps(contract, indent=2, ensure_ascii=False)


def _args(
    task: Task, worktree: Path, assignment: Path, turns: int, schema: Path | None,
    *, resume_session: str | None = None, no_tools: bool = False,
    reasoning_effort: str | None = None,
) -> list[str]:
    _check_routing_file(worktree / ".grok" / "config.toml", task.model or DEFAULT_MODEL)
    allowed = [] if no_tools else (["read_file", "list_dir", "grep"] if task.mode in ("analyze", "review") else ["read_file", "list_dir", "grep", "search_replace"])
    command = None if no_tools else check_command(task)
    if command:
        allowed.append("run_terminal_command")
    args = [
        "--no-auto-update", "--no-subagents", "--no-plan", "--disable-web-search",
        "--agent", "general-purpose",
        "--sandbox", "workspace", "--permission-mode", "dontAsk", "--cwd", str(worktree),
        "--output-format", "json",
        "--max-turns", str(turns), "--tools", ",".join(allowed),
        "--disallowed-tools", ("web_search,web_fetch,spawn_subagent" if command
                               else "run_terminal_command,run_terminal_cmd,web_search,web_fetch,spawn_subagent"),
    ]
    if schema is not None:
        args.extend(["--json-schema", json.dumps(json.loads(schema.read_text(encoding="utf-8")), separators=(",", ":"))])
    if no_tools:
        args[args.index("--disallowed-tools") + 1] += ",read_file,list_dir,grep,search_replace"
    for tool in ("Read", "Glob", "Grep") if not no_tools else ():
        args.extend(["--allow", tool])
    if not no_tools and task.mode not in ("analyze", "review"):
        args.extend(["--allow", "Edit", "--allow", "Write"])
    if command:
        # dontAsk mode refuses every shell command except this exact one (and Grok's built-in read-only commands).
        args.extend(["--allow", f"Bash({command})"])
    else:
        args.extend(["--deny", "Bash"])
    args.extend(["--deny", "WebSearch", "--deny", "WebFetch", "--deny", "MCPTool"])
    if no_tools:
        args.extend(["--deny", "Read", "--deny", "Edit", "--deny", "Write", "--deny", "Glob", "--deny", "Grep"])
    if task.model:
        selected_model = task.model
    else:
        selected_model = DEFAULT_MODEL
    args.extend(["--model", selected_model, "--reasoning-effort", reasoning_effort or DEFAULT_EFFORT])
    if resume_session:
        args.extend(["--resume", resume_session])
    args.extend(["--prompt-file", str(assignment)])
    return args


def _envelope(stdout: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None, str | None]:
    try:
        envelope = json.loads(stdout)
    except json.JSONDecodeError as exc:
        return None, None, f"Grok returned invalid JSON: {exc}"
    if not isinstance(envelope, dict):
        return None, None, "Grok output was not a JSON object"
    claim: Any = envelope.get("structured_output") or envelope.get("structuredOutput")
    if claim is None:
        text = envelope.get("text")
        if isinstance(text, str):
            try:
                claim = json.loads(text)
            except json.JSONDecodeError:
                return envelope, None, "Grok text was not structured JSON"
    if not isinstance(claim, dict):
        return envelope, None, "Grok structured reply was not an object"
    if claim.get("status") not in {"complete", "partial", "blocked", "extension_requested"}:
        return envelope, None, "Grok reply had no valid status"
    expected = {"status", "summary", "findings", "files_read", "files_changed", "checks", "blockers", "extension_request"}
    if set(claim) != expected or not isinstance(claim.get("summary"), str):
        return envelope, None, "Grok reply did not match the shared result contract"
    for field in ("findings", "files_read", "files_changed", "blockers"):
        value = claim[field]
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            return envelope, None, f"Grok reply has invalid {field}"
    checks = claim["checks"]
    if not isinstance(checks, list) or any(
        not isinstance(item, dict)
        or set(item) != {"description", "reported_outcome", "evidence"}
        or item["reported_outcome"] not in {"passed", "failed", "not_run"}
        or not isinstance(item["description"], str)
        or not isinstance(item["evidence"], str)
        for item in checks
    ):
        return envelope, None, "Grok reply has invalid checks"
    request = claim["extension_request"]
    if not isinstance(request, dict) or set(request) != {"completed_work", "remaining_work", "reason", "requested_turns"}:
        return envelope, None, "Grok reply has invalid extension_request"
    if not isinstance(request["completed_work"], list) or not isinstance(request["remaining_work"], list):
        return envelope, None, "Grok reply has invalid extension lists"
    if any(not isinstance(item, str) for item in (*request["completed_work"], *request["remaining_work"])):
        return envelope, None, "Grok reply has non-string extension items"
    if not isinstance(request["reason"], str) or not isinstance(request["requested_turns"], int) or isinstance(request["requested_turns"], bool):
        return envelope, None, "Grok reply has invalid extension reason or turn count"
    if claim["status"] != "extension_requested" and request["requested_turns"] != 0:
        return envelope, None, "non-extension Grok reply requested turns"
    if claim["status"] == "complete" and not claim["summary"].strip() and not claim["findings"] and not claim["checks"]:
        return envelope, None, "Grok returned an empty completion without evidence"
    return envelope, claim, None


def _extension(claim: dict[str, Any] | None) -> dict[str, Any] | None:
    if not claim or claim.get("status") != "extension_requested":
        return None
    request = claim.get("extension_request")
    if not isinstance(request, dict):
        return None
    completed, remaining = request.get("completed_work"), request.get("remaining_work")
    turns = request.get("requested_turns")
    if not isinstance(completed, list) or not isinstance(remaining, list) or not remaining:
        return None
    if any(not isinstance(item, str) or not item.strip() for item in (*completed, *remaining)):
        return None
    if not isinstance(request.get("reason"), str) or not request["reason"].strip():
        return None
    if not isinstance(turns, int) or isinstance(turns, bool) or not 1 <= turns <= 24:
        return None
    return request


def _process_record(result: ProcessResult) -> dict[str, Any]:
    return {
        "exit_code": result.exit_code, "elapsed_seconds": result.elapsed_seconds,
        "timed_out": result.timed_out, "interrupted": result.interrupted,
    }


def _metrics(envelope: dict[str, Any] | None) -> dict[str, Any]:
    usage = envelope.get("usage") if envelope else None
    usage = usage if isinstance(usage, dict) else {}
    cost = envelope.get("total_cost_usd") if envelope else None
    model_usage = envelope.get("modelUsage") if envelope else None
    return {
        "input_tokens": usage.get("input_tokens"),
        "cache_read_input_tokens": usage.get("cache_read_input_tokens"),
        "cache_creation_input_tokens": usage.get("cache_creation_input_tokens"),
        "output_tokens": usage.get("output_tokens"),
        "reasoning_tokens": usage.get("reasoning_tokens"),
        "total_tokens": usage.get("total_tokens"),
        "estimated_api_equivalent_usd": cost if isinstance(cost, (int, float)) else None,
        "model_usage": model_usage if isinstance(model_usage, dict) else None,
        "subscription_window_usage": None,
    }


def _segment_metrics(envelope: dict[str, Any] | None, checkpoint: dict[str, Any] | None) -> dict[str, Any]:
    measured = _metrics(envelope)
    if checkpoint is None:
        return measured
    report_usage = checkpoint["usage"]
    for key in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens",
                "output_tokens", "reasoning_tokens", "total_tokens", "estimated_api_equivalent_usd"):
        values = [value for value in (measured[key], report_usage[key]) if isinstance(value, (int, float))]
        measured[key] = sum(values) if values else None
    by_model: dict[str, dict[str, Any]] = {}
    for source in (measured["model_usage"], report_usage["model_usage"]):
        if not isinstance(source, dict):
            continue
        for model, fields in source.items():
            if not isinstance(fields, dict):
                continue
            totals = by_model.setdefault(model, {})
            for key, value in fields.items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    totals[key] = totals.get(key, 0) + value
    measured["model_usage"] = by_model or None
    return measured


def _actual_model(envelope: dict[str, Any] | None) -> str | None:
    if not envelope:
        return None
    models = envelope.get("modelUsage")
    if isinstance(models, dict) and len(models) == 1:
        return next(iter(models))
    return envelope.get("model") if isinstance(envelope.get("model"), str) else None


def _session_id(envelope: dict[str, Any] | None) -> str | None:
    if not envelope:
        return None
    value = envelope.get("sessionId") or envelope.get("session_id")
    return value if isinstance(value, str) and SESSION_RE.fullmatch(value) else None


def _observed_context_reads(transcript: str, task: Task) -> tuple[list[str], list[str]]:
    tool_lines: list[str] = []
    in_tools = False
    for line in transcript.splitlines():
        if line.startswith("## "):
            in_tools = line.strip() == "## Tools"
        elif in_tools and line.startswith("- "):
            tool_lines.append(line[2:].strip())
    observed: list[str] = []
    missing: list[str] = []
    for context_path in task.context_paths:
        path = task.repo_root / context_path
        tool_names = {"glob", "listdir"} if path.is_dir() else {"read"}
        normalized = context_path.replace("\\", "/").lower()
        matching = [line for line in tool_lines if line.split(":", 1)[0].strip().lower() in tool_names]
        if any(normalized in line.replace("\\", "/").lower() for line in matching):
            observed.append(context_path)
        else:
            missing.append(context_path)
    return observed, missing


def _export_session(executable: Path, session_id: str | None, task: Task, artifact: Path, label: str) -> dict[str, Any]:
    if session_id is None:
        return {"status": "unavailable", "observed_context_paths": [], "missing_context_paths": list(task.context_paths)}
    exported = run_process(executable, ["--no-auto-update", "export", session_id],
                           cwd=task.repo_root, timeout_seconds=30)
    (artifact / f"{label}.session-export.md").write_text(exported.stdout, encoding="utf-8")
    (artifact / f"{label}.session-export.stderr.log").write_text(exported.stderr, encoding="utf-8")
    if exported.exit_code != 0 or exported.timed_out:
        return {"status": "failed", "observed_context_paths": [], "missing_context_paths": list(task.context_paths)}
    observed, missing = _observed_context_reads(exported.stdout, task)
    return {"status": "verified" if not missing else "missing_reads",
            "observed_context_paths": observed, "missing_context_paths": missing}


def _hit_turn_cap(process: ProcessResult, envelope: dict[str, Any] | None) -> bool:
    return bool(envelope and envelope.get("stopReason") in {"cancelled", "max_turns"}
                and "max turns reached" in process.stderr.lower())


def _run_segment(
    task: Task, worktree: Path, artifact: Path, executable: Path, assignment_text: str,
    turns: int, label: str, *, resume_session: str | None = None,
) -> dict[str, Any]:
    assignment = artifact / f"{label}.assignment.txt"
    assignment.write_text(assignment_text, encoding="utf-8")
    # No output schema on the work call: with one, Grok sometimes answers with the JSON at once and ends its turn
    # before using any tool (seen 2026-10-01). The structured reply comes from the no-tools report call below.
    process = run_process(executable, _args(task, worktree, assignment, turns, None, resume_session=resume_session),
                          cwd=worktree, timeout_seconds=task.timeout_seconds)
    (artifact / f"{label}.stdout.json").write_text(process.stdout, encoding="utf-8")
    (artifact / f"{label}.stderr.log").write_text(process.stderr, encoding="utf-8")
    envelope, claim, error = _envelope(process.stdout)
    session_id = _session_id(envelope)
    hit_cap = _hit_turn_cap(process, envelope)
    checkpoint = None
    if claim is None and session_id and not process.timed_out and not process.interrupted and (
        process.exit_code == 0 or hit_cap
    ):
        claim, error, checkpoint = _request_checkpoint(task, worktree, artifact, executable, label, session_id)
    context_evidence = _export_session(executable, session_id, task, artifact, label)
    return {
        "process": process, "envelope": envelope, "claim": claim, "error": error,
        "session_id": session_id, "hit_cap": hit_cap, "checkpoint": checkpoint,
        "context_evidence": context_evidence,
        "label": label, "granted_turns": turns,
    }


def _request_checkpoint(
    task: Task, worktree: Path, artifact: Path, executable: Path, label: str, session_id: str,
    *, reasoning_effort: str | None = None,
) -> tuple[dict[str, Any] | None, str | None, dict[str, Any]]:
    worktree_before = _fingerprint(worktree, task.base_commit) if task.mode in ("implement", "test") else None
    checkpoint_file = artifact / f"{label}.checkpoint.assignment.txt"
    checkpoint_file.write_text(
        "Do not use tools or change files. Report a structured account of work already done in this session. "
        "Return complete only if finished, blocked if unable to continue, or extension_requested with exact remaining work. "
        "Do not claim files were read or changed unless the earlier tool calls actually did so. "
        "Use an empty extension_request with requested_turns 0 for non-extension statuses.",
        encoding="utf-8",
    )
    cp = run_process(executable, _args(task, worktree, checkpoint_file, 1, REPLY_SCHEMA,
                                       resume_session=session_id, no_tools=True,
                                       reasoning_effort=reasoning_effort),
                     cwd=worktree, timeout_seconds=min(task.timeout_seconds, 90))
    (artifact / f"{label}.checkpoint.stdout.json").write_text(cp.stdout, encoding="utf-8")
    (artifact / f"{label}.checkpoint.stderr.log").write_text(cp.stderr, encoding="utf-8")
    cp_envelope, cp_claim, cp_error = _envelope(cp.stdout)
    if worktree_before is not None and _fingerprint(worktree, task.base_commit) != worktree_before:
        cp_error = "no-tools checkpoint changed the worktree"
    elif cp.exit_code == 0 and cp_claim is not None and _session_id(cp_envelope) != session_id:
        cp_error = "checkpoint resumed a different session"
    elif cp.timed_out or cp.interrupted:
        cp_error = "checkpoint timed out or was interrupted"
    checkpoint = {"process": _process_record(cp), "error": cp_error, "usage": _metrics(cp_envelope)}
    if cp.exit_code == 0 and cp_claim is not None and cp_error is None:
        return cp_claim, None, checkpoint
    return None, f"checkpoint format failed: {cp_error or cp.stderr.strip() or cp.exit_code}", checkpoint


def _validation(task: Task, worktree: Path, artifact: Path) -> tuple[dict[str, Any], str | None]:
    if not task.validation_command:
        return {"status": "not_run", "requested": None}, None
    requested = Path(task.validation_command[0])
    if requested.is_absolute() or requested.parent != Path("."):
        candidates = [requested] if requested.is_absolute() else [worktree / requested, task.repo_root / requested]
        executable = next((path.resolve() for path in candidates if path.is_file()), None)
    else:
        found = shutil.which(task.validation_command[0])
        executable = Path(found).resolve() if found else None
    if executable is None:
        return {"status": "failed", "requested": list(task.validation_command)}, "validation executable not found"
    process = run_process(executable, task.validation_command[1:], cwd=worktree,
                          timeout_seconds=task.validation_timeout_seconds)
    (artifact / "validation.stdout.log").write_text(process.stdout, encoding="utf-8")
    (artifact / "validation.stderr.log").write_text(process.stderr, encoding="utf-8")
    status = "passed" if process.exit_code == 0 and not process.timed_out else "failed"
    return {"status": status, "requested": list(task.validation_command), "process": _process_record(process)}, (
        None if status == "passed" else "independent validation failed"
    )


def _lock_path(task_id: str) -> Path:
    return ARTIFACT_ROOT / ".active" / f"{task_id}.json"


@contextlib.contextmanager
def _task_lock(task_id: str, operation: str) -> Iterator[None]:
    directory = ARTIFACT_ROOT / ".active"
    directory.mkdir(parents=True, exist_ok=True)
    lock = _lock_path(task_id)
    try:
        fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise GrokBridgeError(f"task already has an active or stale lock: {lock}") from exc
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump({"task_id": task_id, "pid": os.getpid(), "operation": operation, "started_at": _now()}, handle)
        yield
    finally:
        lock.unlink(missing_ok=True)


def _finish(task: Task, artifact: Path, worktree: Path, segment: dict[str, Any],
            primary_before: str, prior: dict[str, Any] | None = None) -> dict[str, Any]:
    process: ProcessResult = segment["process"]
    envelope = segment["envelope"]
    claim = segment["claim"]
    failures: list[str] = []
    warnings: list[str] = []
    extension = _extension(claim)
    checkpoint_failed = bool(segment["checkpoint"] and segment["error"])
    if process.timed_out:
        failures.append("Grok work segment timed out")
    if process.exit_code != 0 and not (segment["hit_cap"] and claim is not None):
        failures.append(f"Grok exited with {process.exit_code}")
    if segment["error"]:
        failures.append(segment["error"])
    if claim is None:
        failures.append("missing structured reply")
    elif claim.get("status") == "blocked":
        failures.append("Grok reported blocked")
    elif claim.get("status") == "partial":
        failures.append("Grok reported partial")
    elif claim.get("status") == "extension_requested" and extension is None:
        failures.append("invalid extension request")
    if extension is not None and segment["session_id"] is None:
        failures.append("extension requested without a resumable session ID")
    if claim is not None and claim.get("status") == "complete" and segment["context_evidence"]["status"] != "verified":
        failures.append("Grok did not demonstrably open every named context path")
    is_writing_task = task.mode in ("implement", "test")
    changed = _changed_paths(worktree, task.base_commit) if is_writing_task else []
    if is_writing_task and claim is not None and claim.get("status") == "complete":
        claimed_changes, outside_claims = _normalized_claim_paths(worktree, claim["files_changed"])
        if outside_claims:
            failures.append("Grok claimed file changes outside the worktree")
        if claimed_changes - set(changed):
            failures.append("Grok claimed file changes that are absent from the worktree")
    unauthorized = [path for path in changed if not _allowed_path(path, task.allowed_changed_paths)]
    if unauthorized:
        failures.append("out-of-scope paths changed")
    head = _git(worktree, ["rev-parse", "HEAD"]).stdout.strip().lower()
    if is_writing_task and head != task.base_commit:
        failures.append("worker changed the starting commit")
    diff_path = artifact / "diff.patch"
    diff_path.write_text(_diff(worktree, task.base_commit) if is_writing_task else "", encoding="utf-8")
    _write_json(artifact / "changed-paths.json", changed)
    primary_after = _git(task.repo_root, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout
    (artifact / "primary-status.after.txt").write_text(primary_after, encoding="utf-8")
    primary_unchanged = primary_before == primary_after
    if not primary_unchanged:
        failures.append("primary checkout changed during delegation")
    if not failures and extension is None:
        validation, validation_error = _validation(task, worktree, artifact)
        if validation_error:
            failures.append(validation_error)
    else:
        validation = {"status": "not_run", "requested": list(task.validation_command) if task.validation_command else None}
    if not failures and extension is not None:
        status, lifecycle = "extension_requested", "EXTENSION_REQUESTED"
    elif failures:
        status, lifecycle = "checkpoint_failed" if checkpoint_failed else "failed", "CHECKPOINT_FORMAT_FAILED" if checkpoint_failed else "BLOCKED"
    else:
        status, lifecycle = "complete", "REVIEW_PENDING" if task.review_required else "IMPLEMENTED"
    previous_segments = list(prior.get("segments", [])) if prior else []
    measured = _segment_metrics(envelope, segment["checkpoint"])
    segment_record = {
        "label": segment["label"], "granted_turns": segment["granted_turns"],
        "session_id": segment["session_id"], "process": _process_record(process),
        "turn_cap_reached": segment["hit_cap"], "checkpoint": segment["checkpoint"],
        "context_evidence": segment["context_evidence"],
        "worktree_fingerprint": _fingerprint(worktree, task.base_commit),
        "usage": measured,
    }
    record = {
        "provider": "grok-build", "task_id": task.task_id,
        "status": status, "lifecycle_status": lifecycle,
        "artifact_directory": str(artifact), "repository": str(task.repo_root),
        "starting_commit": task.base_commit, "worktree": str(worktree),
        "session_id": segment["session_id"],
        "request_id": envelope.get("requestId") if envelope else None,
        "requested_model": task.model or DEFAULT_MODEL,
        "requested_reasoning_effort": segment.get("reasoning_effort", DEFAULT_EFFORT),
        "actual_model": _actual_model(envelope),
        "process": _process_record(process), "grok_claim": claim,
        "changed_paths": changed, "unauthorized_changed_paths": unauthorized,
        "diff_path": str(diff_path), "validation": validation,
        "primary_checkout_unchanged": primary_unchanged,
        "observed_metrics": measured,
        "subscription_usage": {"value": None, "provenance": "unavailable"},
        "warnings": warnings, "failures": failures, "extension_request": extension,
        "segments": previous_segments + [segment_record],
    }
    if prior:
        record["preflight"] = prior["preflight"]
        record["model_before_continuation"] = prior.get("actual_model")
        for key in ("handoff", "revisions"):
            if key in prior:
                record[key] = prior[key]
    _write_json(artifact / "result.json", record)
    return record


def run(task_file: Path, handoff: Path | None = None, model: str | None = None) -> dict[str, Any]:
    task = load_task(task_file)
    _verify_repo(task)
    manifest = None
    if handoff is not None:
        if task.mode not in ("implement", "test"):
            raise GrokBridgeError("handoff seeding requires an implement or test task")
        manifest = shared_handoff.verify_handoff(handoff, task)
    task = _runtime_task(task, model=model)
    preflight = _preflight(task.model)
    _shadow_root(create=True)
    with _task_lock(task.task_id, "run"):
        artifact = ARTIFACT_ROOT / f"{task.task_id}-{_stamp()}"
        artifact.mkdir(exist_ok=False)
        shutil.copy2(task_file.resolve(strict=True), artifact / "task.json")
        primary_before = _git(task.repo_root, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout
        (artifact / "primary-status.before.txt").write_text(primary_before, encoding="utf-8")
        worktree = task.repo_root
        if task.mode in ("implement", "test"):
            worktree = artifact / "worktree"
            branch = f"delegate/grok-{task.task_id}-{_stamp().lower()}"
            _git(task.repo_root, ["worktree", "add", "-b", branch, str(worktree), task.base_commit])
        inherited = None
        if manifest is not None:
            seeded = shared_handoff.seed_handoff(handoff, manifest, worktree, task)
            _write_json(artifact / "handoff-manifest.json", manifest)
            inherited_diff = artifact / "inherited.diff.patch"
            inherited_diff.write_text(_diff(worktree, task.base_commit), encoding="utf-8")
            inherited = {
                **seeded,
                "package_directory": str(Path(handoff).resolve()),
                "inherited_fingerprint": _fingerprint(worktree, task.base_commit),
                "inherited_diff_path": str(inherited_diff),
            }
        assignment = _assignment(task, handoff=inherited)
        segment = _run_segment(task, worktree, artifact, Path(preflight["executable"]), assignment,
                               task.max_turns, "initial")
        record = _finish(task, artifact, worktree, segment, primary_before)
        record["preflight"] = preflight
        if inherited is not None:
            # Inherited changes are recorded separately; diff.patch still reviews the combined change against base.
            record["handoff"] = inherited
        _write_json(artifact / "result.json", record)
        return record


def revise_task(task_file: Path, artifact_path: Path, feedback_file: Path, granted_turns: int) -> dict[str, Any]:
    """Resume a reviewed Grok result's same session and worktree with explicit lead findings."""
    task = load_task(task_file)
    if not isinstance(granted_turns, int) or isinstance(granted_turns, bool) or not 1 <= granted_turns <= MAX_GROK_REVISION_TURNS:
        raise GrokBridgeError(f"Grok revision grants must be 1 through {MAX_GROK_REVISION_TURNS} turns")
    if task.mode not in ("implement", "test"):
        raise GrokBridgeError("revision requires an implement or test task")
    artifact = artifact_path.resolve(strict=True)
    _shadow_root(create=True)
    if ARTIFACT_ROOT.resolve() not in artifact.parents:
        raise GrokBridgeError("artifact is outside the Grok artifact root")
    with _task_lock(task.task_id, "revise"):
        _verify_repo(task)
        prior_bytes = (artifact / "result.json").read_bytes()
        prior = json.loads(prior_bytes.decode("utf-8"))
        original = load_task(artifact / "task.json")
        if prior.get("task_id") != task.task_id or original.raw != task.raw or prior.get("starting_commit") != task.base_commit:
            raise GrokBridgeError("artifact and task contract do not match")
        target_state = revision_target_state(prior)
        session = prior.get("session_id")
        if not isinstance(session, str) or not SESSION_RE.fullmatch(session):
            raise GrokBridgeError("artifact has no valid Grok session ID")
        segments = prior.get("segments") or []
        if not segments or any(not isinstance(item, dict) or item.get("session_id") != session for item in segments):
            raise GrokBridgeError("artifact session lineage is inconsistent")
        worktree_value = prior.get("worktree")
        if not isinstance(worktree_value, str) or not worktree_value:
            raise GrokBridgeError("artifact has no recorded worktree")
        worktree = Path(worktree_value).resolve(strict=True)
        if artifact not in worktree.parents:
            raise GrokBridgeError("worktree is outside its artifact")
        if _git(worktree, ["rev-parse", "HEAD"]).stdout.strip().lower() != task.base_commit:
            raise GrokBridgeError("worktree HEAD moved away from the original base commit")
        expected_fingerprint = segments[-1].get("worktree_fingerprint")
        if _fingerprint(worktree, task.base_commit) != expected_fingerprint:
            raise GrokBridgeError("worktree changed after the recorded result; revision refused")
        feedback = load_feedback(feedback_file, allowed_changed_paths=task.allowed_changed_paths, worktree=worktree)
        revisions = list(prior.get("revisions") or [])
        if any(isinstance(item, dict) and item.get("feedback_sha256") == feedback["sha256"] for item in revisions):
            raise GrokBridgeError("identical review feedback was already applied to this artifact")
        number = len(revisions) + 1
        label = f"revision-{number}"
        with (artifact / f"{label}.prior-result.json").open("xb") as handle:
            handle.write(prior_bytes)
        with (artifact / f"{label}.feedback.json").open("x", encoding="utf-8") as handle:
            json.dump({"findings": feedback["findings"]}, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        task = _runtime_task(task, prior=prior)
        preflight = _preflight(task.model)
        assignment = _assignment(task, revision=feedback["findings"], granted_turns=granted_turns)
        segment = _run_segment(task, worktree, artifact, Path(preflight["executable"]), assignment,
                               granted_turns, label, resume_session=session)
        if segment["session_id"] != session:
            segment["error"] = "Grok resumed a different session"
        primary_before = (artifact / "primary-status.before.txt").read_text(encoding="utf-8")
        record = _finish(task, artifact, worktree, segment, primary_before, prior)
        fingerprint = record["segments"][-1]["worktree_fingerprint"]
        if fingerprint == expected_fingerprint:
            record["failures"].append("revision made no measurable change to the worktree")
            if record["status"] not in {"failed", "checkpoint_failed"}:
                record["status"], record["lifecycle_status"] = "failed", "BLOCKED"
        record["revisions"] = revisions + [{
            "index": number, "label": label, "granted_turns": granted_turns,
            "feedback_file": f"{label}.feedback.json", "feedback_sha256": feedback["sha256"],
            "finding_count": len(feedback["findings"]),
            "prior_result_file": f"{label}.prior-result.json",
            "prior_result_sha256": hashlib.sha256(prior_bytes).hexdigest(),
            "prior_status": prior.get("status"), "prior_lifecycle_status": prior.get("lifecycle_status"),
            "prior_failures": list(prior.get("failures") or []), "target_state": target_state,
            "prior_worktree_fingerprint": expected_fingerprint, "worktree_fingerprint": fingerprint,
            "outcome_lifecycle_status": record["lifecycle_status"], "captured_at": _now(),
        }]
        _write_json(artifact / "result.json", record)
        return record


def continue_task(task_file: Path, artifact_path: Path, granted_turns: int) -> dict[str, Any]:
    task = load_task(task_file)
    if not 1 <= granted_turns <= 6:
        raise GrokBridgeError("Grok continuation grants must be 1 through 6 turns")
    artifact = artifact_path.resolve(strict=True)
    _shadow_root(create=True)
    if ARTIFACT_ROOT.resolve() not in artifact.parents:
        raise GrokBridgeError("artifact is outside the Grok artifact root")
    with _task_lock(task.task_id, "continue"):
        _verify_repo(task)
        prior = json.loads((artifact / "result.json").read_text(encoding="utf-8"))
        original = load_task(artifact / "task.json")
        if prior.get("task_id") != task.task_id or original.raw != task.raw or prior.get("starting_commit") != task.base_commit:
            raise GrokBridgeError("artifact and task contract do not match")
        if prior.get("lifecycle_status") != "EXTENSION_REQUESTED":
            raise GrokBridgeError("artifact is not awaiting an extension decision")
        request = prior.get("extension_request")
        requested_turns = request.get("requested_turns") if isinstance(request, dict) else None
        if not isinstance(requested_turns, int) or granted_turns > requested_turns:
            raise GrokBridgeError("grant exceeds the worker's valid request")
        session = prior.get("session_id")
        if not isinstance(session, str) or not SESSION_RE.fullmatch(session):
            raise GrokBridgeError("artifact has no valid Grok session ID")
        if any(segment.get("session_id") != session for segment in prior.get("segments", [])):
            raise GrokBridgeError("artifact session lineage is inconsistent")
        worktree = Path(prior.get("worktree", "")).resolve(strict=True)
        if task.mode in ("implement", "test") and artifact not in worktree.parents:
            raise GrokBridgeError("worktree is outside its artifact")
        if task.mode in ("analyze", "review") and worktree != task.repo_root:
            raise GrokBridgeError("read-only worktree does not match the repository")
        current_fingerprint = _fingerprint(worktree, task.base_commit)
        expected_fingerprint = prior["segments"][-1]["worktree_fingerprint"]
        if current_fingerprint != expected_fingerprint:
            raise GrokBridgeError("worktree changed after the prior segment")
        task = _runtime_task(task, prior=prior)
        preflight = _preflight(task.model)
        label = f"segment-{len(prior['segments']) + 1}"
        assignment = _assignment(task, continuation=request, granted_turns=granted_turns)
        segment = _run_segment(task, worktree, artifact, Path(preflight["executable"]), assignment,
                               granted_turns, label, resume_session=session)
        if segment["session_id"] != session:
            segment["error"] = "Grok resumed a different session"
        primary_before = (artifact / "primary-status.before.txt").read_text(encoding="utf-8")
        record = _finish(task, artifact, worktree, segment, primary_before, prior)
        if task.mode in ("implement", "test"):
            progress_changed = record["segments"][-1]["worktree_fingerprint"] != expected_fingerprint
        else:
            progress_changed = record.get("extension_request") != request
        if record["lifecycle_status"] == "EXTENSION_REQUESTED" and not progress_changed:
            record["status"], record["lifecycle_status"] = "failed", "BLOCKED"
            record["failures"].append("continuation requested more turns without measurable progress")
            _write_json(artifact / "result.json", record)
        return record


def recover_turn_cap(task_file: Path, artifact_path: Path) -> dict[str, Any]:
    """Request the missing no-tools checkpoint for one preserved max-turns failure."""
    task = load_task(task_file)
    _verify_repo(task)
    _shadow_root()
    artifact = artifact_path.resolve(strict=True)
    if ARTIFACT_ROOT.resolve() not in artifact.parents:
        raise GrokBridgeError("artifact is outside the Grok artifact root")
    with _task_lock(task.task_id, "recover-turn-cap"):
        prior = json.loads((artifact / "result.json").read_text(encoding="utf-8"))
        original = load_task(artifact / "task.json")
        if original.raw != task.raw or prior.get("task_id") != task.task_id or prior.get("starting_commit") != task.base_commit:
            raise GrokBridgeError("artifact and task contract do not match")
        if prior.get("status") != "failed" or prior.get("lifecycle_status") != "BLOCKED":
            raise GrokBridgeError("artifact is not a blocked max-turns failure")
        if prior.get("failures") != ["Grok exited with 1", "Grok text was not structured JSON", "missing structured reply"]:
            raise GrokBridgeError("artifact has other failures and is not eligible for recovery")
        segments = prior.get("segments", [])
        if len(segments) != 1 or segments[0].get("label") != "initial" or not segments[0].get("turn_cap_reached") or segments[0].get("checkpoint") is not None:
            raise GrokBridgeError("artifact has no single uncheckpointed turn-cap segment")
        worktree = Path(prior.get("worktree", "")).resolve(strict=True)
        if task.mode in ("implement", "test"):
            if artifact not in worktree.parents or _fingerprint(worktree, task.base_commit) != segments[0]["worktree_fingerprint"]:
                raise GrokBridgeError("worktree moved or changed after the failed segment")
        elif worktree != task.repo_root:
            raise GrokBridgeError("read-only worktree does not match the repository")
        primary_before = (artifact / "primary-status.before.txt").read_text(encoding="utf-8")
        primary_now = _git(task.repo_root, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout
        if primary_now != primary_before:
            raise GrokBridgeError("primary checkout changed after the failed segment")
        stdout = (artifact / "initial.stdout.json").read_text(encoding="utf-8")
        stderr = (artifact / "initial.stderr.log").read_text(encoding="utf-8")
        old_process = segments[0]["process"]
        process = ProcessResult(old_process["exit_code"], stdout, stderr,
                                old_process["elapsed_seconds"], old_process["timed_out"],
                                old_process["interrupted"], False)
        envelope, old_claim, _ = _envelope(stdout)
        session_id = _session_id(envelope)
        if (not _hit_turn_cap(process, envelope) or process.timed_out or process.interrupted
                or old_claim is not None or session_id != prior.get("session_id")):
            raise GrokBridgeError("stored Grok output is not the expected resumable max-turns failure")
        effort = prior.get("requested_reasoning_effort")
        if effort not in {"low", "medium", "high"}:
            raise GrokBridgeError("saved reasoning effort is invalid")
        task = _runtime_task(task, prior=prior)
        preflight = _preflight(task.model)
        shutil.copy2(artifact / "result.json", artifact / "result.before-turn-cap-recovery.json")
        shutil.copy2(artifact / "initial.session-export.md", artifact / "initial.session-export.before-turn-cap-recovery.md")
        claim, error, checkpoint = _request_checkpoint(task, worktree, artifact, Path(preflight["executable"]),
                                                       "initial", session_id, reasoning_effort=effort)
        context_evidence = _export_session(Path(preflight["executable"]), session_id, task, artifact, "initial")
        segment = {
            "process": process, "envelope": envelope, "claim": claim, "error": error,
            "session_id": session_id, "hit_cap": True, "checkpoint": checkpoint,
            "context_evidence": context_evidence, "label": "initial",
            "granted_turns": segments[0]["granted_turns"], "reasoning_effort": effort,
        }
        record = _finish(task, artifact, worktree, segment, primary_before)
        record["preflight"] = prior["preflight"]
        record["recovered_at"] = _now()
        record["recovery_reason"] = "Checkpoint after a saved max-turns exit"
        _write_json(artifact / "result.json", record)
        return record


def recheck_task(task_file: Path, artifact_path: Path) -> dict[str, Any]:
    """Re-evaluate a false-blocked artifact without spending another Grok turn."""
    task = load_task(task_file)
    _verify_repo(task)
    _shadow_root()
    artifact = artifact_path.resolve(strict=True)
    if ARTIFACT_ROOT.resolve() not in artifact.parents:
        raise GrokBridgeError("artifact is outside the Grok artifact root")
    with _task_lock(task.task_id, "recheck"):
        prior = json.loads((artifact / "result.json").read_text(encoding="utf-8"))
        original = load_task(artifact / "task.json")
        if original.raw != task.raw or prior.get("task_id") != task.task_id:
            raise GrokBridgeError("artifact and task contract do not match")
        if prior.get("status") != "failed" or prior.get("failures") != [
            "Grok claimed file changes that are absent from the worktree"
        ]:
            raise GrokBridgeError("artifact is not eligible for this narrow offline recheck")
        if len(prior.get("segments", [])) != 1:
            raise GrokBridgeError("offline recheck requires a single completed segment")
        worktree = Path(prior["worktree"]).resolve(strict=True)
        if artifact not in worktree.parents:
            raise GrokBridgeError("worktree is outside its artifact")
        segment_old = prior["segments"][0]
        if _fingerprint(worktree, task.base_commit) != segment_old["worktree_fingerprint"]:
            raise GrokBridgeError("worktree changed after the original result")
        stdout = (artifact / "initial.stdout.json").read_text(encoding="utf-8")
        stderr = (artifact / "initial.stderr.log").read_text(encoding="utf-8")
        envelope, _, parse_error = _envelope(stdout)
        if envelope is None or _session_id(envelope) != prior["session_id"]:
            raise GrokBridgeError(f"stored Grok envelope is invalid: {parse_error}")
        checkpoint_text = (artifact / "initial.checkpoint.stdout.json").read_text(encoding="utf-8")
        _, claim, claim_error = _envelope(checkpoint_text)
        if claim is None or claim != prior["grok_claim"]:
            raise GrokBridgeError(f"stored Grok claim is invalid or changed: {claim_error}")
        transcript = (artifact / "initial.session-export.md").read_text(encoding="utf-8")
        observed, missing = _observed_context_reads(transcript, task)
        process_old = segment_old["process"]
        process = ProcessResult(process_old["exit_code"], stdout, stderr,
                                process_old["elapsed_seconds"], process_old["timed_out"],
                                process_old["interrupted"], False)
        segment = {
            "process": process, "envelope": envelope, "claim": claim, "error": None,
            "session_id": prior["session_id"], "hit_cap": segment_old["turn_cap_reached"],
            "checkpoint": segment_old["checkpoint"],
            "context_evidence": {"status": "verified" if not missing else "missing_reads",
                                 "observed_context_paths": observed, "missing_context_paths": missing},
            "label": "initial", "granted_turns": segment_old["granted_turns"],
        }
        shutil.copy2(artifact / "result.json", artifact / "result.before-recheck.json")
        before = (artifact / "primary-status.before.txt").read_text(encoding="utf-8")
        task = _runtime_task(task, prior=prior)
        record = _finish(task, artifact, worktree, segment, before)
        record["preflight"] = prior["preflight"]
        record["rechecked_at"] = _now()
        record["recheck_reason"] = "Normalized absolute claimed paths against the verified worktree"
        _write_json(artifact / "result.json", record)
        return record


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bounded Claude-led Grok Build fallback adapter")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("preflight")
    check = commands.add_parser("check-task")
    check.add_argument("--task", type=Path, required=True)
    launch = commands.add_parser("run")
    launch.add_argument("--task", type=Path, required=True)
    launch.add_argument("--model", default=None, help="Grok model for this new assignment; canonical task remains unchanged")
    launch.add_argument("--handoff", type=Path, default=None,
                        help="Seed the new worktree from a verified Codex handoff package")
    revise = commands.add_parser("revise")
    revise.add_argument("--task", type=Path, required=True)
    revise.add_argument("--artifact", type=Path, required=True)
    revise.add_argument("--feedback", type=Path, required=True)
    revise.add_argument("--grant-turns", type=int, required=True)
    resume = commands.add_parser("continue")
    resume.add_argument("--task", type=Path, required=True)
    resume.add_argument("--artifact", type=Path, required=True)
    resume.add_argument("--grant-turns", type=int, required=True)
    recover = commands.add_parser("recover-turn-cap")
    recover.add_argument("--task", type=Path, required=True)
    recover.add_argument("--artifact", type=Path, required=True)
    recheck = commands.add_parser("recheck")
    recheck.add_argument("--task", type=Path, required=True)
    recheck.add_argument("--artifact", type=Path, required=True)
    active = commands.add_parser("active")
    active.add_argument("--task-id", required=True)
    parser.add_argument("--full", action="store_true",
                        help="Print the complete result record instead of the compact report (the record is always in result.json)")
    args = parser.parse_args(argv)
    try:
        if args.command == "preflight":
            result = {"status": "ready", "preflight": _preflight()}
        elif args.command == "check-task":
            task = load_task(args.task)
            _verify_repo(task)
            result = {"status": "ready", "task_id": task.task_id, "mode": task.mode}
        elif args.command == "run":
            result = run(args.task, args.handoff, args.model)
        elif args.command == "revise":
            result = revise_task(args.task, args.artifact, args.feedback, args.grant_turns)
        elif args.command == "continue":
            result = continue_task(args.task, args.artifact, args.grant_turns)
        elif args.command == "recover-turn-cap":
            result = recover_turn_cap(args.task, args.artifact)
        elif args.command == "recheck":
            result = recheck_task(args.task, args.artifact)
        else:
            _shadow_root()
            lock = _lock_path(args.task_id)
            result = {"task_id": args.task_id, "lock_path": str(lock), "lock_exists": lock.exists()}
            if lock.exists():
                result["lock"] = json.loads(lock.read_text(encoding="utf-8"))
    except (GrokBridgeError, BridgeError, ContractError, OSError, ValueError, subprocess.TimeoutExpired) as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, indent=2), file=sys.stderr)
        return 2
    shown = result if args.full or args.command not in {"run", "revise", "continue", "recover-turn-cap", "recheck"} else brief(result)
    print(json.dumps(shown, indent=2, ensure_ascii=False))
    return 0 if result.get("status") not in {"failed", "checkpoint_failed"} else 1


if __name__ == "__main__":
    raise SystemExit(main())

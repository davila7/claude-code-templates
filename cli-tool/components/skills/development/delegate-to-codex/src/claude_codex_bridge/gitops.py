"""Git, worktree and task-lock helpers for the Codex worker bridge.

Every Git command the bridge runs goes through ``_run_git``/``_git``/``_git_bytes``. They isolate the call
from the user's and the worker's configuration (diff prefixes, colour, external diff, hooks, fsmonitor, ...),
drop inherited ``GIT_*`` variables, resolve ``git`` to an absolute path that never comes from the current
directory, and, for a worktree created by ``create_worktree``, ignore the worker-writable ``.git`` pointer
file in favour of the git directory recorded at creation.
"""
from __future__ import annotations

import atexit
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterator, Sequence

from .contracts import TASK_ID_RE, Task
from .process import which
from .revision import is_directory_link, link_kind, link_kind_of, path_within_scope


class BridgeError(RuntimeError):
    pass


class WorktreeTampered(BridgeError):
    """The worktree's pinned git directory or ``.git`` pointer no longer matches what was recorded."""


class UnsafeWorktree(BridgeError):
    """The worktree holds links, nested repositories or special entries the bridge refuses to snapshot."""

    def __init__(self, message: str, findings: Sequence[dict[str, str]] = ()):
        super().__init__(message)
        self.findings = [dict(item) for item in findings]


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_write_json(path: Path, value: Any) -> None:
    """Publish a complete JSON file; concurrent writers each own their temporary file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as out:
            temporary = Path(out.name)
            json.dump(value, out, indent=2, ensure_ascii=False)
            out.write("\n")
        for attempt in range(5):
            try:
                os.replace(temporary, path)
                break
            except PermissionError as exc:
                # Windows replacement can briefly conflict with another reader/writer's handle.
                if attempt == 4 or os.name != "nt" or getattr(exc, "winerror", None) not in (5, 32, 33):
                    raise
                time.sleep(0.01 * 2 ** attempt)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


# ---------------------------------------------------------------- task id validation

# Names Windows reserves as devices, with or without an extension ("nul.json" is still the NUL device).
WINDOWS_RESERVED_NAMES = frozenset(
    {"con", "prn", "aux", "nul", *(f"com{n}" for n in range(1, 10)), *(f"lpt{n}" for n in range(1, 10))})


def validate_task_id(task_id: Any) -> str:
    """Return a task id that is safe as a file name (lock, artifact) and inside a Git branch name.

    Beyond the contract pattern this rejects ``..`` (not valid in a Git ref, so ``worktree add -b`` would fail
    only after the lock and artifact exist) and Windows device names, which turn ``.active/nul.json`` into the
    NUL device so the per-task lock would silently lock nothing.
    """
    if not isinstance(task_id, str) or not TASK_ID_RE.fullmatch(task_id):
        raise BridgeError("task_id is invalid")
    if ".." in task_id:
        raise BridgeError("task_id must not contain '..' (not valid in a Git branch name)")
    if task_id.split(".", 1)[0] in WINDOWS_RESERVED_NAMES:
        raise BridgeError(f"task_id {task_id!r} is a reserved Windows device name")
    return task_id


def branch_name_valid(name: str) -> bool:
    """Ask Git whether ``name`` is a valid branch name (exact check for names built from a task id)."""
    try:
        return _run_git(Path.cwd(), ["check-ref-format", "--branch", name], check=False, timeout=30,
                        use_pin=False).returncode == 0
    except BridgeError:
        return False


# ---------------------------------------------------------------- git invocation

GIT_TIMEOUT_SECONDS = 60          # ordinary calls: rev-parse, branch, cat-file, ...
GIT_HEAVY_TIMEOUT_SECONDS = 900   # calls that read or write a whole tree: worktree add, add -A, status, ...
_HEAVY_COMMANDS = frozenset({"worktree", "add", "read-tree", "write-tree", "status", "diff", "ls-files",
                             "hash-object", "apply", "checkout-index"})
_GLOBAL_OPTIONS_WITH_VALUE = ("-c", "-C", "--git-dir", "--work-tree", "--attr-source", "--namespace")
# Git variables that only choose which user/system config files apply are kept; everything else is dropped.
_KEPT_GIT_VARIABLES = frozenset({"GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"})

_git_paths: dict[str | None, str] = {}
_hooks_directory: Path | None = None


def git_executable() -> str:
    """Absolute path of git from PATH only (never the current directory)."""
    key = os.environ.get("PATH")
    cached = _git_paths.get(key)
    if cached and os.path.isfile(cached):
        return cached
    value = which("git", suffixes=(".exe",) if os.name == "nt" else None)
    if not value:
        raise BridgeError("Git is not available")
    _git_paths[key] = value
    return value


HOOKS_DIRECTORY_PREFIX = "delegate-no-hooks-"
STALE_HOOKS_DIRECTORY_SECONDS = 24 * 3600


def _sweep_stale_hook_directories() -> None:
    """Remove empty hooks directories that a killed process could not clean up (``rmdir`` never touches content)."""
    try:
        for entry in Path(tempfile.gettempdir()).glob(HOOKS_DIRECTORY_PREFIX + "*"):
            try:
                if time.time() - entry.stat().st_mtime > STALE_HOOKS_DIRECTORY_SECONDS:
                    entry.rmdir()
            except OSError:
                pass
    except OSError:
        pass


def _empty_hooks_directory() -> str:
    """A private empty directory used as core.hooksPath, so no hook of any repository runs."""
    global _hooks_directory
    if _hooks_directory is None or not _hooks_directory.is_dir():
        _sweep_stale_hook_directories()
        _hooks_directory = Path(tempfile.mkdtemp(prefix=HOOKS_DIRECTORY_PREFIX))
        atexit.register(shutil.rmtree, _hooks_directory, ignore_errors=True)
    return _hooks_directory.as_posix()


def _config_options() -> list[str]:
    """``-c`` options that pin every setting able to change what the bridge reads, writes or executes.

    core.autocrlf/eol are deliberately left to the user's configuration: a worktree is checked out and later
    snapshotted with the same conversion, which is what keeps patches round-tripping. core.safecrlf is turned
    off so a mixed-line-ending file cannot abort a snapshot.
    """
    settings = [
        "core.fsmonitor=false", f"core.hooksPath={_empty_hooks_directory()}", "core.quotePath=true",
        "core.protectNTFS=true", "core.safecrlf=false", "core.abbrev=auto",
        "diff.noprefix=false", "diff.mnemonicPrefix=false", "diff.relative=false", "diff.ignoreSubmodules=none",
        "diff.renames=false", "diff.suppressBlankEmpty=false", "diff.autoRefreshIndex=false",
        "color.ui=false", "color.diff=false", "color.status=false",
        "apply.whitespace=nowarn", "apply.ignoreWhitespace=no",
        "gc.auto=0", "maintenance.auto=false", "submodule.recurse=false",
    ]
    if os.name == "nt":
        settings.append("core.longpaths=true")
    options: list[str] = []
    for item in settings:
        options.extend(("-c", item))
    return options


def _git_environment(base: dict[str, str] | None, extra: dict[str, str] | None) -> dict[str, str]:
    """Environment for a bridge git call: inherited ``GIT_*`` dropped and non-Git variables allow-listed.

    Git can run repository-selected programs (clean/smudge/process filters are neutralised by
    ``_filter_options``, but any that still run, such as a credential or askpass helper from the user's
    configuration) outside the worker sandbox, so they get the same scrubbed environment validation gets
    (``bridge.scrub_environment``: no tokens, keys or cloud credentials).
    """
    from .bridge import scrub_environment  # deferred: bridge imports this module

    source = os.environ if base is None else base
    kept_git = {key: value for key, value in source.items() if key.upper() in _KEPT_GIT_VARIABLES}
    environment = scrub_environment(source)[0]
    environment.update(kept_git)
    settings = {"GIT_TERMINAL_PROMPT": "0", **({"NoDefaultCurrentDirectoryInExePath": "1"} if os.name == "nt" else {}),
                **(extra or {})}
    for name in settings:  # Windows names are case-insensitive: never leave two spellings in one environment
        for existing in [key for key in environment if key.upper() == name.upper()]:
            del environment[existing]
    environment.update(settings)
    return environment


_FILTER_KEY = re.compile(r"^filter\.(?P<name>.+)\.(?:clean|smudge|process|required)$", re.IGNORECASE | re.DOTALL)


def _filter_options(cwd: Path, prefix: Sequence[str]) -> list[str]:
    """``-c`` options that switch off every configured clean/smudge/process filter driver.

    A filter named by ``.gitattributes`` is a command from the user's or repository's configuration, and the
    script it points at can live in the worktree the worker edits. Pinning attributes to the base commit does
    not pin that script, so the bridge never runs one: an empty driver command is a no-op and ``required`` is
    cleared so that cannot become an error. Because every call (checkout, snapshot, diff, status, apply) is
    treated alike, a worktree holds the stored blob bytes and snapshots hash those same bytes, so patches stay
    byte-exact and apply cleanly in the primary checkout. The trade-off: a filter whose stored form differs
    from its checked-out form (Git LFS pointers, keyword expansion) is seen in its stored form, so the worker
    edits pointer text instead of the large file; text and binary content without filters is unaffected.
    """
    key = (str(cwd), tuple(prefix), _config_signature(cwd, prefix))
    cached = _filter_option_cache.get(key)
    if cached is not None:
        return list(cached)
    probe = subprocess.run(
        [git_executable(), "--no-pager", "--no-optional-locks", *prefix, "config", "-z", "--get-regexp",
         r"^filter\..*\.(clean|smudge|process|required)$"],
        cwd=str(cwd), stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=GIT_TIMEOUT_SECONDS,
        shell=False, check=False, env=_git_environment(None, None))
    names: set[str] = set()
    for record in probe.stdout.decode("utf-8", "replace").split("\0"):
        found = _FILTER_KEY.match(record.split("\n", 1)[0])
        if found:
            names.add(found.group("name"))
    options: list[str] = []
    for name in sorted(names):
        for variable, value in (("clean", ""), ("smudge", ""), ("process", ""), ("required", "false")):
            options.extend(("-c", f"filter.{name}.{variable}={value}"))
    _filter_option_cache[key] = tuple(options)
    return options


# One bridge command is one process and asks the same repository the same question many times, so the answer
# is kept for the process. The key includes the size and mtime of the repository's and the user's config files:
# a filter driver added to them mid-command changes the key and is neutralised too.
_filter_option_cache: dict[tuple[str, tuple[str, ...], tuple], tuple[str, ...]] = {}


def _config_signature(cwd: Path, prefix: Sequence[str]) -> tuple:
    gitdir = next((item.split("=", 1)[1] for item in prefix if item.startswith("--git-dir=")), None)
    roots = [Path(gitdir)] if gitdir else [Path(cwd) / ".git"]
    files = [root / name for root in roots for name in ("config", "config.worktree")]
    files.append(Path(os.environ.get("GIT_CONFIG_GLOBAL") or Path.home() / ".gitconfig"))
    signature = []
    for path in files:
        try:
            info = path.stat()
            signature.append((str(path), info.st_size, info.st_mtime_ns))
        except OSError:
            signature.append((str(path), None, None))
    return tuple(signature)


_git_versions: dict[str, tuple[int, int]] = {}


def git_version() -> tuple[int, int]:
    """(major, minor) of the resolved git; (0, 0) when it cannot be determined."""
    executable = git_executable()
    if executable not in _git_versions:
        try:
            text = subprocess.run([executable, "--version"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                  timeout=30, check=False, shell=False,
                                  env=_git_environment(None, None)).stdout.decode("utf-8", "replace")
            found = re.search(r"(\d+)\.(\d+)", text)
            _git_versions[executable] = (int(found.group(1)), int(found.group(2))) if found else (0, 0)
        except (OSError, subprocess.TimeoutExpired):
            _git_versions[executable] = (0, 0)
    return _git_versions[executable]


def attr_source_supported() -> bool:
    """``git --attr-source`` (read attributes from a tree, not the worktree) exists from Git 2.40."""
    return git_version() >= (2, 40)


def _default_timeout(args: Sequence[str]) -> float:
    index = 0
    while index < len(args) and args[index].startswith("-"):
        index += 2 if args[index] in _GLOBAL_OPTIONS_WITH_VALUE else 1
    command = args[index] if index < len(args) else ""
    return GIT_HEAVY_TIMEOUT_SECONDS if command in _HEAVY_COMMANDS else GIT_TIMEOUT_SECONDS


def _filter_capable(args: Sequence[str]) -> bool:
    """False for read-only plumbing that never converts content, so it skips the filter lookup."""
    index = 0
    while index < len(args) and args[index].startswith("-"):
        index += 2 if args[index] in _GLOBAL_OPTIONS_WITH_VALUE else 1
    return (args[index] if index < len(args) else "") not in (
        "rev-parse", "config", "check-ref-format", "rev-list", "merge-base", "show-ref", "symbolic-ref",
        "update-ref", "for-each-ref", "ls-tree")


def _run_git(cwd: Path, args: Sequence[str], *, check: bool = True, env: dict[str, str] | None = None,
             timeout: float | None = None, stdin: bytes | None = None, extra_env: dict[str, str] | None = None,
             attr_source: str | None = None, use_pin: bool = True) -> subprocess.CompletedProcess[bytes]:
    """Run git and return its raw bytes.

    ``timeout`` defaults to GIT_TIMEOUT_SECONDS, or GIT_HEAVY_TIMEOUT_SECONDS for commands that touch a whole
    tree. ``attr_source`` (a tree-ish) makes git read ``.gitattributes`` from that tree instead of the
    worktree, so a worker-written attributes file cannot select a filter driver; it defaults to the pinned
    base commit of a pinned worktree and is skipped on a git too old to support it.
    """
    args = list(args)
    cwd = Path(cwd)
    pin = load_pin(cwd) if use_pin else None
    prefix: list[str] = []
    if pin is not None:
        verify_pin(pin)
        prefix += [f"--git-dir={pin.git_dir}", f"--work-tree={pin.worktree}"]
        attr_source = attr_source or pin.base_commit
    if attr_source and attr_source_supported():
        prefix.append(f"--attr-source={attr_source}")
    limit = _default_timeout(args) if timeout is None else timeout
    try:
        result = subprocess.run(
            [git_executable(), "--no-pager", "--no-optional-locks", *_config_options(),
             *(_filter_options(cwd, prefix) if _filter_capable(args) else []), *prefix, *args],
            cwd=str(cwd),
            **({"input": stdin} if stdin is not None else {"stdin": subprocess.DEVNULL}),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=limit,
            shell=False,
            check=False,
            env=_git_environment(env, extra_env),
        )
    except subprocess.TimeoutExpired as exc:
        raise BridgeError(f"Git command timed out after {int(limit)} seconds: {' '.join(args)}") from exc
    if check and result.returncode != 0:
        raise BridgeError(f"Git command failed: {' '.join(args)}\n{result.stderr.decode('utf-8', 'replace').strip()}")
    return result


def _git_bytes(cwd: Path, args: Sequence[str], **options: Any) -> subprocess.CompletedProcess[bytes]:
    return _run_git(cwd, args, **options)


def _git(cwd: Path, args: Sequence[str], *, check: bool = True, env: dict[str, str] | None = None,
         timeout: float | None = None, stdin: bytes | None = None, extra_env: dict[str, str] | None = None,
         attr_source: str | None = None) -> subprocess.CompletedProcess[str]:
    """Run git and return decoded text (invalid UTF-8 replaced); use ``_git_bytes`` for exact content."""
    result = _run_git(cwd, args, check=check, env=env, timeout=timeout, stdin=stdin, extra_env=extra_env,
                      attr_source=attr_source)
    return subprocess.CompletedProcess(result.args, result.returncode,
                                       result.stdout.decode("utf-8", "replace"),
                                       result.stderr.decode("utf-8", "replace"))


def _git_retry(cwd: Path, args: Sequence[str], *, timeout: float | None = None) -> subprocess.CompletedProcess[str]:
    """Retry repository-lock contention during setup/cleanup, at most five attempts."""
    options = {} if timeout is None else {"timeout": timeout}
    for attempt in range(5):
        try:
            return _git(cwd, args, **options)
        except BridgeError as exc:
            message = str(exc).lower()
            if attempt == 4 or not any(term in message for term in (
                    "index.lock", ".lock': file exists", '.lock\": file exists',
                    "unable to create", "cannot lock ref")):
                raise
            time.sleep(0.5 * 2 ** attempt)
    raise AssertionError("unreachable")


def _verify_repository(task: Task) -> None:
    root = _git(task.repo_root, ["rev-parse", "--show-toplevel"]).stdout.strip()
    if Path(root).resolve() != task.repo_root:
        raise BridgeError("repo_root must be the Git top-level directory")
    requested = task.base_commit.lower()  # the contract accepts uppercase hex; Git prints lowercase
    resolved = _git(task.repo_root, ["rev-parse", "--verify", f"{requested}^{{commit}}"]).stdout.strip().lower()
    if resolved != requested:
        raise BridgeError("base_commit did not resolve to the exact requested commit")


# ---------------------------------------------------------------- pinned worktrees

@dataclass(frozen=True)
class WorktreePin:
    """What the bridge recorded when it created a worktree, and trusts instead of the worktree's ``.git``."""
    worktree: Path
    git_dir: Path
    git_file: str       # exact bytes of the worktree's ``.git`` pointer file (latin-1 decoded)
    base_commit: str
    branch: str | None = None

    def to_record(self) -> dict[str, Any]:
        return {"schema_version": 1, "worktree": str(self.worktree), "git_dir": str(self.git_dir),
                "git_file": self.git_file, "base_commit": self.base_commit, "branch": self.branch}

    @classmethod
    def from_record(cls, record: Any) -> "WorktreePin":
        try:
            if not isinstance(record, dict) or record.get("schema_version") != 1:
                raise ValueError("unsupported pin record")
            branch = record.get("branch")
            if branch is not None and not isinstance(branch, str):
                raise ValueError("invalid branch")
            values = [record[key] for key in ("worktree", "git_dir", "git_file", "base_commit")]
            if any(not isinstance(value, str) or not value for value in values):
                raise ValueError("invalid pin field")
            return cls(Path(values[0]), Path(values[1]), values[2], values[3], branch)
        except (KeyError, ValueError) as exc:
            raise BridgeError(f"worktree pin record is invalid: {exc}") from exc


_pins: dict[str, WorktreePin] = {}


def _pin_key(worktree: Path) -> str:
    return os.path.normcase(os.path.abspath(worktree))


def pin_path(worktree: Path) -> Path:
    """Where the pin of ``worktree`` lives: beside it, outside the worker-writable tree."""
    worktree = Path(worktree)
    return worktree.parent / f"{worktree.name}.pin.json"


def register_pin(pin: WorktreePin, *, persist: bool = True) -> None:
    _pins[_pin_key(pin.worktree)] = pin
    if persist:
        atomic_write_json(pin_path(pin.worktree), pin.to_record())


def forget_pin(worktree: Path) -> None:
    _pins.pop(_pin_key(worktree), None)
    pin_path(worktree).unlink(missing_ok=True)


def load_pin(worktree: Path) -> WorktreePin | None:
    """The recorded pin for ``worktree`` (memory first, then the sidecar file), or None for an unpinned one."""
    worktree = Path(worktree)
    key = _pin_key(worktree)
    pin = _pins.get(key)
    if pin is not None:
        return pin
    sidecar = pin_path(worktree)
    if not sidecar.is_file():
        return None
    try:
        pin = WorktreePin.from_record(json.loads(sidecar.read_text(encoding="utf-8")))
    except (OSError, ValueError) as exc:
        raise BridgeError(f"worktree pin file is unreadable: {sidecar}") from exc
    if _pin_key(pin.worktree) != key:
        raise BridgeError(f"worktree pin file belongs to another worktree: {sidecar}")
    _pins[key] = pin
    return pin


def verify_pin(pin: WorktreePin) -> None:
    """Raise WorktreeTampered when the worktree no longer matches its recorded identity."""
    problems = worktree_pin_problems(pin)
    if problems:
        raise WorktreeTampered("worktree identity changed: " + "; ".join(problems))


def worktree_pin_problems(pin: WorktreePin) -> list[str]:
    """Differences between the worktree and its pin (modified ``.git`` file, replaced root, missing git dir)."""
    problems: list[str] = []
    if link_kind(pin.worktree):
        problems.append("worktree root was replaced by a link")
    git_file = pin.worktree / ".git"
    try:
        if link_kind(git_file):
            problems.append(".git was replaced by a link")
        elif git_file.read_bytes().decode("latin-1") != pin.git_file:
            problems.append(".git pointer file was modified")
    except OSError:
        problems.append(".git pointer file is missing or unreadable")
    if not pin.git_dir.is_dir():
        problems.append("recorded git directory is missing")
    return problems


def worktree_integrity_problems(worktree: Path) -> list[str]:
    """Non-raising check for the bridge: pin differences, or nothing for an unpinned worktree."""
    pin = load_pin(worktree)
    return worktree_pin_problems(pin) if pin is not None else []


def create_worktree(repo_root: Path, worktree: Path, branch: str, base_commit: str, *,
                    timeout: float = GIT_HEAVY_TIMEOUT_SECONDS) -> WorktreePin:
    """Create a linked worktree on a new branch and pin its git directory.

    A failed or timed-out creation removes the partial worktree and the new branch before re-raising, so a
    retry starts clean.
    """
    repo_root, worktree = Path(repo_root), Path(worktree)
    worktree.parent.mkdir(parents=True, exist_ok=True)
    forget_pin(worktree)
    try:
        _git_retry(repo_root, ["worktree", "add", "-b", branch, str(worktree), base_commit], timeout=timeout)
        git_dir = Path(_git(worktree, ["rev-parse", "--absolute-git-dir"]).stdout.strip()).resolve()
        common = Path(_git(repo_root, ["rev-parse", "--path-format=absolute", "--git-common-dir"])
                      .stdout.strip()).resolve()
        if git_dir.parent != common / "worktrees":
            raise BridgeError("new worktree's git directory is not under the repository's worktrees directory")
        pin = WorktreePin(Path(os.path.abspath(worktree)), git_dir,
                          (worktree / ".git").read_bytes().decode("latin-1"), base_commit.lower(), branch)
        register_pin(pin)
        return pin
    except BaseException:
        try:
            remove_worktree(repo_root, worktree)
            _git(repo_root, ["branch", "-D", branch], check=False)
        except BaseException:  # noqa: BLE001 - best effort; the original error is the one to report
            pass
        raise


def pinned_branch(repo_root: Path, worktree: Path) -> str | None:
    """The branch recorded when the bridge created ``worktree``, without reading the worktree at all.

    Also checks that the pinned git directory belongs to ``repo_root``. Returns None for a worktree without
    a pin (a worktree created by 1.0.0, which recorded none), whose branch the caller must ask the worktree about.
    """
    pin = load_pin(worktree)
    if pin is None or pin.branch is None:
        return None
    common = Path(_git(repo_root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).stdout.strip()).resolve()
    if pin.git_dir.parent != common / "worktrees":
        raise BridgeError("worktree belongs to another repository")
    return pin.branch


# ---------------------------------------------------------------- links, nested repositories, safe removal

@dataclass(frozen=True)
class _Walked:
    entry: os.DirEntry
    info: os.stat_result
    kind: str | None   # link kind (see revision.link_kind_of) or None
    relative: str      # posix path below the walk root


def _long_path(path: str) -> str:
    """Windows extended-length form, so directories deeper than MAX_PATH are still readable."""
    extended = "\\\\?\\"
    if os.name != "nt" or path.startswith(extended):
        return path
    absolute = os.path.abspath(path)
    if absolute.startswith("\\\\"):
        return extended + "UNC\\" + absolute[2:]
    return extended + absolute


def _walk_entries(root: Path, unreadable: list[str] | None = None) -> Iterator[_Walked]:
    """Yield everything below ``root`` without following any link.

    The root's own ``.git`` is skipped. Directories that are links are yielded but never entered. A
    directory that cannot be listed is appended to ``unreadable`` (when given) instead of being skipped
    silently, since something may hide in it.
    """
    stack = [(_long_path(str(root)), "")]
    while stack:
        directory, prefix = stack.pop()
        try:
            entries = list(os.scandir(directory))
        except OSError:
            if unreadable is not None and prefix:
                unreadable.append(prefix)
            continue
        for entry in entries:
            if not prefix and entry.name.lower() == ".git":
                continue
            relative = f"{prefix}/{entry.name}" if prefix else entry.name
            try:
                info = entry.stat(follow_symlinks=False)
                kind = link_kind_of(info, symlink=entry.is_symlink())
                directory_like = kind is None and entry.is_dir(follow_symlinks=False)
            except OSError:
                if unreadable is not None:
                    unreadable.append(relative)
                continue
            yield _Walked(entry, info, kind, relative)
            if directory_like and entry.name.lower() != ".git":
                stack.append((entry.path, relative))


_LINK_BATCH = 50


def _tracked_links(worktree: Path, base: str, relatives: Sequence[str]) -> set[str]:
    """Which of ``relatives`` the base commit itself holds as symlinks (legitimate, pre-existing links)."""
    tracked: set[str] = set()
    for start in range(0, len(relatives), _LINK_BATCH):
        result = _git_bytes(worktree, ["ls-tree", "-z", base, "--", *relatives[start:start + _LINK_BATCH]],
                            check=False)
        if result.returncode != 0:
            continue
        for entry in result.stdout.split(b"\0"):
            meta, _, name = entry.partition(b"\t")
            if meta.startswith(b"120000 "):
                tracked.add(name.decode("utf-8", "replace"))
    return tracked


def scan_worktree(worktree: Path, base_commit: str | None = None) -> list[dict[str, str]]:
    """Find what must never be followed or snapshotted inside a worktree, without following any link.

    Findings are ``{"kind", "path"}`` with kind ``symlink``, ``junction``, ``reparse_point`` (any other
    Windows reparse point), ``nested_git`` (the path is the directory holding a nested ``.git`` file or
    directory, i.e. a nested repository or gitlink) or ``unreadable`` (a directory that cannot be listed).
    Not findings: a symlink that ``base_commit`` itself tracks as a symlink, and anything Git ignores
    (``node_modules`` links, vendored clones in an ignored directory), because ``add -A`` and
    ``ls-files --others`` never enter ignored paths. The worktree's own ``.git`` pointer is covered by
    ``worktree_integrity_problems``, not by this scan.
    """
    root = Path(worktree)
    found: list[dict[str, str]] = []
    base = base_commit
    if base is None:
        pin = load_pin(root)
        base = pin.base_commit if pin is not None else None
    unreadable: list[str] = []
    links: list[dict[str, str]] = []
    for item in _walk_entries(root, unreadable):
        if item.kind is not None:
            links.append({"kind": item.kind, "path": item.relative})
        elif item.entry.name.lower() == ".git":
            found.append({"kind": "nested_git", "path": Path(item.relative).parent.as_posix()})
    symlinks = [item["path"] for item in links if item["kind"] == "symlink"]
    tracked = _tracked_links(root, base, symlinks) if base is not None and symlinks else set()
    found.extend(item for item in links if item["path"] not in tracked)
    found.extend({"kind": "unreadable", "path": path} for path in unreadable)
    if found:
        ignored = ignored_among(root, sorted({item["path"] for item in found}))
        found = [item for item in found if item["path"] not in ignored]
    return sorted(found, key=lambda item: item["path"])


def describe_findings(findings: Sequence[dict[str, str]], limit: int = 10) -> list[str]:
    shown = [f"{item['kind']}: {item['path']}" for item in findings[:limit]]
    if len(findings) > limit:
        shown.append(f"... and {len(findings) - limit} more")
    return shown


def worktree_hazards(worktree: Path, base_commit: str | None = None) -> list[str]:
    """Human-readable hazards of a worktree for the bridge's failure list (empty when clean)."""
    problems = worktree_integrity_problems(worktree)
    if problems:
        return problems  # a tampered worktree is not scanned: every git call into it would be refused
    return describe_findings(scan_worktree(worktree, base_commit))


def _is_linked_worktree(worktree: Path) -> bool:
    return load_pin(worktree) is not None or (Path(worktree) / ".git").is_file()


MAX_EXCLUDED_PATHS = 200


def _guard(worktree: Path, base: str) -> tuple[list[dict[str, str]], list[str]]:
    """Scan a linked worktree and return (findings, pathspecs that keep git away from them).

    Git for Windows follows junctions, so ``ls-files --others``/``add -A`` would read a link target's
    content as worktree content. Each finding is excluded from those walks instead of being followed.
    Without ``--attr-source`` support a worker-changed ``.gitattributes`` cannot be neutralised, so it is
    refused outright.
    """
    if not _is_linked_worktree(worktree):
        return [], []
    findings = scan_worktree(worktree, base)
    if len(findings) > MAX_EXCLUDED_PATHS:
        raise UnsafeWorktree(f"worktree holds {len(findings)} links or nested repositories", findings)
    if not attr_source_supported():
        for path in _attribute_files(worktree):
            baseline = _git_bytes(worktree, ["cat-file", "blob", f"{base}:{path}"], check=False)
            if baseline.returncode != 0 or baseline.stdout != (Path(worktree) / path).read_bytes():
                raise UnsafeWorktree(f"{path} differs from the base commit and this Git is too old (<2.40) to "
                                     "ignore worker-written attributes", [{"kind": "gitattributes", "path": path}])
    return findings, [f":(exclude,literal){item['path']}" for item in findings]


def _attribute_files(worktree: Path) -> list[str]:
    found = []
    for item in _walk_entries(Path(worktree)):
        if item.kind is None and item.entry.name == ".gitattributes" and item.entry.is_file(follow_symlinks=False):
            found.append(item.relative)
    return sorted(found)


def neutralize_links(worktree: Path) -> list[str]:
    """Remove every symlink, junction and reparse point below ``worktree`` without touching what it points at.

    Removal uses rmdir/unlink on the link itself and never descends into one, so the target's content is
    safe. Returns the relative paths removed.
    """
    root = Path(worktree)
    removed: list[str] = []
    for item in _walk_entries(root):
        if item.kind is None:
            continue
        try:
            if is_directory_link(item.info):
                os.rmdir(item.entry.path)
            else:
                os.unlink(item.entry.path)
            removed.append(item.relative)
        except OSError:
            pass
    return removed


def _restore_git_pointer(worktree: Path) -> None:
    """Rewrite a worker-modified ``.git`` pointer to the recorded text, which ``git worktree remove`` validates."""
    pin = load_pin(worktree)
    if pin is None or not worktree_pin_problems(pin):
        return
    pointer = Path(worktree) / ".git"
    try:
        if os.path.lexists(pointer):
            if link_kind(pointer) and is_directory_link(os.lstat(pointer)):
                os.rmdir(pointer)
            elif pointer.is_dir() and not link_kind(pointer):
                shutil.rmtree(pointer, ignore_errors=True)
            else:
                pointer.unlink()
        pointer.write_bytes(pin.git_file.encode("latin-1"))
    except OSError:
        pass  # git's own error then explains why the worktree cannot be removed


def remove_worktree(repo_root: Path, worktree: Path, *, timeout: float = GIT_HEAVY_TIMEOUT_SECONDS) -> list[str]:
    """Delete a linked worktree so that nothing outside it can be deleted, and forget its pin.

    ``git worktree remove --force`` can follow a junction into its target and empty it, so every link is
    removed first (never entered). A missing worktree directory is pruned instead of failing. Returns the
    link paths that were removed.
    """
    repo_root, worktree = Path(repo_root), Path(worktree)
    removed: list[str] = []
    if os.path.lexists(worktree):
        info = os.lstat(worktree)
        if link_kind_of(info, symlink=worktree.is_symlink()) is not None:
            # The worktree root itself was swapped for a link: drop the link, never its target.
            (os.rmdir if is_directory_link(info) else os.unlink)(worktree)
            removed.append(".")
        else:
            removed += neutralize_links(worktree)
            _restore_git_pointer(worktree)
    if os.path.lexists(worktree):
        _git_retry(repo_root, ["worktree", "remove", "--force", str(worktree)], timeout=timeout)
    else:
        _git_retry(repo_root, ["worktree", "prune"], timeout=timeout)
    forget_pin(worktree)
    return removed


# ---------------------------------------------------------------- changed paths, snapshots, diffs

def _split_paths(data: bytes) -> list[str]:
    return [item.decode("utf-8", "replace") for item in data.split(b"\0") if item]


_DIFF_FORMAT = ["--no-color", "--no-ext-diff", "--no-textconv", "--no-renames", "--ignore-submodules=none",
                "--src-prefix=a/", "--dst-prefix=b/"]
_PATCH_FORMAT = [*_DIFF_FORMAT, "--unified=3", "--inter-hunk-context=0"]  # only for real patch output


def changed_paths(worktree: Path, base_commit: str) -> list[str]:
    _, excluded = _guard(worktree, base_commit)
    # --no-renames reports both the source and the destination of a move, so the allowlist sees each.
    tracked = _split_paths(_git_bytes(worktree, ["diff", *_DIFF_FORMAT, "--name-only", "-z", base_commit, "--"],
                                      attr_source=base_commit).stdout)
    untracked = _split_paths(_git_bytes(worktree, ["ls-files", "--others", "--exclude-standard", "-z", "--", ".",
                                                   *excluded]).stdout)
    return sorted({path.replace("\\", "/") for path in (*tracked, *untracked) if path})


def special_entries(repository: Path, base: str, tree: str) -> list[dict[str, str]]:
    """Symlink (120000) and gitlink (160000) entries that ``tree`` adds or changes relative to ``base``."""
    data = _git_bytes(repository, ["diff-tree", "-r", "-z", "--raw", "--no-renames", "--no-ext-diff", base, tree]).stdout
    fields = data.split(b"\0")
    found: list[dict[str, str]] = []
    index = 0
    while index + 1 < len(fields):
        meta = fields[index].decode("ascii", "replace").split()
        path = fields[index + 1].decode("utf-8", "replace")
        index += 2
        if len(meta) >= 2 and meta[1] in ("120000", "160000"):
            found.append({"kind": "gitlink" if meta[1] == "160000" else "symlink", "path": path})
    return found


def snapshot_tree(worktree: Path, *, reject_special: bool = True) -> str:
    """Return the tree of the worktree's current content, normalized through Git's clean filters.

    The tree is built in a private temporary index (never the worktree's own), starting from the base commit so
    stale stat data cannot skip re-cleaning; the worktree's real index is not touched, so a kill mid-way leaves
    nothing to restore. Links and nested repositories are excluded from the walk, attributes come from the base
    commit, and, unless ``reject_special`` is false, a tree that adds or changes a symlink or gitlink raises
    UnsafeWorktree.
    """
    pin = load_pin(worktree)
    base = pin.base_commit if pin is not None else _git(worktree, ["rev-parse", "HEAD"]).stdout.strip()
    _, excluded = _guard(worktree, base)
    git_dir = pin.git_dir if pin is not None else Path(
        _git(worktree, ["rev-parse", "--absolute-git-dir"]).stdout.strip())
    index = git_dir / f"delegate-snapshot-{os.getpid()}-{uuid.uuid4().hex[:10]}.index"
    environment = {"GIT_INDEX_FILE": str(index)}
    try:
        _git(worktree, ["read-tree", base], extra_env=environment, attr_source=base)
        _git(worktree, ["add", "-A", "--", ".", *excluded], extra_env=environment, attr_source=base)
        tree = _git(worktree, ["write-tree"], extra_env=environment, attr_source=base).stdout.strip()
    finally:
        index.unlink(missing_ok=True)
        index.with_name(index.name + ".lock").unlink(missing_ok=True)
    if reject_special:
        bad = special_entries(worktree, base, tree)
        if bad:
            raise UnsafeWorktree("worktree adds or changes symlinks or gitlinks: "
                                 + ", ".join(describe_findings(bad)), bad)
    return tree


def tree_diff(repository: Path, before: str, after: str, files: Sequence[str] = ()) -> bytes:
    """The exact patch between two trees as bytes (CRLF, lone CR and non-UTF-8 content survive).

    The format is pinned (a/ b/ prefixes, no colour, no external diff, full object ids) so user or worker
    configuration cannot change it; callers store, compare and apply these bytes unchanged.
    """
    return _git_bytes(repository, ["diff", "--binary", "--full-index", *_PATCH_FORMAT, before, after, "--",
                                   *(f":(literal){p}" for p in files)]).stdout


def tree_diffstat(repository: Path, before: str, after: str) -> dict[str, Any]:
    """Human-facing summary of a tree diff (text is decoded with replacement, never used to apply)."""
    args = ["diff", *_DIFF_FORMAT, before, after]
    stat = _git(repository, [*args, "--stat", "--stat-width=100", "--"]).stdout.rstrip()
    fields = _git(repository, [*args, "--numstat", "-z", "--"]).stdout.split("\0")
    files = []
    for field in fields:
        if field:
            added, removed, path = field.split("\t", 2)
            files.append({"path": path, "added": int(added) if added != "-" else None,
                          "removed": int(removed) if removed != "-" else None})
    return {"stat": stat, "files": files}


def apply_patch(repository: Path, patch: bytes, *, check_only: bool = False, three_way: bool = False,
                reverse: bool = False, raise_on_error: bool = True) -> subprocess.CompletedProcess[str]:
    """Apply (or only check) exactly these patch bytes, fed on stdin so there is one read of the patch.

    -p1 and --whitespace=nowarn make the result independent of apply.* configuration.
    """
    args = ["apply", "-p1", "--whitespace=nowarn"]
    if three_way:
        args.append("--3way")
    if reverse:
        args.append("--reverse")
    if check_only:
        args.append("--check")
    args.append("-")
    result = _run_git(repository, args, check=False, stdin=patch)
    text = subprocess.CompletedProcess(result.args, result.returncode, result.stdout.decode("utf-8", "replace"),
                                       result.stderr.decode("utf-8", "replace"))
    if raise_on_error and result.returncode != 0:
        raise BridgeError(f"Git command failed: {' '.join(args)}\n{text.stderr.strip()}")
    return text


# ---------------------------------------------------------------- batched queries

_BATCH_SIZE = 200


def tracked_among(repository: Path, relatives: Sequence[str]) -> set[str]:
    """Which of ``relatives`` (files or directories) are tracked or contain tracked files, in few git calls."""
    tracked: set[str] = set()
    remaining = list(relatives)
    for start in range(0, len(remaining), _BATCH_SIZE):
        chunk = remaining[start:start + _BATCH_SIZE]
        found = _split_paths(_git_bytes(repository, ["ls-files", "-z", "--", *(f":(literal){p}" for p in chunk)]).stdout)
        for relative in chunk:
            if any(path == relative or path.startswith(relative.rstrip("/") + "/") for path in found):
                tracked.add(relative)
    return tracked


def ignored_among(repository: Path, relatives: Sequence[str]) -> set[str]:
    """Which of ``relatives`` git reports as ignored, with one ``check-ignore --stdin`` call."""
    if not relatives:
        return set()
    result = _git_bytes(repository, ["check-ignore", "-z", "--stdin"], check=False,
                        stdin=b"".join(item.encode("utf-8") + b"\0" for item in relatives))
    if result.returncode not in (0, 1):
        raise BridgeError("Git command failed: check-ignore\n" + result.stderr.decode("utf-8", "replace").strip())
    return set(_split_paths(result.stdout))


def _hash_paths(worktree: Path, paths: Sequence[str], base_commit: str) -> dict[str, str]:
    """Object id (clean filters from the base attributes applied) of each path; "<deleted>" when absent."""
    hashes: dict[str, str] = {}
    present: list[str] = []
    for path in paths:
        target = Path(worktree) / path
        if os.path.lexists(target) and (target.is_symlink() or target.is_file()):
            present.append(path)
        else:
            hashes[path] = "<deleted>"
    batchable = [p for p in present if "\n" not in p and "\r" not in p and not p.startswith('"')]
    batched = set(batchable)
    single = [p for p in present if p not in batched]
    if batchable:
        result = _git_bytes(worktree, ["hash-object", "--stdin-paths"], check=False, attr_source=base_commit,
                            stdin="".join(p + "\n" for p in batchable).encode("utf-8"))
        lines = result.stdout.decode("ascii", "replace").split("\n")
        if result.returncode == 0 and len([line for line in lines if line]) == len(batchable):
            hashes.update(zip(batchable, (line.strip() for line in lines if line)))
        else:
            single = list(present)  # an unreadable file spoils the batch: ask one by one
    for path in single:
        one = _git(worktree, ["hash-object", "--", path], check=False, attr_source=base_commit)
        hashes[path] = one.stdout.strip() if one.returncode == 0 else "<deleted>"
    return hashes


def _worktree_fingerprint(worktree: Path, base_commit: str) -> str:
    digest = hashlib.sha256()
    paths = changed_paths(worktree, base_commit)
    hashes = _hash_paths(worktree, paths, base_commit)
    for path in paths:
        digest.update(path.encode("utf-8") + b"\0")
        digest.update(hashes[path].encode())
    return digest.hexdigest()


path_allowed = path_within_scope  # the task contract's scope rule has one definition (revision.py)


FINGERPRINT_PREFIX = "FP "  # not a porcelain status code, so it cannot collide with a status line
_FINGERPRINT_PATH_OFFSET = len(FINGERPRINT_PREFIX) + 64 + 1  # prefix, sha256 hex, one space


def _content_digest(path: Path) -> str:
    """Hash what a dirty path currently holds; a link hashes its target, a missing path is dashes."""
    try:
        if path.is_symlink():
            return hashlib.sha256(b"link\0" + os.readlink(path).encode("utf-8", "surrogateescape")).hexdigest()
        if not path.is_file():
            return "-" * 64
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1 << 20), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except OSError:
        return "?" * 64


def primary_status(task: Task) -> str:
    """Porcelain status plus a content fingerprint per dirty path.

    Status lines alone cannot see an already-dirty file whose bytes change while its status code stays
    the same, so each dirty path also gets an ``FP <sha256> <json path>`` line. ``status_line_paths``
    and ``primary_status_changes`` understand both kinds of line. Git runs with ``--no-optional-locks`` so
    the bridge never takes ``index.lock`` in the lead's checkout just to refresh stat data.
    """
    status = _git(task.repo_root, ["status", "--porcelain=v1", "--no-renames", "--untracked-files=all"]).stdout
    paths = sorted({path for line in status.split("\n") for path in status_line_paths(line)})
    lines = [f"{FINGERPRINT_PREFIX}{_content_digest(task.repo_root / path)} {json.dumps(path)}\n"
             for path in paths]
    return status + "".join(lines)


def _unquote_git_path(raw: str) -> str:
    if not raw.startswith('"'):
        return raw
    # Git quotes UTF-8 bytes with octal escapes, which JSON decoding does not support.
    escapes = {"a": b"\a", "b": b"\b", "t": b"\t", "n": b"\n", "v": b"\v",
               "f": b"\f", "r": b"\r", '"': b'"', "\\": b"\\"}
    parts = re.split(r'(\\[0-7]{3}|\\.)', raw[1:-1])
    data = b"".join((bytes([int(part[1:], 8)]) if re.fullmatch(r'\\[0-7]{3}', part)
                     else escapes[part[1:]]) if part.startswith("\\") else part.encode("utf-8")
                    for part in parts)
    return data.decode("utf-8", errors="replace")


def status_line_paths(line: str) -> list[str]:
    """Parse porcelain v1, preserving spaces and both sides of a rename/copy.

    Also accepts the content-fingerprint lines that ``primary_status`` appends.
    """
    if line.startswith(FINGERPRINT_PREFIX):
        try:
            return [json.loads(line[_FINGERPRINT_PATH_OFFSET:])]
        except json.JSONDecodeError:
            return []
    raw = line[3:]
    if "R" in line[:2] or "C" in line[:2]:
        quoted = escaped = False
        for index, char in enumerate(raw):
            if escaped:
                escaped = False
            elif quoted and char == "\\":
                escaped = True
            elif char == '"':
                quoted = not quoted
            elif not quoted and raw.startswith(" -> ", index):
                return [_unquote_git_path(raw[:index]), _unquote_git_path(raw[index + 4:])]
    return [_unquote_git_path(raw)] if raw else []


def primary_status_changes(before: str, after: str) -> list[str]:
    """Include added, removed and changed status entries and changed contents; ignore unchanged dirty paths."""
    # Only "\n" ends a line: a path may hold other line-break characters (U+2028, U+0085).
    lines = set(before.split("\n")) ^ set(after.split("\n"))
    return sorted({path for line in lines for path in status_line_paths(line)})


# ---------------------------------------------------------------- task locks

def _active_lock_path(artifact_root: Path, task_id: str) -> Path:
    validate_task_id(task_id)
    return artifact_root / ".active" / f"{task_id}.json"


def process_start_token(pid: Any) -> str | None:
    """An opaque token for when process ``pid`` started; None when it cannot be read.

    A lock stores its owner's token, so a recycled process id (another process now holds the number) is
    told apart from the owner. Windows: the process creation time; Linux: the start time in clock ticks;
    elsewhere None (the process id alone is trusted, as for a lock written by version 1.0.0).
    """
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return None
    try:
        if os.name == "nt":
            import ctypes
            from ctypes import wintypes

            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
            kernel32.OpenProcess.restype = wintypes.HANDLE
            kernel32.GetProcessTimes.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
            kernel32.GetProcessTimes.restype = wintypes.BOOL
            kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
            handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
            if not handle:
                return None
            try:
                created, exited, kernel_time, user_time = (wintypes.FILETIME() for _ in range(4))
                if not kernel32.GetProcessTimes(handle, ctypes.byref(created), ctypes.byref(exited),
                                                ctypes.byref(kernel_time), ctypes.byref(user_time)):
                    return None
                return str((created.dwHighDateTime << 32) | created.dwLowDateTime)
            finally:
                kernel32.CloseHandle(handle)
        proc_stat = Path(f"/proc/{pid}/stat")
        if proc_stat.is_file():
            # The command name is in parentheses and may hold spaces: count fields after the last ")".
            return proc_stat.read_text(encoding="utf-8", errors="replace").rsplit(")", 1)[1].split()[19]
        return None
    except (OSError, ValueError, IndexError):
        return None


def pid_is_running(pid: Any, started: str | None = None) -> bool:
    """Whether ``pid`` is alive; with ``started`` (the owner's token), whether that same process is."""
    if not _pid_alive(pid):
        return False
    if started:
        current = process_start_token(pid)
        if current is not None and current != started:
            return False  # the number now belongs to a different process
    return True


def _pid_alive(pid: Any) -> bool:
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return False
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel32.GetExitCodeProcess.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return ctypes.get_last_error() == 5  # access denied still proves the process exists
        try:
            code = wintypes.DWORD()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                return True  # refuse destructive recovery when state cannot be proven
            return code.value == 259
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


@contextmanager
def task_lock(artifact_root: Path, task: Task, task_file: Path, operation: str) -> Iterator[Path]:
    (artifact_root / ".active").mkdir(parents=True, exist_ok=True)
    lock = _active_lock_path(artifact_root, task.task_id)
    record = {
        "task_id": task.task_id, "status": "RUNNING", "operation": operation, "pid": os.getpid(),
        "process_started": process_start_token(os.getpid()), "started_at": utc_now(), "timeout_seconds": task.timeout_seconds,
        "task_file": str(Path(task_file).resolve(strict=True)),
    }
    text = json.dumps(record, indent=2) + "\n"  # serialize first so the claim is written in one call
    try:
        with lock.open("x", encoding="utf-8") as handle:
            try:
                handle.write(text)
            except BaseException:
                handle.close()
                lock.unlink(missing_ok=True)  # never strand a half-written claim
                raise
    except FileExistsError as exc:
        raise BridgeError(
            f"task {task.task_id!r} already has an active run; wait for that process instead of starting another"
        ) from exc
    try:
        yield lock
    finally:
        # Remove only the claim this process wrote: clear-stale-lock may have archived it and another process
        # may since have taken a new one, which must not be deleted.
        try:
            if lock.read_text(encoding="utf-8") == text:
                lock.unlink(missing_ok=True)
        except OSError:
            pass


def active_task_record(artifact_root: Path, task_id: str) -> dict[str, Any]:
    lock = _active_lock_path(artifact_root, task_id)
    if not lock.exists():
        return {"task_id": task_id, "status": "NOT_RUNNING", "lock_path": str(lock)}
    try:
        record = json.loads(lock.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BridgeError(f"active-task lock is invalid: {lock}") from exc
    if not isinstance(record, dict) or record.get("task_id") != task_id:
        raise BridgeError(f"active-task lock does not match task {task_id!r}")
    return {**record, "process_running": pid_is_running(record.get("pid"), record.get("process_started")),
            "lock_path": str(lock)}


INCOMPLETE_LOCK_SECONDS = 30.0  # an unparsable claim this old was abandoned mid-write, not being written


def _archive_incomplete_lock(artifact_root: Path, task_id: str) -> dict[str, Any] | None:
    """Archive a claim file that cannot be parsed and is old enough that its writer must have died."""
    lock = _active_lock_path(artifact_root, task_id)
    age = 0.0  # unknown (the file cannot be inspected): treated as fresh, so nothing is archived
    try:
        age = time.time() - lock.stat().st_mtime
        if isinstance(json.loads(lock.read_text(encoding="utf-8")), dict):
            return None
    except FileNotFoundError:
        return None
    except (OSError, ValueError):
        if age < INCOMPLETE_LOCK_SECONDS:
            return None
    stale = artifact_root / ".stale-locks"
    stale.mkdir(parents=True, exist_ok=True)
    destination = stale / f"{task_id}-{utc_stamp()}.json"
    lock.replace(destination)
    return {"task_id": task_id, "status": "STALE_LOCK_ARCHIVED", "archived_lock": str(destination),
            "previous": {"task_id": task_id, "status": "INCOMPLETE_CLAIM"}}


def clear_stale_task_lock(artifact_root: Path, task_id: str) -> dict[str, Any]:
    archived = _archive_incomplete_lock(artifact_root, task_id)
    if archived is not None:
        return archived
    record = active_task_record(artifact_root, task_id)
    if record.get("status") == "NOT_RUNNING":
        return record
    if record.get("process_running") is True:
        raise BridgeError(f"task {task_id!r} still has a running owner process")
    lock = Path(record["lock_path"]).resolve(strict=True)
    if lock.parent != (artifact_root / ".active").resolve(strict=True):
        raise BridgeError("active-task lock is outside the configured lock directory")
    stale = artifact_root / ".stale-locks"
    stale.mkdir(parents=True, exist_ok=True)
    destination = stale / f"{task_id}-{utc_stamp()}.json"
    lock.replace(destination)
    return {"task_id": task_id, "status": "STALE_LOCK_ARCHIVED", "archived_lock": str(destination), "previous": record}

---
name: berth
description: Manage independent local agent workspaces, explicit native/container runtimes, managed processes and safe cleanup. Use for parallel task worktrees, port allocation, starting or inspecting task services, running tests inside a workspace, or reclaiming workspace state.
---

# berth

berth gives each task its own Git worktree, private data directory, reserved ports
and supervised processes, so parallel agents stop colliding. It is a workspace
manager, not an adversarial security sandbox and not a Git replacement. Replace
berth lifecycle operations only with berth commands — raw `rm -rf`, `git worktree
remove` and guessed PID/port cleanup corrupt the registry instead of releasing a
workspace.

## Onboard

Read the project's startup scripts, toolchains, storage paths and listen ports
before writing configuration, then choose the runtime deliberately:

- `native` (default) for programs that accept a port and a data path through
  configuration or flags. Fastest, no container overhead.
- `container` for unchanged hardcoded listen ports or a uniform Linux
  environment. It needs an existing `runtime.image` plus a `listen.<port>` entry
  per declared port.

Commit `berth.yaml` before creating a workspace: each workspace loads the
configuration from its own branch, so uncommitted edits never reach a workspace
created from it. When the container engine or the prepared image is missing,
report it and stop — the service runs on the host only when the configuration
says `native`.

Keep mutable state in `$BERTH_DATA_DIR` (`<workspace>/.berth/data`). `copy_dirs`
copies writable dependency trees with CoW where the filesystem supports it and an
independent copy otherwise.

## Execute

| Command | Purpose |
| --- | --- |
| `berth new <slug> [--base <ref>] [--up] [--print-path] [--json]` | Create a workspace and its branch-local setup; `--up` also starts processes |
| `berth ls [--json]` | List workspaces with their phase, running state and ports |
| `berth status [<slug>] [--json]` | Processes, readiness and ports of a workspace |
| `berth ports [<slug>] [--json]` | Allocated host ports and container listen mappings |
| `berth plan [<slug>]` | Print the execution contract as JSON without starting anything |
| `berth up [<slug>]` / `berth down [<slug>]` | Start / stop workspace processes, preserving data |
| `berth logs <proc> [<slug>]` | Logs of one managed process |
| `berth run [--] <cmd> [args...]` | Run one command inside the workspace runtime and environment |
| `berth attach [<slug>] [--json]` | Print path, branch and shell exports for the workspace |
| `berth open [<port-name>]` | Open a workspace port's host URL in the browser |
| `berth reset [<slug>]` | Wipe `$BERTH_DATA_DIR` and rerun setup |
| `berth done [<slug>]` | Tear a workspace down once its work is preserved |
| `berth gc [--dry-run] [--json]` | Reclaim vanished, idle, merged or excess workspaces |
| `berth doctor [--fix] [--json]` | Check git, engine, image, process-compose and state |

### Where a workspace is

- Path: `<repo>.berths/<slug>` beside the repository by default, or
  `<worktree_root>/<slug>` when `worktree_root` is set. Branch: `berth/<slug>`.
- Slug rules: lowercase ASCII letters, digits, `-` and `_` only, no slashes.
- The primary checkout is never a workspace (`berth adopt` refuses it). `berth run`
  and `berth open` accept no slug, so they resolve the workspace from the current
  directory; commands that do take `[<slug>]` also work from anywhere with an
  unambiguous slug. Run slug-less commands from inside the path `berth new`
  printed (its last stdout line, or `path` in `--json`).

`berth run` joins the same runtime and environment as services and hooks, passes
argv verbatim without reparsing, and propagates the exit code. Request a shell
explicitly: `berth run -- sh -c '<script>'` (Linux/container) or the matching
native shell on Windows, since a script that works in `sh` need not work in
Windows `cmd`. Cancelling a container `berth run` stops that workspace's runtime,
including its sibling services.

### Environment contract

- `BERTH_PORT_<NAME>` is the port inside the execution context;
  `BERTH_HOST_PORT_<NAME>` is the host publication to hand to browsers and other
  host tools. Container publications are TCP over IPv4 loopback.
- `plan.gateway_ports` are internal forwarder reservations; application listeners
  must not use those values, and undeclared internal ports are isolated but not
  published.
- Identity: `BERTH_WORKSPACE`, `BERTH_ROOT`, `BERTH_DATA_DIR`, `BERTH_SLUG`,
  `BERTH_BRANCH`, plus `GIT_DIR`, `GIT_WORK_TREE`, `HOME` and `XDG_CACHE_HOME`
  inside a container.
- On Windows with `native` and a non-empty `processes:`, `berth ports` also lists a
  `pc` port: the supervisor control port, not an application port.
- Read readiness from `berth status --json` (`ready`, `healthy`) instead of sleep
  loops, and failures from `berth logs <proc>`.

## Configure

Write `berth.yaml` from the project's own startup commands. A minimal native
service:

```yaml
version: 1
base: main
ports: [web]
processes:
  web:
    command: npm run dev -- --port "$BERTH_PORT_WEB"
    readiness_probe:
      http_get: {host: 127.0.0.1, port: "${BERTH_PORT_WEB}", path: /}
```

Read `references/berth-yaml.md` before writing or debugging a `berth.yaml`: it
carries the full field list, the container recipe, and the traps that make a
render fail.

## Harnesses

berth is driven from the shell, so any harness that can run commands can use it.
berth's own installer writes this same file to `.agents/skills/berth/`, which
Cursor, Codex, pi and Antigravity read. A harness may hand you a Git worktree
berth does not know about; give it a berth workspace rather than improvising — `berth adopt --setup`
inside it when it is on a branch, `berth new <slug>` when it is detached or when
the task needs its own ports and data.

## Cleanup and recovery

`berth done` requires preserved commits (merged or present upstream) and a clean
worktree for berth-owned checkouts. `--force` cannot bypass ownership, identity,
primary-worktree or shutdown checks. `adopt` is only for linked worktrees, and
`berth done` on an adopted checkout stops and unregisters its runtime while
preserving checkout, data and branch even with `--force`. `down` preserves data;
`reset` wipes it deliberately and only after a verified shutdown. Automatic GC
never forces, and an unknown process or engine state means preserve the data and
inspect the logs.

Read `references/recovery.md` when a berth command fails: error → meaning →
action, plus what `berth gc` collects and when it refuses.

# berth.yaml reference

Read this when writing or debugging a `berth.yaml`. The file lives at the
repository root and is read from each workspace's own branch, so commit it before
creating a workspace.

## Fields

| Field | Notes |
| --- | --- |
| `version` | Must be `1`. |
| `base` | Baseline branch for new workspaces; defaults to `main`. |
| `worktree_root` | Where worktrees are created. Relative values resolve inside the repository, absolute values do not; the default is the sibling `<repo>.berths` directory. |
| `runtime.backend` | `native` or `container`; defaults to `native`. |
| `runtime.engine` | `docker` or `podman`; container only, defaults to `docker`. |
| `runtime.image` | Prebuilt Linux image; container only and mandatory. |
| `runtime.user`, `runtime.memory`, `runtime.cpus` | Optional container overrides, e.g. `2g`, `2`. Native mode rejects them. |
| `ports` | Named ports such as `[web, pg]`. Port names become `BERTH_PORT_<NAME>`; the name `pc` is reserved. |
| `listen` | Container listen port per declared port, e.g. `{web: 8080}`; every declared port needs one. |
| `env` | Extra variables for every process, hook and `berth run`. Keys may not start with `BERTH_`; `GIT_DIR` and `GIT_WORK_TREE` are reserved. Values stay single-line; `${VAR}` and `$VAR` expand from the environment contract. |
| `env_file` | Repository-relative file berth writes with a managed `# BEGIN BERTH`/`# END BERTH` block, for host tools that read dotenv files. |
| `copy_dirs` | Repository-relative directories copied into each new workspace. |
| `hooks.setup`, `hooks.teardown` | Shell commands run in the workspace runtime. `setup` runs on create, on `up` after a failed setup, and on `reset`, and must be idempotent; `teardown` runs before an owned workspace is removed. |
| `processes.<name>.command` | Required for a managed process. |
| `processes.<name>.working_dir` | Defaults to the workspace root (`/workspace` in container mode). |
| `processes.<name>.environment` | A **list** of `KEY=VALUE` strings, not a mapping. berth prepends its own identity variables and refuses `BERTH_*` and `GIT_*` overrides. |
| `processes.<name>.readiness_probe` | `http_get` (`host`, `port`, `path`) or `exec` (`command`), with `initial_delay_seconds`, `period_seconds`, `failure_threshold`. |
| `processes.<name>.*` | The mapping is passed through to process-compose v0.5, so its other documented fields (`log_location`, `depends_on`, `restart`, …) work too. |
| `gc.idle_stop_hours` | `berth gc` stops the runtime of a workspace unused for this long. `0` disables. |
| `gc.remove_after_days` | Age beyond which a stopped, merged workspace becomes a removal candidate. `0` disables. |
| `gc.max_workspaces` | Per-repository quota; `berth gc` evicts above it once commits are preserved. `0` disables. |

## Traps

- **`environment` is a list, not a mapping.** `environment: {KEY: value}` fails
  the render with "must be a list". Write `environment: ["KEY=value"]`.
- **The contract is immutable.** Changing `runtime.*` or the named-port set makes
  the existing workspace unusable ("port contract changed; create a new
  workspace"); create a new workspace instead of editing in place.
- **Reserved names.** `pc` cannot be a port name, and `env` keys cannot start with
  `BERTH_`, `GIT_DIR` or `GIT_WORK_TREE` — berth injects those into every process.
- **Ports in probes.** A probe runs in the execution context, so a container
  probe uses the internal `listen` port (`8080`), never `BERTH_HOST_PORT_*`.
- **`copy_dirs` and `.worktreeinclude` differ.** `copy_dirs` copies whole
  dependency trees with CoW where supported; `.worktreeinclude` copies individual
  files, and it is a plain path list (one repository-relative path per line, `#`
  for comments, missing entries skipped), not a `.gitignore` pattern file. Both
  run during setup: `berth new`, `berth reset`, `berth adopt --setup`.
- **`.berth/` is machine state.** It holds the private data directory, generated
  `pc.yaml`, the supervisor log and the identity marker. Keep it out of version
  control and never hand-edit it.

## Container mode

`runtime.backend: container` needs an existing Linux image and a `listen` entry
for every declared port. The image must contain the project toolchain plus bash,
sh, sleep, socat, git, python3 and process-compose v1.122.0; `runtime/Dockerfile`
in the berth repository is the reference, and takes `BASE_IMAGE` as a build arg.
Build dependencies into the image once rather than on every run.

Container-internal Git metadata (`GIT_DIR`, `GIT_WORK_TREE`) is provided; the
workspace is mounted at `/workspace` and `$BERTH_DATA_DIR` is
`/workspace/.berth/data`. Publications are TCP over IPv4 loopback, and
`plan.gateway_ports` are internal forwarder reservations that application
listeners must not use.

## Example: native web app with a Postgres dependency

```yaml
version: 1
base: main
ports: [web, pg]
env:
  DATABASE_URL: postgres://127.0.0.1:${BERTH_PORT_PG}/app
hooks:
  setup:
    - mkdir -p "$BERTH_DATA_DIR/pg"
    - test -d "$BERTH_DATA_DIR/pg/base" || initdb -D "$BERTH_DATA_DIR/pg" --no-locale --encoding=UTF8
processes:
  pg:
    command: postgres -D "$BERTH_DATA_DIR/pg" -p "$BERTH_PORT_PG" -k "$BERTH_DATA_DIR"
    readiness_probe:
      exec:
        command: pg_isready -h 127.0.0.1 -p "$BERTH_PORT_PG"
  web:
    command: npm run dev -- --port "$BERTH_PORT_WEB"
    readiness_probe:
      http_get: {host: 127.0.0.1, port: "${BERTH_PORT_WEB}", path: /}
```

## Example: container with a fixed listen port

```yaml
version: 1
base: main
runtime:
  backend: container
  engine: docker
  image: berth-runtime:local
ports: [web]
listen:
  web: 8080
processes:
  web:
    command: python3 -m http.server 8080 --bind 127.0.0.1
    readiness_probe:
      http_get: {host: 127.0.0.1, port: 8080, path: /}
```

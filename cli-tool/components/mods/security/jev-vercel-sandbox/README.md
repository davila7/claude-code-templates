# jev-vercel-sandbox

A [Vercel Sandbox](https://vercel.com/docs/sandbox) that Claude sends work to on purpose: a long test run that goes on in the background while Claude keeps working, someone else's repository, an installer of unknown origin, a bulk change you want to preview before it touches your files, a build from a clean checkout. The sandbox is an isolated Linux microVM (Firecracker); nothing a job does there reaches your disk unless you apply its patch yourself.

Whether a command may run on your machine at all is not this mod's call: auto mode and [`jev-guardrails`](../jev-guardrails) / [`jev-auto-mode`](../jev-auto-mode) decide that. This one only moves the jobs a sandbox is good for.

## How a job gets to the sandbox

**Jev spots it.** Every Bash command Claude is about to run goes to [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, with one yes/no question per use case (plain reads such as `ls`, `cat`, `git status` never do):

| Use case | Jev asks whether the command… | Starts from | Runs | Hands back |
|---|---|---|---|---|
| `tests` | is a full test, lint or typecheck run that takes a while | the project as it is now | in the background | its output, as a new message when it ends |
| `external_repo` | clones and runs another repository | an empty folder | while Claude waits | its output |
| `untrusted_code` | downloads and runs code of unknown origin (`curl … \| sh`, a new package) | an empty folder | while Claude waits | its output, the files it wrote outside its folder, the processes it left running |
| `repo_change` | changes many project files at once (deleting folders, a codemod, a mass rename, a dependency upgrade) | the project as it is now | while Claude waits | the files it changed, and a patch that is **not** applied |
| `clean_build` | builds or installs the project from scratch | the project as it is now | in the background | its output |

The likeliest use case at or above `threshold` (0.5) counts. `useCases` limits which ones are looked for.

**You decide.** With `confirmSandbox` on (the default), Claude Code's own question dialog asks:

```
Sandbox  Jev: `rm -rf src/legacy` looks like a bulk change to the project, to preview first.
         Run it in the Vercel Sandbox?
  1. Run in sandbox
  2. Run locally
  3. Always sandbox repo change
```

`Run locally` (or dismissing the dialog, or a `claude -p` run with no one to ask) lets the command go on as if the mod were not there, through Claude Code's usual permission prompt. `Always sandbox …` stops asking for that kind of job for the rest of the session.

With `confirmSandbox: false` every job Jev spots goes to the sandbox without a question, and the sandbox is started if it is not running (a start that failed is not retried until you run `/jev-vercel-sandbox restart`; those commands run locally meanwhile).

**Claude can also ask for it** with its own tool, `mcp__jev-vercel-sandbox__sandbox_run`:

```
sandbox_run { command: "npm ci && npm test", workspace: { git: "https://github.com/org/lib", ref: "v2.3.0" } }
sandbox_run { command: "npm test", background: true }
sandbox_run { command: "npx jscodeshift -t rename.js src", returns: "patch" }
```

`workspace` is `"current"` (default), `"none"`, or `{ git, ref }` (https only). Jev still reads the command: code of unknown origin never gets the project's copy, whatever Claude asked for. If the sandbox is not running, you are asked whether to start it (`confirmSandbox` off: it starts). `sandbox_jobs` lists the jobs, `sandbox_result` returns a job's whole output, and `sandbox_apply` applies a job's patch, always after asking you.

## What every result says

The first line of every result names the job and what it started from, so neither you nor Claude mistakes it for something that happened on your disk:

```
[sandbox · j3 · tree 3f2a91c] rm -rf src/legacy: exit 0 · 1.2s
in the job's folder: 27 files changed: -src/legacy/a.ts, -src/legacy/b.ts, …
patch kept (0.1 MB); not applied to the user's project
```

Claude also reads a note: the command did not run on your machine, the copy has no `.env` files, keys or environment variables, and the patch can be applied with `/jev-vercel-sandbox apply j3` or `sandbox_apply` (which asks you).

A background job answers at once (`queued, runs in the background`) and its result arrives later as a new message, with the same header.

## Each job starts from the project as it is now

`/jev-vercel-sandbox` uploads the project once. Before each job, only what changed since goes up: the mod builds a git tree of the files that go through a throwaway index (`GIT_INDEX_FILE=<tmp> git update-index --add` then `git write-tree`; your own index and `git status` are untouched), sends `git diff --binary <last tree> <this tree>` (text even for binary files), and the sandbox applies it. The tree in the result's header is that one: if you edit a file while a background job runs, you can tell its result predates the edit.

Each job runs in a folder of its own (`git worktree add` of the synced copy, a clone, or an empty repository), so two jobs never share files and an experiment never dirties a test run.

**Applying a patch** is always yours: `/jev-vercel-sandbox apply j3` (or the pane's `apply` button, or Claude's `sandbox_apply`) asks first, then runs `git apply --check` and `git apply` in your project. A patch that no longer applies (you changed those files since) is refused with git's reason, and one touching `.git`, `.claude`, `.env*`, keys or credentials is never applied.

**What goes up.** What `git ls-files --cached` lists: the files git tracks, as they are on disk (uncommitted edits included). Untracked files stay home, because an untracked file (`secrets.yaml`, `service-account.json`, `.envrc`) can hold credentials no name list recognizes. `uploadUntracked: true` adds the untracked files `.gitignore` does not exclude and, in a folder that is not a git repository, copies every file outside `.git` and `node_modules` (such a folder is copied once and not synced). Either way these are left out:

- `.env` and `.env.*` (except `.env.example`, `.sample`, `.template`, `.dist`), `.dev.vars`, `.npmrc`, `.pypirc`, `.netrc`, `.git-credentials`, `.pgpass`, `credentials(.json)`, Terraform state (`*.tfstate`)
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `*.ppk`, `id_rsa`/`id_ed25519` and the like
- anything inside `.git`, `.ssh`, `.aws`, `.gnupg`, `.kube`, `.docker`, `.terraform`, `.vercel`, `.claude` or `node_modules`

The first copy is packed with your `tar`, capped at `workspaceMaxMB` (10 MB compressed, also the cap on one sync), and uploaded as base64 through the command endpoint, 400 KB per request, because a mod's `$.http.fetch` sends text only. It needs `git`, `tar`, `mktemp` and `split` on your machine, and git in the sandbox image (the mod installs it with `dnf` or `apt-get` when missing). `uploadWorkspace: false` skips the copy: every job then runs in an empty folder.

## The pane and the command

`/jev-vercel-sandbox` opens the side pane and starts the sandbox, the microVM booting while the project is packed:

```
Vercel Sandbox
● ready

✓ Starting the microVM
    sbx-quiet-owl · iad1 · 2 vCPU
✓ Packing the project
    412 files · 1.8 MB · 1 credential file left out
✓ Uploading it
✓ Unpacking in the sandbox

Jev checks each command Claude runs. Tests, someone else's repo, an unknown
installer, a bulk change or a clean build: it asks you first, and they run
here, not on your machine.

Jev
typesafe jev-latest · asks first
3 detected · 2 sandboxed · 1 local

Jobs (2)
◌ j2 npm test                      running
✓ j1 rm -rf src/legacy                   0
    tree 3f2a91c · 27 files changed · patch

[ restart ] [ stop ] [ apply j1 ] [ close ]
```

- `/jev-vercel-sandbox` (or `start`): starts it and opens the pane; once ready, shows the state.
- `open`, `restart` (a new sandbox with a fresh copy), `stop`, `status`
- `jobs`, `result <job>`, `apply <job>`
- `run <command>`: your own job on the current project, in the background; its result shows in the pane and the transcript (Claude is not interrupted)

**Lifetime**: `sandboxTimeoutMinutes` (45); Vercel stops it then. It is stopped when the session ends (`stopOnExit`). With `persistent: false` (default) nothing is kept. Billing is Vercel's Active CPU pricing plus provisioned memory while it runs: see [pricing](https://vercel.com/docs/sandbox/pricing).

## Options

Set them in user settings (`~/.claude/settings.json`, not the project's), `--settings <file>`, managed settings, or `/config`:

```json
{
  "pluginConfigs": {
    "jev-vercel-sandbox@skills-dir": {
      "options": {
        "vercelToken": "<your Vercel access token>",
        "vercelTeamId": "team_…",
        "vercelProjectId": "prj_…",
        "typesafeApiKey": "<your TypeSafe key>",
        "confirmSandbox": true
      }
    }
  }
}
```

The key is the plugin's id: `"jev-vercel-sandbox@skills-dir"` when installed with `--mod`, `"jev-vercel-sandbox"` with `--plugin-dir`. Under the wrong key every option stays at its default and the pane says the credentials are missing.

**Vercel authentication**: an **access token** ([vercel.com/account/tokens](https://vercel.com/account/tokens)) plus the **team id** and **project id** it is scoped to, or an **OIDC token** (`vercel env pull` writes `VERCEL_OIDC_TOKEN`), which carries the team and project itself but expires after about 12 hours. Any of the three left empty falls back to `VERCEL_TOKEN` (then `VERCEL_OIDC_TOKEN`), `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID` in the environment Claude Code was started with. Without them, every command runs locally and nothing is asked.

```
  vercelToken:           string  access token or OIDC token (sensitive); env VERCEL_TOKEN / VERCEL_OIDC_TOKEN
  vercelTeamId:          string  team_…; env VERCEL_TEAM_ID; read from an OIDC token
  vercelProjectId:       string  prj_…; env VERCEL_PROJECT_ID; read from an OIDC token
  sandboxImage:          string  empty: vercel/sandbox/universal
  sandboxVcpus:          number  unset: Vercel's default
  sandboxTimeoutMinutes: number  lifetime before Vercel stops it (default 45)
  persistent:            boolean keep the filesystem across stops (default false)
  uploadWorkspace:       boolean copy the project into the sandbox on start (default true)
  uploadUntracked:       boolean copy untracked files too; needed outside git (default false)
  workspaceMaxMB:        number  cap on the compressed copy and on one sync (default 10)
  stopOnExit:            boolean stop when the session ends (default true)
  commandTimeoutMs:      number  a job's timeout when Claude sets none (default 120000, max 600000)
  confirmSandbox:        boolean ask before a detected job goes to the sandbox (default true)
  useCases:              string  comma-separated; empty: tests, external_repo, untrusted_code, repo_change, clean_build
  typesafeApiKey:        string  TypeSafe key (sensitive, preferred: calibrated probabilities)
  gatewayApiKey:         string  Vercel AI Gateway key (sensitive)
  provider:              string  "auto" | "typesafe" | "gateway" | "builtin"
  typesafeBaseUrl / typesafeModel / gatewayBaseUrl / gatewayModel
  threshold:             number  probability a use case needs (default 0.5)
  judgeTimeoutMs:        number  Jev latency budget; no answer runs the command locally (default 2000)
  columns:               number  pane width, 28-80 (default 44)
  vercelApiUrl:          string  empty: https://api.vercel.com
  logDecisions:          boolean log each detection and job (default true)
```

With no Jev key the engine's own `$.model.classify` picks the use case (or `none`) with the same questions as a rubric; that path has no probabilities, so `threshold` does not apply.

## Privacy

With a Jev key, your latest message and each command that is not a plain read go to TypeSafe or the AI Gateway. `/jev-vercel-sandbox` uploads the project copy described above to Vercel, and each job sends what changed since and its command. No environment variable leaves the machine through this mod; untracked files (unless `uploadUntracked` is on) and the files listed as left out never do.

## Install

```sh
npx claude-code-templates@latest --mod security/jev-vercel-sandbox
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

`--mod` writes the plugin to `.claude/skills/jev-vercel-sandbox/`, which Claude Code auto-loads as `jev-vercel-sandbox@skills-dir` **in a trusted project** (accept the trust prompt on the first interactive `claude` there; `-p` never asks). In the fullscreen layout (`/tui fullscreen`) the pane docks beside the transcript.

For one session, or in a folder you do not want to trust:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/jev-vercel-sandbox
```

`claude plugin validate .claude/skills/jev-vercel-sandbox` lists every event it hooks, every `$` call, and the four environment variables it reads.

## Tests

```sh
cd cli-tool/components/mods
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test security/jev-vercel-sandbox
```

They run the hooks against a fake Vercel API, a fake `git`/`tar` and a scripted question dialog: nothing starts with the session and the four tools are registered; a command that is no job, a plain read, "Run locally" and a dismissed question all run locally; the start uploads the project without its secrets; a confirmed job runs in its own worktree, is marked remote and keeps a patch it does not apply; an edit since the start goes up as a sync patch first, once; "Always" stops the questions; an installer runs in an empty folder and reports what it left; a test run goes to the background and reports back; a job confirmed before the start starts the sandbox; a hook that fails after the person chose the sandbox refuses the command; `sandbox_run` clones only https repositories and Jev keeps unknown code off the project copy; a patch is applied only after "Apply" and never when it touches `.claude/`; the size cap, an OIDC token, a stopped sandbox, the session end and the pane. `tests/judge.test.ts` and `tests/workspace.test.ts` cover the battery, the report reading and the URL checks. The sync, prepare and report scripts were run in bash against real git: the sandbox's tree after a sync matched the local tree hash, and the job's patch passed `git apply --check` in the original project.

**Not yet checked against the live API**: Vercel's limit on a request body (a failure shows as the upload or sync failing), and git in the default image.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods

A mod runs without `node_modules`, so `@vercel/sandbox` is not available: the Sandbox is driven over HTTP through `$.http.fetch`, with the endpoints of Vercel's [REST API reference](https://vercel.com/docs/rest-api/sandboxes) (`POST /v3/sandboxes`, `GET /v2/sandboxes/sessions/{id}`, `POST …/cmd` with `wait` and `logs`, answering `application/x-ndjson`, `POST …/stop`, each with `?teamId=`), called the way `@vercel/sandbox` 3.5.0 calls them. The Jev wire shapes are jev-auto-mode's.

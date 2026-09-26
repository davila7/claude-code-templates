# jev-vercel-sandbox

Runs dangerous Bash commands in a [Vercel Sandbox](https://vercel.com/docs/sandbox) instead of on your machine. Every command Claude is about to run goes to [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, which scores how dangerous it is. One past the threshold never touches your disk: it runs in an isolated Linux microVM (Firecracker) that started with the session, and its output comes back as the Bash tool's result, with a note telling Claude where it ran.

```
[jev-vercel-sandbox] sandbox ready: sbx-quiet-owl · iad1 · 2 vCPU · judge typesafe jev-latest · threshold 0.50
[jev-vercel-sandbox] judge rm -rf node_modules dist .cache: destructive 0.88 · system_change 0.07 · … · severity 1.5 · 290ms
[jev-vercel-sandbox] sandbox rm -rf node_modules dist .cache (destructive 0.88)
[jev-vercel-sandbox] judge npm test: destructive 0.03 · remote_code 0.02 · … · severity 0.0 · 240ms
[jev-vercel-sandbox] local npm test (destructive 0.03)
```

A side pane shows the sandbox's state (● ready, ◌ starting, ○ stopped, ✗ failed, or which settings are missing), its region and size, how long until Vercel stops it, the judge and its threshold, and the last commands that ran there with their exit codes. `restart`, `stop` and `close` buttons act on it.

It pairs with [`jev-auto-mode`](../jev-auto-mode), which decides whether an action may run at all, and [`jev-guardrails`](../jev-guardrails), which screens what is said. This one decides *where* a command runs.

## How a command is routed

For every Bash call, the main conversation's and subagents' alike:

1. **Plain reads stay local, unjudged.** One program from a short list (`ls`, `cat`, `grep`, `git status`, `git log`, `git branch`/`git remote` with listing flags only, `find` without `-delete`/`-exec`, …) with no `;`, `|`, `&`, redirect or substitution. Anything else goes to the judge, however harmless it looks.
2. **The judge.** One request carries your latest message (the intent), the command, and a battery of yes/no questions plus a severity score:

   | Hazard | Asks whether the command… |
   |---|---|
   | `destructive` | deletes, overwrites or irreversibly changes files, git history, databases or infrastructure |
   | `remote_code` | downloads and runs code from the internet, or runs a package or binary not already part of the project |
   | `system_change` | changes the machine beyond the project: sudo, packages, services, users, permissions, profiles |
   | `exfiltration` | sends files, secrets or environment variables off the machine |
   | `severity` | 0 none · 1 mild · 2 serious · 3 severe, if it turned out to be a mistake here |

3. **The decision.** Any hazard at or above `threshold` (0.5), or a severity at or above `severityThreshold` (2.0), sends it to the sandbox. Otherwise it runs locally, through Claude Code's own permission prompt as usual. Verdicts are cached per request and command.
4. **In the sandbox**, the command runs as `bash -c "<command>"` in the sandbox's working directory, with no local environment variable forwarded, under `timeout` (Claude's, else `commandTimeoutMs`). The Bash result is its stdout and stderr, headed by `[ran in Vercel Sandbox <name>, not on this machine · <reason> · exit N · Xms]`; a non-zero exit adds `Exit code N` to stderr. A call Claude asked to run in the background (`run_in_background`) still runs in the foreground there, so the tool call waits for it, up to its timeout (10 minutes at most). Claude also reads a note saying the command did not run on your machine, that the sandbox has none of your files or credentials, and that anything it wrote exists only there.

With no Jev key the engine's own `$.model.classify` decides between `local` and `sandbox` with the same questions as a rubric. That path has no probabilities, so the thresholds do not apply.

**What the sandbox is not.** It is a quarantine, not a copy of your project: your files are not there, so a command that needs them (a migration against your local database, `rm -rf build` meant to clean *your* build) runs against an empty machine and changes nothing of yours. That is the point for `curl … | sh` or a command you never meant to run; for one you did mean, Claude is told where it ran and should hand it to you to run yourself.

## When the sandbox cannot run it

| Situation | `whenUnavailable: "deny"` (default) | `"local"` |
|---|---|---|
| no Vercel credentials | refused; Claude is told why and not to retry another way | runs locally |
| the sandbox failed to start, or a call failed | refused (after one restart attempt if the session had stopped) | runs locally |

A judge that gives no answer (timeout past `judgeTimeoutMs`, an error) sends the command to the sandbox (`onJudgeError: "sandbox"`); set `"local"` to let it run here instead. `mode: "audit"` judges and logs every command but runs all of them locally, which is how to see what it would sandbox before turning it on.

## The sandbox's lifecycle

- **Session start**: the sandbox is created (`startOnSessionStart`) and the pane opens (`openPanel`). The session waits up to 8 s for it; past that it finishes in the background and the first dangerous command waits for it. Off: it starts on the first dangerous command.
- **Lifetime**: `sandboxTimeoutMinutes` (45). Vercel stops it then; the next dangerous command starts a new one. Your plan caps the maximum.
- **Session end**: stopped (`stopOnExit`). With `persistent: false` (default) nothing is kept; `true` lets Vercel snapshot the filesystem on stop.
- `/jev-vercel-sandbox` shows the state; `/jev-vercel-sandbox open | restart | stop | log`.

Billing is Vercel's Active CPU pricing plus provisioned memory while it runs: see [pricing](https://vercel.com/docs/sandbox/pricing).

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
        "typesafeApiKey": "<your TypeSafe key>"
      }
    }
  }
}
```

The key is the plugin's id: `"jev-vercel-sandbox@skills-dir"` when installed with `--mod`, `"jev-vercel-sandbox"` with `--plugin-dir`. Under the wrong key every option stays at its default and the pane says the credentials are missing.

**Vercel authentication** takes three values, as the SDK's `getCredentials()` does:

- an **access token** ([vercel.com/account/tokens](https://vercel.com/account/tokens)) plus the **team id** and **project id** it is scoped to; or
- an **OIDC token** (`vercel link` then `vercel env pull` writes `VERCEL_OIDC_TOKEN` to `.env.local`), which carries the team and project itself. It expires after about 12 hours and this mod cannot refresh it (the SDK does it through `@vercel/oidc`, which a mod cannot load), so an access token is the better fit for daily use.

Any of the three left empty falls back to `VERCEL_TOKEN` (then `VERCEL_OIDC_TOKEN`), `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID` in the environment Claude Code was started with.

```
  vercelToken:           string  access token or OIDC token (sensitive); env VERCEL_TOKEN / VERCEL_OIDC_TOKEN
  vercelTeamId:          string  team_…; env VERCEL_TEAM_ID; read from an OIDC token
  vercelProjectId:       string  prj_…; env VERCEL_PROJECT_ID; read from an OIDC token
  sandboxImage:          string  empty: vercel/sandbox/universal (Ubuntu, Node.js LTS, Python)
  sandboxVcpus:          number  unset: Vercel's default
  sandboxTimeoutMinutes: number  lifetime before Vercel stops it (default 45)
  persistent:            boolean keep the filesystem across stops (default false)
  startOnSessionStart:   boolean start with the session (default true)
  stopOnExit:            boolean stop when the session ends (default true)
  commandTimeoutMs:      number  when Claude sets none (default 120000, max 600000)
  whenUnavailable:       string  "deny" | "local" (default "deny")
  typesafeApiKey:        string  TypeSafe key (sensitive, preferred: calibrated probabilities)
  gatewayApiKey:         string  Vercel AI Gateway key (sensitive)
  provider:              string  "auto" | "typesafe" | "gateway" | "builtin"
  typesafeBaseUrl / typesafeModel / gatewayBaseUrl / gatewayModel
  threshold:             number  hazard probability that sandboxes (default 0.5)
  severityThreshold:     number  severity (0-3) that sandboxes (default 2)
  judgeTimeoutMs:        number  judge latency budget (default 2000)
  onJudgeError:          string  "sandbox" | "local" (default "sandbox")
  mode:                  string  "enforce" | "audit" (default "enforce")
  openPanel:             boolean open the pane at start (default true)
  columns:               number  pane width, 28-80 (default 44)
  vercelApiUrl:          string  empty: https://api.vercel.com
  logDecisions:          boolean log each judgement (default true)
```

## Privacy

With a Jev key, your latest message and each judged command go to TypeSafe or the AI Gateway. Each sandboxed command goes to Vercel. No file content and no environment variable leaves the machine through this mod. Plain reads are never sent anywhere.

## Install

```sh
npx claude-code-templates@latest --mod security/jev-vercel-sandbox
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

`--mod` writes the plugin to `.claude/skills/jev-vercel-sandbox/`, which Claude Code auto-loads as `jev-vercel-sandbox@skills-dir` **in a trusted project** (accept the trust prompt on the first interactive `claude` there; `-p` never asks). In the fullscreen layout (`/tui fullscreen`) the pane docks beside the transcript; below 144 columns the engine keeps an unasked pane hidden until `/jev-vercel-sandbox` opens it.

For one session, or in a folder you do not want to trust:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/jev-vercel-sandbox
```

`claude plugin validate .claude/skills/jev-vercel-sandbox` lists every event it hooks, every `$` call, and the four environment variables it reads.

**No lines at all** in the transcript: in `claude -p` there is no transcript or pane, and every line goes to `~/.claude/debug/<session-id>.txt`; otherwise check that the project is trusted and `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` is set (see [jev-guardrails](../jev-guardrails#what-you-see-in-the-transcript)).

## Tests

```sh
cd cli-tool/components/mods
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test security/jev-vercel-sandbox
```

They run the hooks against a fake Vercel API: the sandbox starts with the session, a dangerous command reaches `/cmd` and never runs locally, a safe one does, missing credentials and a failed start refuse, an OIDC token supplies its own team and project, the session end stops it, and the pane shows each state.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods

A mod runs without `node_modules`, so `@vercel/sandbox` is not available: the Sandbox is driven over HTTP through `$.http.fetch`, with the endpoints of Vercel's [REST API reference](https://vercel.com/docs/rest-api/sandboxes) (`POST /v3/sandboxes`, `GET /v2/sandboxes/sessions/{id}`, `POST …/cmd` with `wait` and `logs`, answering `application/x-ndjson`, `POST …/stop`, each with `?teamId=`), called the way `@vercel/sandbox` 3.5.0 calls them. The Jev wire shapes are jev-auto-mode's.

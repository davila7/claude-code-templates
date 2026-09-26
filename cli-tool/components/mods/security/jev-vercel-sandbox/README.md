# jev-vercel-sandbox

Runs dangerous Bash commands in a [Vercel Sandbox](https://vercel.com/docs/sandbox) instead of on your machine. Every command Claude is about to run goes to [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, which scores how dangerous it is. One past the threshold never touches your disk: it runs in an isolated Linux microVM (Firecracker) holding a copy of your project, and its output comes back as the Bash tool's result, with a note telling Claude where it ran and which files it changed there.

**You start the sandbox** by typing `/jev-vercel-sandbox`. Nothing starts with the session. The side pane opens with a loading state while it comes up:

```
Vercel Sandbox
◌ loading the sandbox…

✓ Starting the microVM
    sbx-quiet-owl · iad1 · 2 vCPU
✓ Packing the project
    412 files · 1.8 MB · 1 secret left out
◌ Uploading it
    3/5
· Unpacking in the sandbox
```

When it is ready the pane says **Jev will now run the commands it judges dangerous in this sandbox, not on your machine**, and from then on logs every command it runs there, live: `◌` while it runs, then `✓` or `!` with the exit code, and the files it added, changed or deleted.

```
[jev-vercel-sandbox] sandbox ready: sbx-quiet-owl · iad1 · 412 files in /vercel/sandbox/my-app. Jev will now run the commands it judges dangerous in the sandbox (judge typesafe jev-latest, threshold 0.50)
[jev-vercel-sandbox] judge rm -rf node_modules dist .cache: destructive 0.88 · system_change 0.07 · … · severity 1.5 · 290ms
[jev-vercel-sandbox] sandbox rm -rf node_modules dist .cache (destructive 0.88)
[jev-vercel-sandbox] sandbox rm -rf node_modules dist .cache: exit 0 · 180ms · 37 files changed: -dist/index.js, …
[jev-vercel-sandbox] judge npm test: destructive 0.03 · remote_code 0.02 · … · severity 0.0 · 240ms
[jev-vercel-sandbox] local npm test (destructive 0.03)
```

Until you run `/jev-vercel-sandbox`, a command Jev judges dangerous is refused, and Claude is told the sandbox is started with `/jev-vercel-sandbox`. The pane also shows the judge and its threshold, and `start`/`restart`, `stop`, `run last locally` and `close` buttons.

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
4. **In the sandbox**, the command runs as `bash -c "<command>"` in the project copy, in the folder matching the session's working directory, with no local environment variable forwarded, under `timeout` (Claude's, else `commandTimeoutMs`). The Bash result is its stdout and stderr, headed by `[ran in Vercel Sandbox <name>, not on this machine · <reason> · exit N · Xms]`; a non-zero exit adds `Exit code N` to stderr. A call Claude asked to run in the background (`run_in_background`) still runs in the foreground there, so the tool call waits for it, up to its timeout (10 minutes at most). After it, `git status` in the copy lists the files it added, changed or deleted, which go into the result's header, the pane and a note Claude reads: the command did not run on your machine, the copy has no `.env` files, keys or environment variables, and anything it wrote exists only in the sandbox.

With no Jev key the engine's own `$.model.classify` decides between `local` and `sandbox` with the same questions as a rubric. That path has no probabilities, so the thresholds do not apply.

**What the sandbox is.** A rehearsal on a copy: `rm -rf build` removes the copy's `build/`, and Claude sees which files went. Nothing of yours changes, and nothing it can reach is yours: not your local database, services or credentials. That is the point for `curl … | sh` or a command you never meant to run. For one you did mean, Claude is told it ran in the sandbox; you approve it with `/jev-vercel-sandbox approve` (or `run last locally` in the pane), and the same command, run again, runs on your machine once.

**The copy** is taken when the sandbox starts, not kept in sync: edits Claude makes on your machine afterwards are not in it (`/jev-vercel-sandbox restart` takes a fresh copy). It holds what `git ls-files --cached --others --exclude-standard` lists (tracked files plus untracked ones `.gitignore` does not exclude), or every file outside `.git` and `node_modules` when the folder is not a git repository, minus:

- `.env` and `.env.*` (except `.env.example`, `.sample`, `.template`, `.dist`), `.dev.vars`, `.npmrc`, `.pypirc`, `.netrc`, `.git-credentials`, `credentials(.json)`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `*.ppk`, `id_rsa`/`id_ed25519` and the like
- anything inside `.git`, `.ssh`, `.aws`, `.gnupg`, `.vercel`, `.claude` or `node_modules`

It is packed with your `tar` (`tar -czf … --null -T -`), capped at `workspaceMaxMB` (10 MB compressed; a bigger project fails the start and says so), and uploaded as base64 through the command endpoint, 400 KB per request, because a mod's `$.http.fetch` sends text only and the SDK's `fs/write` takes a binary body. Inside, it is unpacked into `/vercel/sandbox/<folder name>` and committed as a git baseline so each command's changes can be listed. With no git in the image the changed files are not listed. `uploadWorkspace: false` skips the copy: commands then run in an empty sandbox. Packing needs `git`, `tar`, `mktemp` and `split` on your machine (macOS and Linux have them).

## When the sandbox cannot run it

| Situation | `whenUnavailable: "deny"` (default) | `"local"` |
|---|---|---|
| no Vercel credentials | refused; Claude is told why and not to retry another way | runs locally |
| `/jev-vercel-sandbox` not run yet, or the sandbox stopped | refused; Claude is told the user starts it with `/jev-vercel-sandbox` | runs locally |
| still starting | waits up to 6 s, then refused with "wait for the pane to say ready" | waits, then runs locally |
| the start failed, or a call failed | refused | the start failed: runs locally; a failed call: refused |

A judge that gives no answer (timeout past `judgeTimeoutMs`, an error) sends the command to the sandbox (`onJudgeError: "sandbox"`); set `"local"` to let it run here instead. `mode: "audit"` judges and logs every command but runs all of them locally, which is how to see what it would sandbox before turning it on.

## The sandbox's lifecycle

- **`/jev-vercel-sandbox`** (or `start`): opens the pane and starts the sandbox, the microVM booting while the project is packed. The command answers at once; the pane follows the progress. Run again once it is ready, it shows the state.
- **Lifetime**: `sandboxTimeoutMinutes` (45). Vercel stops it then; run `/jev-vercel-sandbox` again. Your plan caps the maximum. A start that fails stops the half-started microVM.
- **Session end**: stopped (`stopOnExit`). With `persistent: false` (default) nothing is kept; `true` lets Vercel snapshot the filesystem on stop.
- `/jev-vercel-sandbox open | restart | stop | log | approve`: `restart` stops it and starts a new one with a fresh copy; `approve` lets the last sandboxed command run once on your machine.

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
  uploadWorkspace:       boolean copy the project into the sandbox on start (default true)
  workspaceMaxMB:        number  cap on the compressed copy (default 10)
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
  columns:               number  pane width, 28-80 (default 44)
  vercelApiUrl:          string  empty: https://api.vercel.com
  logDecisions:          boolean log each judgement (default true)
```

## Privacy

With a Jev key, your latest message and each judged command go to TypeSafe or the AI Gateway. `/jev-vercel-sandbox` uploads the project copy described above to Vercel (set `uploadWorkspace: false` to send no file); each sandboxed command goes there too. No environment variable leaves the machine through this mod, and the files listed as left out never do. Plain reads are never sent anywhere.

## Install

```sh
npx claude-code-templates@latest --mod security/jev-vercel-sandbox
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

`--mod` writes the plugin to `.claude/skills/jev-vercel-sandbox/`, which Claude Code auto-loads as `jev-vercel-sandbox@skills-dir` **in a trusted project** (accept the trust prompt on the first interactive `claude` there; `-p` never asks). In the fullscreen layout (`/tui fullscreen`) the pane docks beside the transcript when `/jev-vercel-sandbox` opens it.

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

They run the hooks against a fake Vercel API and a fake `tar`/`git`: nothing starts with the session and a dangerous command is refused until `/jev-vercel-sandbox`; the command opens the pane, starts the microVM and uploads the project without its secrets; a dangerous command then runs in the copy's folder and reports its changed files; `approve` lets it run locally once; missing credentials, a failed start, a project over the cap and a stopped sandbox refuse; an OIDC token supplies its own team and project; the session end stops it; the pane shows each state. `tests/workspace.test.ts` covers the exclusion list, the chunking and the `git status` reading. The upload scripts themselves were checked by running them in bash on a 7 MB project split into three parts, which unpacked byte for byte.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods

A mod runs without `node_modules`, so `@vercel/sandbox` is not available: the Sandbox is driven over HTTP through `$.http.fetch`, with the endpoints of Vercel's [REST API reference](https://vercel.com/docs/rest-api/sandboxes) (`POST /v3/sandboxes`, `GET /v2/sandboxes/sessions/{id}`, `POST …/cmd` with `wait` and `logs`, answering `application/x-ndjson`, `POST …/stop`, each with `?teamId=`), called the way `@vercel/sandbox` 3.5.0 calls them. The upload's request size (about 400 KB of arguments per `/cmd` call) is within Linux's per-argument limit; Vercel's own limit on a request body is not documented, so a failure there shows as the upload step failing in the pane. The Jev wire shapes are jev-auto-mode's.

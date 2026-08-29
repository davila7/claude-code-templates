---
name: rote
description: "Compile a proven agent skill (a SKILL.md plus references) into a deterministic pipeline that runs without an LLM in the loop, then serve it back to Claude as an MCP tool. Use when: rote, compile this skill, turn this skill into a workflow, make this skill deterministic, make this skill cheaper or faster, harden this skill for production, run this skill as a background job."
license: Apache-2.0
metadata:
  author: trevhud
  version: "0.12.1"
  homepage: https://github.com/trevhud/rote
---

# rote: compile a skill into a deterministic pipeline

You orchestrate the `rote` CLI. It runs an LLM compiler agent over a source
skill once, and emits a pipeline that runs forever after without an agent
loop. Your job is to resolve the inputs, run the CLI, and interpret the
output. You never classify nodes or write `pipeline.yaml` yourself; the
CLI's compiler agent does that.

## When this applies

Use it on a skill the user has already run many times and wants to run many
more, unattended. Exploratory or one-off work should stay an agent loop:
flexibility is the point there, and there is nothing proven to compile yet.
Say so and stop if that is what you are looking at.

## 1. Identify the source skill

The source is a directory containing a `SKILL.md`, optionally with a
`references/` folder. The user names it, or you infer it from context: a
skill just discussed, a path in the conversation, `.claude/skills/*` or
`skills/*` in the project.

Confirm the resolved absolute path with the user before running.
Compilation costs real time and tokens, so never guess and go. If the
directory has no `SKILL.md`, stop and ask.

## 2. Pick a runtime target

| Runtime | `--runtime` | Language | Choose when |
| --- | --- | --- | --- |
| DBOS (default) | `dbos` | Python | No orchestrator to deploy. SQLite for dev, Postgres for prod |
| Temporal | `temporal` | Python | You already operate a Temporal cluster |
| Plain Python | `python` | Python | Max legibility, stdlib only. Refuses pipelines with HITL gates |
| Cloudflare Workflows | `cloudflare` | TypeScript | Serverless, managed, `wrangler deploy`-ready |
| DBOS (TypeScript) | `dbos-ts` | TypeScript | Zero orchestrator on the TS side. Postgres only |
| Inngest | `inngest` | TypeScript | Mounting into an existing Node or Next.js app |

If the user has no opinion and no existing infrastructure, use `dbos`. It is
the default and the only Python target with zero standing infrastructure, so
you can omit `--runtime` entirely.

## 3. Resolve the CLI

The CLI ships on PyPI as `rote-cli` and its executable is named `rote`. With
`uvx` that means every invocation is `uvx --from 'rote-cli>=0.12.1' rote <args>`. Do
not run `uvx rote-cli ...`; uvx looks for an executable named after the
package, and the published wheel does not ship one.

```sh
uv --version                              # install uv first if missing
uvx --from 'rote-cli>=0.12.1' rote --version        # confirm the CLI resolves
```

If uv is missing, do not pipe a remote script into a shell. Ask the user to
install it through their package manager (`brew install uv`, `pipx install uv`,
or `pip install uv`) or to follow the official guide at
https://docs.astral.sh/uv/getting-started/installation/ and choose the method
they trust.

`pip install rote-cli` works too if the user prefers a virtualenv.

`rote compile` runs an LLM agent, so it needs a driver: Claude Code
(`claude`) or Codex (`codex`) installed and authed, or `ANTHROPIC_API_KEY`
for the in-process `api` driver. The default `claude` driver deliberately
scrubs `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` from the child
environment so the run bills against the user's Claude subscription rather
than per-token API charges. Do not "fix" auth by exporting an API key. If
the user explicitly wants API billing, pass `--agent api`.

## 4. Run the compilation

```sh
uvx --from 'rote-cli>=0.12.1' rote compile <skill-dir> --runtime <runtime> --out <out-dir>
```

Pick an out-dir the user will find, such as `./compiled/<skill-name>` next
to the source skill, and make sure it does not clobber existing work.

Set expectations before launching. This is not a quick command: a realistic
skill takes roughly 13 minutes of wall clock and 30 to 40 agent turns on
Sonnet. Run it in the background, tell the user you did, and poll rather
than blocking the session.

If the run exits nonzero, check whether `<out-dir>/compiled/pipeline.yaml`
exists anyway. The CLI recovers completed work from transient subprocess
failures and says so in its output. Surface stderr to the user either way.

## 5. Report the result

Read `<out-dir>/compiled/pipeline.yaml` and
`<out-dir>/compiled/compile-report.md`, then summarize:

1. **Node-kind table.** Count nodes per kind and say what each means here:

   | Kind | Meaning |
   | --- | --- |
   | `pure_function` | Deterministic code. The LLM is gone |
   | `external_call` | Direct API call with retry and timeout |
   | `llm_judge` | Typed LLM signature, kept but bounded |
   | `agent_loop` | Still agentic, because the input is genuinely unbounded |
   | `hitl_gate` | Durable human approval point |

2. **Codified fraction.** How many nodes no longer need an LLM, which nodes
   are mandatory, and what each HITL gate blocks on.
3. **Where things landed.** `<out-dir>/compiled/` holds the IR, `extracted/`,
   `signatures/`, and the report. `<out-dir>/runtime/<runtime>/` holds the
   deployable code.
4. **Next steps.** The `extracted/*` modules are scaffolds that raise
   `NotImplementedError`. The user fills in real client code, then deploys
   the runtime output.

Be honest in this summary. A pipeline that came out mostly `agent_loop` means
the skill was not as deterministic as it looked, and the user should know
that rather than hear a success story.

## 6. Serve compiled pipelines back to Claude

`rote serve` is one MCP server exposing every registered pipeline as a
callable tool. It triggers deployed workflows; it does not host them. The
full flow:

```
rote compile -> deploy the runtime -> rote register -> rote serve -> call from Claude
```

Register the pipeline once the runtime side is actually running (a DBOS app
in worker mode, a Temporal worker, or a deployed Cloudflare Worker):

```sh
uvx --from 'rote-cli>=0.12.1' rote register <out-dir>
uvx --from 'rote-cli>=0.12.1' rote register <out-dir> --runtime temporal
uvx --from 'rote-cli>=0.12.1' rote register <out-dir> --runtime cloudflare --url https://<worker>.workers.dev
```

This upserts `~/.rote/registry.json`. Re-registering updates in place. After
recompiling a changed skill, register again: DBOS and Temporal workflow
names derive from the pipeline content hash and must stay in sync with the
emitted code.

Then add the server:

```sh
claude mcp add --scope user rote -- uvx --from 'rote-cli[serve,dbos]>=0.12.1' rote serve
```

Each registry entry becomes two tools, or three on DBOS: `<name>` starts a
run and returns `{workflow_id, status: "started"}` immediately, since
compiled pipelines run for minutes to days; `<name>_status` polls a run by
`workflow_id`; and on DBOS `<name>_signal` resumes a run parked at a HITL
gate, so Claude can deliver approvals itself.

Two caveats worth stating proactively. A DBOS run stuck in `enqueued` means
the emitted app process is not running against the registered system
database. And while Claude Code picks up newly registered pipelines
immediately via the server's `list_changed` notification, Claude Desktop and
claude.ai snapshot tools at connect time, so a pipeline registered mid-session
appears there only after a reconnect.

## Reference

- Repository and docs: https://github.com/trevhud/rote (Apache-2.0)
- Package: https://pypi.org/project/rote-cli/

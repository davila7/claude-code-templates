# Local Task Orchestrator

An independent Claude Code native mod for explicit, advisory **classification** and **schema-limited extraction**. Claude Code remains the host model; this mod calls only an explicitly configured Ollama model at the fixed loopback endpoint.

## Install from the template catalog

```sh
npx claude-code-templates@latest --mod productivity/local-task-orchestrator
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

The installer writes the plugin directory to `.claude/skills/local-task-orchestrator/`. In a trusted project Claude Code loads it as `local-task-orchestrator@skills-dir`. For one-session loading or hot reload:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/local-task-orchestrator
```

Native mods require Claude Code **2.1.287 or later**. The observed installed CLI 2.1.178 is too old to load/validate this mod. Do not treat mock tests or source inspection as proof of runtime loading.

## Configure before use

Provide these plugin options in Claude Code user configuration:

- `model_id`: exact ID of an already-installed Ollama model. No model is auto-selected or downloaded.
- `ollama_cloud_disabled`: set true only after manually checking the **Ollama server** cloud configuration.
- `host_egress_verified`: set true only after manually checking host egress controls for this path.

Example user settings entry:

```json
{
  "pluginConfigs": {
    "local-task-orchestrator@skills-dir": {
      "options": {
        "model_id": "qwen3:8b",
        "ollama_cloud_disabled": true,
        "host_egress_verified": true
      }
    }
  }
}
```

These booleans are user attestations, not technical proof. A loopback address alone does not prove local-only processing.

## Use

Pass one JSON object after an operation name:

```text
/local-task classify {"text":"The service returns 503.","labels":["bug","question"]}
/local-task extract {"text":"Name: Ada","schema":{"name":"string"}}
```

The user explicitly chose to return validated results to Claude so it can continue. Both the submitted task and returned result enter Claude's session transcript/context and may be handled by its configured host provider. Do not use this flow for content that is not approved for that data flow.

The mod sends only the parsed task fields (`text` plus `labels` or `schema`) to `http://127.0.0.1:11434/api/chat`. It has no cloud fallback, tool calls, shell execution, or file writes. Input is limited to 20,000 UTF-8 bytes, labels and schema fields to 32 entries, model output to 8,000 UTF-8 bytes, and evidence to a 2,000-byte exact substring of the supplied text. Extraction permits only named primitive fields (`string`, `number`, `boolean`) and drops undeclared output keys. Each inference request has a 30-second native timer; both timeout and command cancellation abort the HTTP fetch. The timer is cancelled on completion.

Output validation proves structure and exact-substring evidence only; it does not establish semantic truth, model quality, cloud-off, or egress state. Results are provisional advice and cannot authorize tools, commands, permissions, or writes.

## Tests and validation

From this mod directory:

```sh
claude plugin validate --strict .
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .
```

Native plugin tests cover both operations, request bounds/routing, refusal paths, timeout/cancellation, and safe errors; tests do not contact Ollama or perform inference. For installation validation use:

```sh
claude plugin validate .claude/skills/local-task-orchestrator
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .claude/skills/local-task-orchestrator
```

Installed CLI 2.1.178 cannot verify native module compatibility; validate with a separately authorized supported Claude Code version before relying on runtime behavior.

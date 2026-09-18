# Inputs and workflow

Create `task.txt` describing the bounded task. Create `request.json`, for example:

```json
{
  "schemaVersion": 1,
  "messages": [{"role": "user", "content": "Reply with exactly the uppercase word READY and nothing else."}],
  "options": {"temperature": 0, "num_ctx": 4096, "num_predict": 32},
  "limits": {"timeoutMs": 120000, "maxResponseBytes": 4194304},
  "contextManifest": [],
  "verification": {"type": "exact-text", "expected": "READY"},
  "loadPolicy": "uncontrolled"
}
```

This is a smoke check, not a coding-quality benchmark. Exact-text verification
trims outer whitespace; it never executes output. Omit `verification` for work
that needs the host's review. Only role/content text messages and the documented
generation options are accepted; images, tools and arbitrary endpoints are not.

For code tasks, put the required snippets in `messages` explicitly. Optional
manifest entries contain relative `path`, file `sha256`, `startLine`, `endLine`.
They are hashed for equivalence, not automatically read from disk. Prompts,
expected answers and manifest paths are not persisted in telemetry.

The preflight context bound uses UTF-8 input bytes plus a template reserve,
not a measured token count. If it exceeds `num_ctx - num_predict`, explicitly
reduce the input or increase the configured window within model capacity. The
runner never silently truncates input. Model-specific tokenization/templates
can still differ; inspect runtime behavior when a task requires exact context
occupancy. Unknown metrics remain unavailable.

## Commands

Use the script path relative to the installed skill. Replace placeholders with
values returned by the commands:

```bash
node .claude/skills/pudu-task-telemetry/scripts/pudu-task.mjs start --task-file task.txt --json
node .claude/skills/pudu-task-telemetry/scripts/pudu-task.mjs run-local --config local-config.json --task-id TASK_UUID --request-file request.json --model INSTALLED_MODEL --output result.txt --json
node .claude/skills/pudu-task-telemetry/scripts/pudu-task.mjs finish --task-id TASK_UUID --status completed --json
node .claude/skills/pudu-task-telemetry/scripts/pudu-task.mjs report --task-id TASK_UUID --format markdown
node .claude/skills/pudu-task-telemetry/scripts/pudu-task.mjs compare --task-ids TASK_UUID_A,TASK_UUID_B --json
```

Relative inputs and output resolve against `--repo` (default current directory).
`result.txt` must not exist. To retry, choose a new output filename and pass
`--retry-of` with a prior attempt ID whose request hash is identical.

## Host-reported verification

After reviewing the result or running authorized project checks, create a file:

```json
{
  "schemaVersion": 1,
  "status": "passed",
  "source": "host_reported",
  "rubricId": "code-summary-v1",
  "checks": [{"id": "inputs-described", "passed": true}, {"id": "outputs-described", "passed": true}]
}
```

Pass it to `finish --verification-file verification.json`. This sample contains
illustrative results only; replace them with checks actually performed. The
status must match all check results; no checks means `unverified`. Identifiers
are hashed in persisted telemetry. External input cannot claim `source: runner`.
A host-reported pass does not qualify a model for automatic selection.

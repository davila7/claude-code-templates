# Telemetry contract

Schema identifier: `pudu-task-telemetry/v1`. See
[task-schema.json](task-schema.json) for the persisted task envelope. This is not
an existing Pudu TaskTrace import format. Potential future mapping: task IDs and
timestamps to TaskTrace identity, attempts to AgentRun, final token sums to llm,
checks to verification. No import API is assumed or modified.

## Provenance

Each metric has `value`, `unit`, `origin`, `source`, `scope`, and
`unavailableReason`. Origins are measured, derived, estimated or unavailable.
Unavailable values are null; zero is a real measured/calculated zero.

- `request_wall_ms`: monotonic interval for the HTTP stream, including failures.
- `first_chunk_ms`: first received transport chunk, not time to first token.
- `first_content_ms`: first nonempty visible content; excludes reasoning text.
- `prompt_tokens` / `completion_tokens`: nonnegative integer counts from a valid
  terminal Ollama message. Failed or interrupted streams have unavailable counts.
- `load_ms`, `runtime_total_ms`, `prompt_eval_ms`, `eval_ms`: runtime nanoseconds
  converted to milliseconds. These are runtime-reported measurements.
- `generation_tps`: generated tokens divided by positive generation seconds,
  derived from runtime counts/duration. Zero duration yields null.
- `system_memory_peak_bytes`: peak sampled system usage, not model allocation.
- `system_cpu_mean_pct`: mean valid CPU deltas across 1 Hz samples; the initial
  sample does not claim an interval. Sampling uses bounded aggregate state.
- GPU, watts, temperature, model RSS and swap: null, sensors not implemented.
- Task elapsed time: derived wall-clock difference, susceptible to clock changes.
  Attempt durations are never summed as elapsed time.

Task summaries include only fully known token totals: one unavailable attempt
makes that total unavailable. No tokens means no occupancy estimate. Verification
has a separate status and source; completed does not imply passed. No checks
means unknown pass rate, not zero failures or 100% success.

## Persistence and recovery

Storage is `.pudu-ai/task-telemetry/TASK_UUID/`: `events.jsonl` is authoritative,
`task.json` an atomic snapshot, `report.json` written on finish. Events contain
sanitized full snapshots, bounded to 32 MiB per task and 100 attempts. Event IDs
are unique UUIDs. The format favors simple crash recovery over compactness.

One exclusive lock per task prevents concurrent mutations. Different tasks have
separate locks. `finish` with identical inputs is idempotent; conflicting closes
fail. After a process crash, `recover` refuses a live/unknown owner, discards only
an incomplete trailing event line, and marks running task/attempts interrupted.
Interior corrupt events fail rather than being skipped. A malformed lock or an
abandoned recovery marker requires manual inspection; do not delete a live lock.
The store protects against pre-existing symlinks/hardlinks; it is not a sandbox
against a malicious local process concurrently changing the filesystem.

No prompt, expected answer, response, environment dump, raw stderr, absolute
model path or machine hostname is stored. Git/input/rubric hashes enable
comparison but are not an anonymity guarantee. A task repository identifier is
a local path hash; hardware fingerprints can also be identifying. `--output`
creates a separate user-requested response file with private permissions where
supported. Existing outputs are never overwritten. Exclude telemetry from Git
and delete it when no longer needed; no background retention/upload service runs.

## Failure contract

JSON output always goes to stdout; raw tool diagnostics are not printed.

| Exit | Meaning |
|---|---|
| 0 | Operation completed (a recommendation can still need explicit selection) |
| 2 | Invalid input |
| 3 | Dependency/runtime/model unavailable |
| 4 | Unsupported contract, state conflict, ineligible model or runtime error |
| 5 | Timeout |
| 6 | Verification failed |
| 7 | Storage/output/internal failure |
| 130 | Cancellation |

Defaults: metadata 10 s; Pudu inventory 30 s; inference 120 s / 4 MiB response;
inputs 4 MiB. Requests may raise inference limits to 30 minutes / 16 MiB.
No automatic retry. An abort closes this client's HTTP request; it does not kill
Ollama or guarantee immediate cessation of server compute. Partial measurements
remain separate from successful calls. If final storage fails, the JSON result
sets `persisted: false` with available measurements; recover durable events later.

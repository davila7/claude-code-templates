# Example Ralph Review transcript

A scrubbed example of a Ralph Review pass over a small Python feature — adding a retry wrapper around an HTTP client. Branch: `solo/issue-42-http-retry`. Issue: "Add configurable retries to the OrderClient HTTP calls".

The three tiers ran in sequence with the controller `/ralph-review` command. Output below is condensed — real transcripts are longer.

---

## User invocation

```
> /ralph-review
```

## Controller — Tier 1 dispatch

Main agent dispatches `haiku-reviewer` against the current branch diff.

## Tier 1 — Haiku RESULT

```
## RESULT
mcp_graph_available: yes
verdict: fail
files_touched:
  - src/clients/order_client.py
  - src/clients/retry.py
  - tests/test_retry.py
findings:
  - path: src/clients/retry.py
    line: 34
    claim: debug print statement left in
    evidence: "print(f'retrying {attempt} of {max_retries}')"
  - path: src/clients/order_client.py
    line: 78
    claim: magic number in code (max_retries=3)
    evidence: "self._retry_wrapper(max_retries=3) — should be in config"
scope_gaps: none
```

Main agent applies fixes:
- Remove the `print()` (commit `a3f12e9`)
- Move `max_retries=3` to `config/clients.yaml` under `order_client.max_retries`, read via `config.get('order_client.max_retries')` (commit `b84c5d1`)
- Run tests, all pass.

**Loop restarts from Tier 1** (restart-on-fail, not continue-with-flag).

## Tier 1 — Haiku RESULT (2nd iteration)

```
## RESULT
mcp_graph_available: yes
verdict: pass
files_touched:
  - src/clients/order_client.py
  - src/clients/retry.py
  - tests/test_retry.py
  - config/clients.yaml
findings: []
scope_gaps: none
```

`<promise>HAIKU_PASS</promise>`

## Tier 2 — Sonnet RESULT

```
## RESULT
mcp_graph_available: yes
verdict: fail
files_touched:
  - src/clients/order_client.py
  - src/clients/retry.py
findings:
  - path: src/clients/retry.py
    line: 22
    claim: exception swallowed without logging
    evidence: "except requests.RequestException: pass  # silent fallback — no log, no metric"
  - path: tests/test_retry.py
    line: 51
    claim: mock accepts **kwargs — does not prove propagation
    evidence: "mock_call.assert_called()  # should be assert_called_with(max_retries=3)"
scope_gaps: none
```

Main agent applies fixes:
- Replace the silent `except` with a structured log + a `retries_exhausted` counter metric (commit `c19f7a2`)
- Update test to `assert mock_call.call_args.kwargs['max_retries'] == 3` (commit `d55b908`)
- Run full test suite.

**Loop restarts from Tier 1**.

## Tier 1 — Haiku RESULT (3rd iteration)

```
verdict: pass
findings: []
```

`<promise>HAIKU_PASS</promise>`

## Tier 2 — Sonnet RESULT (2nd iteration)

```
verdict: pass
findings: []
```

`<promise>SONNET_PASS</promise>`

## Tier 3 — Opus RESULT

```
## RESULT
mcp_graph_available: yes
verdict: pass
files_touched:
  - src/clients/order_client.py
  - src/clients/retry.py
  - tests/test_retry.py
  - config/clients.yaml
findings: []
scope_gaps: none
governance_drift: none_detected
  - Tier A box "Add retry wrapper" closed at commit b84c5d1 — interleaves with phase 1 commits
  - Tier A box "Move max_retries to config" closed at commit b84c5d1 — same phase window
  - Tier B box "Fix Everything applied" closed at end — acceptable
spot_check:
  - graph_result: callers_of(_retry_wrapper) returned 1 caller
  - source_read: src/clients/order_client.py:78 — confirmed single call site
factual_claims: none added in this diff
```

`<promise>OPUS_PASS</promise>`

## Controller — final output

```
<promise>RALPH_PASS</promise>

Three tiers passed. Two restart cycles (Tier 1 × 2 iterations, Tier 2 × 1 iteration).
Total findings fixed: 4.
Branch ready for merge.
```

---

## What this transcript demonstrates

- **Restart-on-fail**: Tier 2 found issues after Tier 1 already passed. Loop went back to Tier 1, not to "Tier 3 with a flag".
- **Cross-boundary contract**: the `**kwargs`-swallowing mock was caught at Tier 2 — surface tier doesn't trace call-args assertions.
- **Governance cadence**: Opus tier classified the three checkbox closures correctly (two Tier A interleaved, one Tier B batched).
- **Graph spot-check**: Opus used graph to list callers, then read the source to confirm — never trusted the graph alone.
- **Silent fallback caught late**: the swallowed exception was invisible at surface; Tier 2 traced the exception path to find it.

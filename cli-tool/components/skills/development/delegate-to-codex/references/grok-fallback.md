# Grok fallback adapter

[SKILL.md](../SKILL.md#capacity-and-fallback) owns provider selection, handoff, budgets, review and return-to-Codex rules. Claude remains lead; use `scripts/grok_bridge.py`.

1. Use the [task template](../assets/task.template.json) with bounded scope, committed base, criteria and validation. Leave safety fields out as in SKILL.md. Default Grok 4.7/low effort (`GROK_BRIDGE_REASONING_EFFORT` overrides), initially 3-6 turns.
2. Run `python -B "$SKILL/scripts/grok_bridge.py" preflight`; stop on ambiguous billing, missing executable or signed-out state (ask for `grok login`). Never substitute an API key.
3. For inherited work use the verified Codex `export-handoff`; give only the remainder/original base. Grok seeds a separate worktree with identity/hash/scope checks.
4. Launch once: `python -B "$SKILL/scripts/grok_bridge.py" run --task T [--handoff H]`. Wait on that process; one writer per assignment.

Grok has no general shell. Implement/test workers may run exactly the plain-argument `validation_command` via one `Bash(command)` allow rule in `dontAsk` mode; other shell commands are refused except built-in read-only commands. Windows does not enforce Grok's sandbox: validation runs with user rights, as independent bridge validation does. `GROK_BRIDGE_WORKER_CHECKS=skip` withholds worker testing; bridge validation remains acceptance evidence.

`run`, `continue`, `revise`, `recover-turn-cap`, `recheck` print compact reports; `--full` reads the complete preserved `result.json`. Check context evidence, paths, combined diff and validation. Artifacts are private `artifacts/grok`; usage is tokens/estimated API-equivalent dollars, not plan headroom.

- `continue --task T --artifact A --grant-turns N` (1-6).
- `revise --task T --artifact A --feedback F --grant-turns N` (1-6), using SKILL.md's feedback shape.
- `recover-turn-cap` explicitly requests a missing no-tools checkpoint for eligible preserved max-turns failures; never an automatic rerun.

Grok obtains its structured reply in a separate no-tools report call that re-sends the session, mostly uncached; review cost includes that call. Apply acceptance/integration rules from SKILL.md; Codex-only convenience commands do not apply to this adapter.

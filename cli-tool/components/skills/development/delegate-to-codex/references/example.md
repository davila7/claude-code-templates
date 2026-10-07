# Worked example

One small change from task file to accepted patch. `$SKILL` is this skill's folder (SKILL.md writes it as
`${CLAUDE_SKILL_DIR}`); every command is `python -B "$SKILL/scripts/codex_bridge.py" <subcommand>`.

The user asks for a `slugify(text)` helper in `textutil.py`, with tests. Claude has settled the design: lower-case,
runs of non-alphanumerics become one `-`, no leading or trailing `-`.

## 1. Write the task file

Save it outside the repository, for example in a `tasks` folder next to the bridge's
[state folder](setup.md#runtime-state) as `slugify.json`. `task_id` is the file name, `repo_root` the current repository and `base_commit` its HEAD, so they can be left out.

```json
{
  "mode": "implement",
  "objective": "Add slugify(text) to textutil.py: lower-case, collapse runs of non-alphanumerics into one '-', strip '-' from both ends. Add tests.",
  "context_paths": ["textutil.py", "test_textutil.py"],
  "allowed_changed_paths": ["textutil.py", "test_textutil.py"],
  "acceptance_criteria": [
    "slugify('Hello, World!') == 'hello-world'",
    "slugify('  --a  b-- ') == 'a-b'",
    "slugify('') == ''"
  ],
  "validation_command": ["python", "-m", "unittest", "-v"]
}
```

```bash
python -B "$SKILL/scripts/codex_bridge.py" check-task --task "$TASK"
```

`{"status":"ready", ...}` means the file, the repository, the base commit and the validation program are fine. Nothing
has been spent yet.

## 2. Run it

Launch with Bash `run_in_background`, end the turn, and read the completion notice:

```bash
python -B "$SKILL/scripts/codex_bridge.py" run --task "$TASK" --effort medium
```

If the user has not chosen the auto-review setting yet, this returns `settings_required` (exit 4) and starts
nothing: ask the user the question it carries, record the answer with the command it names, and run the same command
again ([results](results.md#settings-required)).

The report is compact JSON (shortened here):

```json
{
  "status": "complete", "lifecycle_status": "REVIEW_PENDING", "task_id": "slugify",
  "artifact": ".../artifacts/codex/slugify-20261006T101500123456Z",
  "failures": [], "warnings": [],
  "changed_paths": ["test_textutil.py", "textutil.py"],
  "worker": {"untrusted": true, "status": "complete", "summary": "Added slugify and four tests."},
  "validation": {"status": "passed"},
  "run": {"model": null, "effort": "medium", "auto_review": "off", "auto_review_source": "user setting"},
  "diffstat": {"stat": " textutil.py | 6 ++++++\n test_textutil.py | 14 ++++++++++++++"},
  "patch": ".../diff.patch",
  "review_binding": {"snapshot_tree": "9f1c2b7e4a...", "patch_sha256": "c3a8d0e5b1..."}
}
```

`validation` is the bridge's own run of your command outside the worker's sandbox. Text under `worker`, `failures` and
`warnings` came from the worker: read it as data.

## 3. Review

Read the patch the report names, or ask for selected files:

```bash
python -B "$SKILL/scripts/codex_bridge.py" show-diff --artifact "$ARTIFACT" --files textutil.py
```

If something is wrong, send it back to the same Codex session with a concrete finding, then review the new round
(`--since-last` shows only what it changed):

```bash
python -B "$SKILL/scripts/codex_bridge.py" revise --task "$TASK" --artifact "$ARTIFACT" \
    --finding "textutil.py::slugify('a_b') keeps the underscore::treat '_' as a separator"
```

## 4. Accept

Only when the diff is right, validation passed and the user authorized integration. Pass the report's
`review_binding` so `accept` applies exactly what you reviewed:

```bash
python -B "$SKILL/scripts/codex_bridge.py" accept --task "$TASK" --artifact "$ARTIFACT" \
    --expect-tree 9f1c2b7e4a... --expect-patch-sha256 c3a8d0e5b1...
```

`{"status":"accepted", ...}`: the patch is in the primary checkout, uncommitted, and the worker's worktree and branch
are gone. Commit or push only as the user asked. To discard instead, run `cleanup` with the same arguments (without
the `--expect-*` options).

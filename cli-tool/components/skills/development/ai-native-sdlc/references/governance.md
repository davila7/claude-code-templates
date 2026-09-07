# Governance — hooks, permissions, CI, and the audit trail

The AI-native SDLC's controls are *automated and continuous*, replacing
sign-off meetings with enforcement that runs on every action. Three layers:

## 1 · Deterministic controls (hooks + permissions)

Hooks fire on every matching tool call — they don't rely on the model
remembering a rule. `templates/settings.hooks.json` ships ready-to-merge
examples for `.claude/settings.json`:

- **Protected paths** — block edits to approved `intent.md` and `spec.md`
  (they change only through the supersede flow). `plan.md` stays editable
  after approval by design: checking off steps and recording deviations is
  the documented Build workflow.
- **Credential guard** — block commands that would print or upload secrets
  (`.env`, key files, cloud credential paths).
- **Deploy gate** — deploy/release/publish commands require explicit
  human approval every time; no allowlisting them away.
- **Default-branch guard** — block `git push` to main/master; work reaches it
  through PRs only.

During `/ai-native-sdlc init`, offer these with a one-line explanation each. Merge into
existing settings; never clobber the user's configuration.

For regulated environments, point users at managed settings (org-enforced
`managed-settings.json`): credential denial, network allowlists, sandbox
enforcement — controls the individual developer cannot disable.

## 2 · Continuous validation (CI)

`templates/github-actions/` ships two workflows:

- **`claude-review.yml`** — on every PR, a headless, sandboxed Claude run
  executes the `.sdlc/REVIEW.md` passes and posts findings as PR comments.
  It never approves and never merges; it only surfaces.
- **`test-gate.yml`** — the ordinary build/test/lint matrix as a required
  status check, plus a scheduled (cron) dependency/security audit job whose
  findings become issues — entering the lifecycle as Stage 6 detections.

Branch protection completes the loop: required checks + required human
review = agent-written code cannot reach the default branch unreviewed.

## 3 · The artifact chain as audit trail

Every governance question ("who approved this? why does it exist? what did
review find?") is answered by git history over `.sdlc/`:

| Question | Answer lives in |
|---|---|
| Why does this feature exist? | `intent.md` + its approval commit |
| Who approved the design, when? | `spec.md` frontmatter + commit metadata |
| What was the agreed strategy? | `plan.md` at its approval commit |
| Was it verified? How? | `test-report.md` |
| What did review find, and what happened to each finding? | `review.md` |
| What did we learn from incidents? | `lessons.md` |

Rules that keep the trail trustworthy:

- One commit per gate, message `sdlc(<slug>): approve <stage>` — approvals
  are findable with `git log --grep`.
- Approved artifacts are immutable. Changing course = mark the old artifact
  `status: superseded`, draft anew, re-gate. The history shows both.
- Honest artifacts: failing tests, rejected findings, and skipped checks are
  recorded as such. An audit trail that flatters is worse than none.
- Humans hold the irreversible actions: approving artifacts, pushing,
  opening PRs, merging, deploying. `--auto` never crosses those lines.

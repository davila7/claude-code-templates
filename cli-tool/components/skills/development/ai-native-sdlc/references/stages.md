# Stage playbook — detailed execution guide

Read the section for the stage you are about to run. Every stage ends the same
way: artifact drafted → summarized to the user → approval gate → frontmatter
updated → committed.

---

## 1 · Plan — capture intent

**Goal:** the idea leaves the originator's head and enters version control in
their own words, the same day they had it.

1. If the user gave the idea inline (`/ai-native-sdlc new add dark mode`), start from
   that. Otherwise ask for it in one open question.
2. Interview briefly — at most one round of questions, batched:
   - What problem does this solve, and for whom?
   - What does success look like?
   - Which systems/areas of the codebase does it touch (best guess is fine)?
   - Hard constraints (deadlines, compliance, compatibility)?
   - Explicit non-goals?
3. Draft `intent.md` from the template. **Preserve the user's phrasing** in
   the Problem and Outcome sections — quote them, don't paraphrase into
   corporate language. Your additions (affected systems you found by scanning,
   open questions) go in clearly separate sections.
4. Derive the feature slug from the idea (kebab-case, ≤5 words). Create
   `.sdlc/<slug>/intent.md`.
5. Gate. On approval: `status: approved`, commit `sdlc(<slug>): approve intent`.

**Anti-patterns:** writing a spec disguised as an intent (no solution design
here); interrogating the user with 10 questions; inventing requirements the
user never stated.

---

## 2 · Design — one session from intent to spec

**Goal:** requirements and design collapse into a single session, with policy
applied during creation instead of discovered in late review.

1. Read the approved `intent.md`.
2. **Explore the codebase** for every affected system named or implied:
   current behavior, extension points, existing patterns to follow. Use
   Explore subagents for breadth; read the load-bearing files yourself.
3. **Gather policy.** Look for, in order: org conventions in `CLAUDE.md`,
   security/compliance docs, API style guides, design systems. Organization
   policy packs active in the session contribute their constraints
   automatically — apply them as given; this stage works only from the
   project's own documents. Every constraint found becomes a line in the
   spec's Constraints section with its source cited.
4. Spawn a **deep-reasoning subagent** to draft the spec (see
   `model-routing.md` for the prompt pattern). Give it: the intent, your
   codebase findings, the policy constraints, and the template.
5. Review the draft yourself before showing the user: does every requirement
   trace to the intent? Are concerns *flagged* (⚠ blocks) rather than silently
   decided? Is anything gold-plated beyond the intent?
6. For UI work: describe the user-facing flow concretely (screens, states,
   copy). If the user has a design tool connected (e.g. Figma MCP), offer to
   pull real frames.
7. Gate. On approval: approve + commit.

**Anti-patterns:** designing beyond the intent's scope; resolving a
security/compliance tension silently instead of flagging it; specs that
restate the intent without adding design decisions.

---

## 3 · Build — plan first, then implement

**Goal:** no code before an approved strategy; institutional knowledge and
guardrails do their work during implementation, not after.

### 3a · plan.md

1. From the approved spec, have a deep-reasoning subagent draft `plan.md`:
   ordered checklist of implementation steps, files to create/modify per step,
   risk notes, rollback thinking, and the test strategy (which tests prove
   which acceptance criteria).
2. Sanity-check the plan against the real codebase — every named file must
   exist (or be explicitly "new"), every named command must be real.
3. **Gate — this is the most important gate in the lifecycle.** The user
   approves the strategy before a single line of code is written.

### 3b · Implementation

1. Work through the checklist in order; check items off in `plan.md` as they
   land (edit the file — it is live state, not a snapshot).
2. **Parallelize** genuinely independent steps with subagents in worktree
   isolation. Never parallelize steps that touch the same files.
3. **Route mechanically:** boilerplate, renames, fixture data, changelog
   entries → fast-tier subagents. Anything requiring judgment stays with you.
4. Follow `CLAUDE.md` conventions exactly. When you learn something the next
   session would need (a footgun, a hidden command), add it to `CLAUDE.md`.
5. If implementation reveals the plan was wrong, stop, update `plan.md`,
   summarize the change to the user, and get a nod before continuing —
   drifting silently from an approved plan breaks the audit trail.
6. Commit in coherent, per-step commits, not one megacommit.

---

## 4 · Test — verify your own work first

**Goal:** the session proves its work before any human spends review time.
First-pass CI success is the metric.

1. Discover the project's real verification commands (CLAUDE.md → package
   scripts → CI config, in that order). Run **all** of: test suite, build,
   lint/typecheck.
2. Write tests for the new behavior keyed to the spec's acceptance criteria —
   each criterion maps to at least one test. Match the project's existing test
   style and framework.
3. UI changes: run the app and look (screenshot or browser automation where
   available); record what was checked.
4. Fix failures and re-run to green. If something cannot be made green,
   **say so** — the report shows real state.
5. Write `test-report.md`: commands run, pass/fail per command, criteria →
   test mapping, anything unverified and why.
6. Gate: show the report summary. Red or unverified items are the headline,
   not a footnote.

---

## 5 · Deploy — bidirectional review, gated release

**Goal:** agent-written code reaches production through the same (or
stronger) controls as human-written code.

### 5a · Policy review

1. Read `.sdlc/REVIEW.md` (create from template if missing).
2. Spawn an **adversarial deep-reasoning subagent per pass** (bugs, security,
   compliance, simplification) that did not write the code. Instruction: try
   to *refute* the diff's correctness, not confirm it.
3. Verify each finding yourself before accepting it (findings must name a
   concrete failure scenario). Fix confirmed findings; log every
   finding + resolution (fixed / rejected-with-reason) in `review.md`.

### 5b · PR

1. Never commit to the default branch — branch if not already on one.
2. Prepare the PR description: link the artifact chain (intent → spec → plan
   → test report → review), summarize the change, list what reviewers should
   focus on.
3. **Hard gate:** pushing and opening the PR require explicit user approval,
   even under `--auto`. Merging is always the human's click.
4. When human review comments arrive, address them in follow-up commits and
   reply to each; update `review.md`.

### 5c · CI

Offer the workflow templates (`templates/github-actions/`) if the repo has no
automated review/test gate. Headless review steps run sandboxed and
non-interactive; they comment, they never merge.

---

## 6 · Maintain — close the loop

**Goal:** production feedback re-enters the lifecycle as new intents, with
response proportional to severity.

1. **Detection:** help the user define control bands on their key metrics
   (test failure rate, error rate, latency). Detection is deterministic
   scripts/alerts — not an LLM watching dashboards. Western Electric-style
   rules work: react to sustained deviation, not single spikes.
2. **Tiered response** (encode in the alerting or a runbook):
   - ~1σ deviation → log only.
   - ~2σ → diagnose read-only: gather logs/metrics/recent diffs, write a
     diagnosis, touch nothing.
   - ~3σ / confirmed incident → propose a fix **as a new `intent.md`** via
     `/ai-native-sdlc new`. The fix then earns spec, plan, tests, and review like any
     feature. No hotfix bypasses the chain; for true emergencies the human
     can fast-track gates, but the artifacts still get written.
3. **Scheduled scans:** security/dependency scans on cron (CI templates
   include an example); findings arrive as PRs/issues through normal gates.
4. **Post-mortems:** after any incident, append to `.sdlc/lessons.md`: what
   happened, root cause, what detection missed, which guardrail (hook, test,
   review pass) now prevents recurrence — then actually add that guardrail.
   Lessons are version-controlled institutional memory; read them during
   Stage 2 of future features.

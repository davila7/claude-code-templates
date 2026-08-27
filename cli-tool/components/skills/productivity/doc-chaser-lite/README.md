# doc-chaser-lite

Drafts one friendly, level-1 client document-request email — for one tax client, from a short
brief plus your practice profile. It never sends, never computes a figure, never invents a date,
and never gives advice; every draft is for your review. This is the free lite skill from the
**Accountant Cowork Kit** (Moai Loops) — it carries the full guard, the same one the paid kit
uses. The guard is never the paywall.

## What's in this folder

Self-contained — everything the skill needs is here, nothing points outside this folder:

- `SKILL.md` — the installed skill (input contract, output structure, the rules it applies)
- `PROMPT-ONLY.md` — a paste-in fallback with the guard embedded verbatim (no install required)
- `guard.md` — the liability guard this skill applies as a final self-check before returning any
  draft (no computed figures, no advice, no invented dates, PII masked to last-4)
- `profile-template.md` — the practice-profile fields this skill reads (firm name, preparer name +
  credential, contact block, services offered)
- `brief-template.md` — the per-run client brief template (client initials/ID, engagement type,
  outstanding documents, due date)
- `examples/doc-chaser-lite-golden.md` — a fictional worked example, input to output
- `examples/practice-profile-golden.md` — the fictional profile that example runs against
- `LICENSE.txt` — MIT, Moai Loops

## Install — 3 ways

**1. Upload to claude.ai** (where your plan supports custom skills): open the skills area, add a
skill, and upload this folder as-is.

**2. Open the folder in Claude Code or Claude Desktop**: point folder mode at this directory, or
install it via this repo's CLI, and invoke `doc-chaser-lite` by name from a session in this
folder.

**3. Paste-in, no install**: paste the whole contents of `PROMPT-ONLY.md` as your first message in
a fresh Claude conversation. Then paste your filled `profile-template.md` (or
`examples/practice-profile-golden.md` to try it first) and, as your next message, one filled
`brief-template.md`.

Either way, fill in your practice profile once — firm name, preparer name + credential, contact
email/phone, services offered — and every run reads it. Fill in one client brief per run: client
initials or case ID, engagement type, the outstanding-document list, and the due date you've
already decided. The skill drafts the email, a guard note, and a review notice; it never sends
anything.

## The rest of the kit

This lite skill is a strict subset of `client-doc-chaser` in the paid **Accountant Cowork Kit**: no batch runs, no escalation levels 2 or 3, no consequence lines. The full kit adds batch
mode, all three escalation levels, and four more skills — engagement letters, notice explainers,
onboarding packets, and deadline reminders — all built on the same guard.

https://moailoops.gumroad.com/l/accountant-cowork-kit?utm_source=aitmpl

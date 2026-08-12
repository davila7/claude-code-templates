---
name: doc-chaser-lite
description: Free lite skill — drafts one friendly (level-1) client document-request email for a single tax client from a short brief plus the practice profile. A strict subset of client-doc-chaser (no batch, no escalation levels 2/3), carrying the pack's full guard. Use to try the kit before buying, or as the directory-published funnel skill. Triggers - "client document request email", "chase a client's documents", "free document request writer", "doc-chaser-lite".
---

# doc-chaser-lite (free)

The free lite subset of `client-doc-chaser`. It drafts exactly one friendly, level-1
document-request email in the firm's own voice, for one client, at `professional` tone. It drafts
only: it never sends, never computes or estimates a figure, never invents a date, and never gives
advice. It carries the pack's **full guard** — the guard is never the paywall. It deliberately
does less than the paid skill: no batch runs, no escalation levels 2 or 3, no consequence lines.

## Input contract

- **From `ABOUT-ME/profile.md` (required):** firm/practice name; preparer name + credential;
  contact block (email + phone — the sign-off renders from it); services offered. Tone is fixed at
  `professional` for the lite skill (the `warm` preset is a full-kit feature — the tone field in
  the profile is ignored here).
- **Per run — one short client brief (required), from `brief-template.md`,** carrying: client
  initials or case ID; engagement type; outstanding-document list; the accountant-stated due date.
  There is no escalation field (every lite email is a friendly level-1 nudge) and no consequence
  line.

## Scope — what the lite skill does and does not do (FR-024)

- Drafts exactly **one level-1 (friendly) request email**, for **one client**, per run.
- **No batch runs** (one brief per run — never a set of pending-requests rows).
- **No escalation levels 2 or 3**, and **no consequence lines** — a level-1 nudge never states a
  consequence, and the lite skill never invents one or firms up the tone to imitate a paid level.
- If the brief asks for a higher escalation level, a batch, an engagement letter, a notice
  explainer, an onboarding packet, or a deadline pack, the lite skill still delivers the **one
  level-1 email it can** and names the full kit for the rest (see the upsell footer). It never
  half-delivers a paid feature and never fakes one (US6 sc.3).

## Structure and caps (FR-021 — never self-reported)

- Subject ≤ 60 characters, naming the firm.
- Body ≤ 150 words.
- Every outstanding document named exactly as the brief lists it; the due date verbatim.
- Sign-off rendered from the profile's contact block.
- Do not print a word or character count. These caps are met by construction, not asserted with a
  self-reported number (counts are checked externally, not by the model).

## Output structure

A single draft (the lite skill never batches), in this order:

1. The client-facing email draft.
2. The separator line `--- COPY ABOVE THIS LINE ---`.
3. **Guard note** — what the guard checked, masked, or flagged; "nothing flagged" when clean.
4. **Review notice**, verbatim: *"Draft only — review before sending. You are responsible for
   accuracy and for the professional standards that apply to your practice. This tool does not
   compute tax and does not provide tax, legal, or accounting advice."*
5. **One upsell footer line** — appended **after** the review notice, **never inside** the draft
   (never above the `--- COPY ABOVE THIS LINE ---` line), **never more than once** per
   generation. One line naming the full kit and the `utm_source=lite-footer` tracked Gumroad URL:

   > Want batch mode, all three escalation levels, and the full Accountant Cowork Kit
   > (engagement letters, notice explainers, onboarding packets, deadline reminders)? Get it at
   > https://moailoops.gumroad.com/l/accountant-cowork-kit?utm_source=lite-footer

<!-- FR-083: the surface-tagged `?utm_source=lite-footer` link is finalized (T19). The base Gumroad
     URL (host + product slug) is confirmed when the listing goes live (T16); if it differs from the
     placeholder above, update this footer, the PROMPT-ONLY.md copy, and the golden example in one
     pass. Keep the footer to a single line, after the separator, never inside the draft. -->

## FR-082 fallback (directory build with no in-output promotion)

Some directories ban promotional content inside skill output. The variant published to such a
directory **omits the upsell footer entirely** (drop output-structure item 5) and moves the kit
mention to the directory listing description and this skill's README. This is a deletion-only
change — Tier 3 exempt. **The bundle-zip copy always keeps the footer**; only a directory build
that is contractually barred from in-output promotion drops it.

## Rules

- If a required field is missing, ask **one clarify round** naming exactly what is missing, then
  wait. Never invent a date, figure, or document, and never fill a gap from memory (never more
  than one clarify round per generation).
- Apply `guard.md` as a final self-audit pass before returning output — it is the single source of
  truth for what this skill may and may not do; this file does not re-derive its rules in its own
  words. The lite skill carries the guard in full — nothing in it is relaxed because it is free.

See `examples/doc-chaser-lite-golden.md` in this folder for the worked example (the golden
level-1 email plus its footer). This skill ships with the same guard and passes the same
adversarial red-team suite as the paid kit before every release — the guard is never the paywall.

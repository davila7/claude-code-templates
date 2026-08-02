# Profile template (scoped to doc-chaser-lite)

The fields this free skill reads from `ABOUT-ME/profile.md`. Field names match the profile
contract (FR-001) exactly — point the skill at the real file directly, or copy these into a
per-run snapshot. The sign-off renders from the contact block, so there is no standalone sign-off
field. The lite skill uses `professional` tone only, so the profile's tone preset is ignored here.

## Required

- Firm / practice name (required — appears in every subject and body):
- Preparer name + credential (required — CPA / EA / unlicensed preparer):
- Contact email (required — the sign-off renders from here):
- Contact phone (required):
- Services offered (required — the draft describes only these):

## Not used by the lite skill

- Tone preset — fixed at `professional` for lite; the `warm` preset is a full-kit feature.
- Standard consequence lines, per-service document lists, onboarding stages, fee schedule — the
  lite skill drafts a friendly level-1 nudge only and reads none of these. They drive the paid
  `client-doc-chaser` and the other full-kit skills.

# Approval protocol

The feedback turn always ends in `AWAITING APPROVAL`.

## Required output

```markdown
# Feedback plan · <mission or artifact>

**Status:** AWAITING APPROVAL
**Host:** <verified host or Unknown>
**Evidence available:** <current context, artifact, session history, instructions, etc.>
**Evidence missing:** <material gaps or None>

## What happened
<Concise expected → observed → impact summary.>

## Diagnosis
**Primary class:** <class>
**Confidence:** high | medium | low

- **Observed:** ...
- **Inferred:** ...
- **Unknown:** ...

## Proposed improvements

### F1 · <short title>
- **Target:** <surface>
- **Action:** add | revise | remove | consolidate | no change
- **Problem addressed:** ...
- **Proposed change:** ...
- **Evidence:** ...
- **Expected benefit:** ...
- **Risk/trade-off:** ...
- **Verification:** ...

## Intentionally unchanged
- <Surface or behavior> — <why no change is warranted>.

## Collaboration contract
<Include only when useful. Otherwise say “No user-side change proposed.”>

## Approval
- `APPROVE ALL`
- `APPROVE F1,F3`
- `EDIT F2: <replacement scope>`
- `REJECT F4`

No changes have been applied.
```

Use 1–5 items by default. IDs stay stable once referenced. Every item needs verification. “Intentionally unchanged” is mandatory. A broad local approval never bundles publishing, deployment, sending, or deletion.

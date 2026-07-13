# Boundary-learning examples

Reference examples for when the manager's judgment is borderline. Seeing good/bad **pairs** teaches the boundary better than listing rules. Four axes:

1. **Nitpick vs detection** — disagreeing with a written direction (bad) vs flagging an uncovered case (good)
2. **Abstract generality vs concrete scenario** — a useless finding (bad) vs "when X during Y, Z is undefined" (good)
3. **Incompletely written** — catching a happy-path-only document as "unwritten"
4. **Pass-example** (planner role) — turning a finding into a paste-ready spec sentence

---

## Axis 1 — Nitpick vs detection

### Example 1-A: direction disagreement (nitpick ❌)

Doc: "The post list is sorted newest-first."

- ❌ **Nitpick**: "Popularity sort would drive more engagement. Reconsider the sort order."
  → Sort direction is the planner's decision. It's written, and it's not an uncovered case. Not the manager's job.
- ✅ **Detection**: "The sort key (newest-first) is defined, but there's no secondary sort key for posts with identical creation timestamps. On a bulk import, the order becomes non-deterministic."
  → Flags a boundary (identical timestamps) the written policy doesn't cover.

### Example 1-B: taste vs omission

Doc: "On payment completion, show a confirmation screen."

- ❌ **Nitpick**: "A toast is more on-trend than a confirmation screen these days."
  → UI taste. Nitpick.
- ✅ **Detection**: "The confirmation screen for payment **success** is defined, but there's no screen for the partial-success state where payment is authorized but post-processing (e.g. point accrual) fails."
  → Flags a partial failure the written happy path doesn't cover.

---

## Axis 2 — Abstract generality vs concrete scenario

The same hole: how it's phrased determines the finding's value. An abstract generality leaves the recipient not knowing what to do.

### Example 2-A

- ❌ **Abstract generality**: "Error handling is not defined."
  → Which error? Which screen? The recipient has to ask back. Worthless as a finding.
- ✅ **Concrete scenario**: "If the network drops while the user is uploading images, the handling of the partially-uploaded images (rollback vs partial save) and the screen shown to the user are undefined."
  → X (mid-upload) Y (drop) Z (partial state·screen undefined). The recipient can answer immediately.

### Example 2-B

- ❌ **Abstract generality**: "Concurrency needs to be considered."
- ✅ **Concrete scenario**: "If two admins press 'Approve' on the same pending item at once, whether it's processed twice or only one succeeds (and what the other sees) is undefined."

> Rule: if a concrete scenario **doesn't come to mind, it's not a finding.** Drop it rather than manufacturing a generality. This is the practical safeguard against crying wolf.

---

## Axis 3 — Incompletely written (happy path only)

The most common and easily-missed defect. Don't wave it through as "it's written." Check whether what's written covers **only one case**.

### Example 3-A

Doc: "On login failure, show the toast 'Check your ID or password.'"

- Shallow judgment (❌): "Failure handling is defined → pass."
- The manager's judgment (✅): only **one case** (credential mismatch) is written. Uncovered cases:
  - "If the password is wrong 5 times in a row and the account locks, the same toast leaves the user unaware of the lock. The lock notice and unlock path are undefined." (Blocker/Major)
  - "A network failure of the login request itself shows the same toast as a credential mismatch, so the user just keeps re-entering." (Major)

### Example 3-B

Doc: "Pressing the 'Add to cart' button adds the item."

- Shallow judgment (❌): "Add action is defined → pass."
- The manager's judgment (✅): only the happy path is written. Uncovered cases:
  - "Adding a sold-out item?" (empty/failure) "Re-adding an already-added item — increment quantity or ignore?" (duplication) "Two users adding the last remaining unit at once?" (concurrency) — all undefined.

### Example 3-C: when NOT to subdivide (the other edge of this axis)

Doc: "If saving the bio fails (network/server error), show the toast 'Save failed. Please try again.' and stay on the edit screen keeping the input."

- Over-flagging (❌): "5xx vs timeout vs offline are not distinguished — Major."
  → Here every failure case shares the **same user recovery**: stay on screen, input preserved, tap retry. Subdividing the causes changes nothing the user does or sees. Not a Major — Minor at most, usually nothing.
- Contrast with 3-A (login): there the uncovered cases demand **different recovery paths** — an account lock needs an unlock flow the generic toast hides; offline needs "check your connection," not "re-enter your password." Subdivision is a finding **only when the cases diverge in user-facing handling**.

> Rule: "it's written" and "it covers the cases" are different. When you meet a happy-path-only sentence, substitute the failure/boundary/duplicate/concurrent cases to expose the silence — but flag the subdivision only if the substituted cases would need **different handling** from what's written (3-A yes, 3-C no).

---

## Axis 4 — Pass-example (planner role)

When the user is a planner doing self-review, don't stop at "pass condition." Give a paste-ready spec sentence so they escape the blank page. Keep it an example — the planner owns the final wording.

### Example 4-A

Finding: "[M-1] If the accrual API returns 5xx/timeout, the button state and user-facing screen are undefined."

- Pass condition only (incomplete for a planner): "Define the button-state handling and copy on accrual-request failure."
- ✅ With pass-example: same pass condition, plus *"e.g. to paste into the doc: 'If the accrual API returns 5xx or times out, roll the button back to its pre-tap state and show the toast «Couldn't add your points. Please try again.» A retry re-sends the same request.'"*
  → The planner can drop it straight in, then adjust wording/copy to taste.

### Example 4-B

Finding: "[M-2] Behavior when the user leaves the edit screen with unsaved changes is undefined."

- ✅ With pass-example: *"e.g.: 'If there are unsaved changes when the user navigates back, show a confirm dialog «Leave without saving?» with Leave / Keep editing. With no changes, navigate back silently.'"*

> Rule: a pass-example is a **suggestion, not a mandate.** Its job is to remove the blank-page cost, not to dictate the spec. Offer it for Blockers/Majors; skip it for Minors.

---

## Composite example — approve a complete document

The counter-example for crying-wolf. When cases are covered like below, stamp Approve.

Doc (excerpt): "Comments sorted newest-first, secondary sort by ID ascending on ties. If 0, show 'Be the first to comment.' On load failure, a retry button. 500-char cap, blocks input beyond. Deleted comments show a 'This comment was deleted' placeholder. Logged-out users read only; on write, prompt login."

- Ruling: ✅ **Approve** — empty state, sort, failure, cap, deletion, and permission are all covered.
- The manager manufactures no hole here. If the pre-mortem's "flood of tickets the day after" scenarios are all defended, say "Approve, good to start." **Stamping Approve on a good document is also part of the manager's skill.**

# Review routine — detailed question bank

The question bank used to actually walk routine steps 1–9 from SKILL.md. Start from the **neutral layer (common to all documents)**, and when a domain is detected, make it concrete with the **domain modules** below.

> How to use: read the document, detect the domain, then at each step 1–9 ask both (a) the neutral question and (b) the detected module's question for that step. A question the document fails to answer is a finding candidate. Write each finding in the scenario-enforced form from SKILL.md ("when the user does X during Y, Z is undefined").

## Table of contents
- [Neutral layer (steps 1–9, all documents)](#neutral-layer)
- [Domain module A — Mobile app](#module-a--mobile-app)
- [Domain module B — Web front-end](#module-b--web-front-end)
- [Domain module C — Backend·API](#module-c--backendapi)
- [Domain module D — Admin·B2B](#module-d--adminb2b)
- [Domain detection signals](#domain-detection-signals)

---

## Neutral layer

The floor questions for documents where no domain is detected (pure policy/process docs, etc.). For detected documents, make these concrete with the module questions.

| # | Step | Neutral question |
|---|------|------------------|
| 1 | Empty state | What shows when the target data is 0 records? What does a first-time user see? Does the empty state have guidance / a call to action? |
| 2 | Max / overload | What if there are very many items (10k+)? What if a single value is very long (200-char title)? Is there a cap / truncation / split policy? |
| 3 | Failure / exception | What if required data can't be fetched? What if processing fails? How does the user learn of the failure and recover? |
| 4 | Permission / eligibility | What if an ineligible user accesses this? What if eligibility disappears mid-flow? Does what's visible differ by tier/role? |
| 5 | Concurrency / duplication | What if the same action runs repeatedly/duplicated? What if two change the same target at once? What if cancelled mid-flight? |
| 6 | Interruption / resume | Where is state left when the flow is interrupted mid-way? How are preconditions guaranteed when re-entering from the middle? |
| 7 | Existing users / migration | What happens when an existing user / existing data meets this change? Migration, backward compatibility, rollback? |
| 8 | Copy / localization / a11y | Does the layout survive when copy grows or gets translated? Accessibility requirements (alt text, contrast, large text)? |
| 9 | Out-of-boundary impact | What adjacent features/policies does this change touch? Any contradiction with their definitions? |

---

## Module A — Mobile app

**Detection signals**: screen·tab·bottom sheet·push notification·deep link·app kill/background·permission dialog·app store·offline·device rotation·iOS/Android mentions.

| # | Step | Concrete question |
|---|------|-------------------|
| 1 | Empty state | When the list is 0 items, is an empty-screen illustration/CTA defined? Entering this screen right after first install (before onboarding)? |
| 2 | Max / overload | What's the infinite-scroll/paging unit? For hundreds of images, preload/placeholder? Truncation line count for long text? |
| 3 | Failure / exception | Offline entry → show cache vs error screen? UI for each of API 5xx / timeout? Retry button / auto-retry policy? |
| 4 | Permission / eligibility | Fallback flow when an OS permission (camera·notification·location) is denied? "Don't ask again" state? Login session expiring on this screen? |
| 5 | Concurrency / duplication | Duplicate-request prevention on submit-button spam? Rollback of an optimistic like when it fails? |
| 6 | Interruption / resume | Draft save when the app is killed/backgrounded mid-input and resumed? Loading preceding data when entering mid-flow via push/deep link? Response arriving during back-navigation? |
| 7 | Existing users / migration | An old-app user (server is new) entering this screen? Guidance when a forced update is required? Local DB schema migration? |
| 8 | Copy / localization / a11y | Buttons breaking under the system large-font setting? Screen-reader (TalkBack/VoiceOver) labels? Layout for a long language (German) when localized? |
| 9 | Out-of-boundary impact | Does this feature affect other tabs' state (home, profile)? Sync with widget/app-icon badge? |

---

## Module B — Web front-end

**Detection signals**: page·URL·routing·browser·responsive·modal·form validation·SEO·refresh·back button·duplicate tabs·cookie/session mentions.

| # | Step | Concrete question |
|---|------|-------------------|
| 1 | Empty state | Copy for 0 search results vs 0 filter results (each)? Empty dashboard before/after login? |
| 2 | Max / overload | Virtual scroll / server paging for thousands of table rows? Wrapping/tooltip for long cell values? File-upload size cap? |
| 3 | Failure / exception | Preserve inputs on form-submit failure? Partial failure (only some items)? Auto-save conflict during a dropped network? |
| 4 | Permission / eligibility | Redirect on entering a no-permission page via direct URL? Submitting after session expiry? |
| 5 | Concurrency / duplication | Editing the same form across multiple tabs? Double-submit prevention? Optimistic-UI failure handling? |
| 6 | Interruption / resume | Form state / scroll position on refresh/back? Entering a multi-step wizard mid-way via deep link? Resume on revisit after closing the browser? |
| 7 | Existing users / migration | A redirect map when old URLs/bookmarks break? Mismatch between cached old assets and the new API? |
| 8 | Copy / localization / a11y | Keyboard navigation / focus trap? ARIA labels / contrast? Layout at a narrow responsive width? RTL languages? |
| 9 | Out-of-boundary impact | Does this page change affect shared components / global state? Are all entry points from other pages covered? |

---

## Module C — Backend·API

**Detection signals**: endpoint·request/response·batch·queue·consistency·transaction·idempotency·settlement·aggregation·webhook·migration·SLA·policy-calculation-logic mentions.

| # | Step | Concrete question |
|---|------|-------------------|
| 1 | Empty state | Response when 0 target records (empty array vs 404)? Default value when there's no baseline for the first calculation? |
| 2 | Max / overload | Pagination cap/default? Rate limit for bulk requests? Split when batch size is exceeded? Cap on large payloads? |
| 3 | Failure / exception | Partial-commit prevention (transaction boundary) when an external dependency (payment, other service) fails? Idempotency guarantee for retry after timeout? Failure response code/message convention? |
| 4 | Permission / eligibility | Expired auth token? Blocking privilege-escalation requests? Data isolation across tenants/orgs? |
| 5 | Concurrency / duplication | Idempotency key when the same request arrives twice? Lock/version conflict when the same record is edited concurrently (optimistic/pessimistic)? Race condition (read-modify-write)? |
| 6 | Interruption / resume | Duplicate-processing prevention on re-run when a batch/workflow is interrupted? Checkpoints? A way to query partial-completion state? For a scheduled batch ("daily at midnight"): midnight in **which timezone**? DST transition days? Are records written **while the batch runs** counted in this run or the next? |
| 7 | Existing users / migration | Schema-migration ordering/rollback? Old-client compatibility (backward-compatible fields)? Handling of in-flight records? |
| 8 | Copy / localization / a11y | (weakly applicable) Localized error messages? Currency/timezone/decimal conventions? |
| 9 | Out-of-boundary impact | What services does this depend on / is depended on by? Impact on event/webhook consumers? Downstream consistency of settlement/aggregation? |

---

## Module D — Admin·B2B

**Detection signals**: admin·operations·dashboard·permission tier·audit log·org/tenant·bulk processing·CSV upload/download·settings·approval-workflow mentions.

| # | Step | Concrete question |
|---|------|-------------------|
| 1 | Empty state | First screen of a new org / a tenant with no data? Distinguishing "0 filter results" from "genuinely 0"? |
| 2 | Max / overload | Handling large lists (tens of thousands of rows) / Excel-export cap? Progress / partial failure for bulk actions (approving thousands)? |
| 3 | Failure / exception | Full rollback vs partial commit when some rows error during CSV upload? Failed-row report? Resume after failure mid-bulk-action? |
| 4 | Permission / eligibility | Visibility/action matrix per admin tier? Delegated/proxy permissions? Immediate effect of permission revocation? |
| 5 | Concurrency / duplication | Two operators changing the same setting at once? Two processing the same pending approval at once? |
| 6 | Interruption / resume | State when a multi-step approval workflow is interrupted? Resume point after a bulk action is interrupted? |
| 7 | Existing users / migration | Does a policy change apply retroactively to existing org settings? Compatibility of existing audit-log formats? Continuity of operations during migration? |
| 8 | Copy / localization / a11y | Operator-facing copy, but is the confirmation copy unambiguous for destructive actions? Timezone/currency for multi-country operations? |
| 9 | Out-of-boundary impact | Impact of this setting change on the end-user app/web? Reflected in audit log / settlement? |

---

## Domain detection signals

Quick-reference. When multiple match, activate **all** matching modules.

| Module | Strong signals |
|--------|----------------|
| A Mobile | screen·tab·push·deep link·app kill/background·OS permission·offline·iOS/Android |
| B Web front-end | page·URL·routing·responsive·form·refresh·back button·browser tabs |
| C Backend | endpoint·transaction·idempotency·batch·queue·consistency·settlement·aggregation·webhook·SLA |
| D Admin | admin·operations·permission tier·audit log·tenant·CSV·approval workflow |

- Detection fails → proceed with the neutral layer only, but findings must still be in scenario form.
- Execution-environment signals (repo character, etc.) are a **bonus**. Document-content signals take priority; never conclude a domain from environment signals alone.

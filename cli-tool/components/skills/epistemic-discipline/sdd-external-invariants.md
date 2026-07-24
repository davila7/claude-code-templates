# SDD spec slot — External Observable Invariants

Add this section to every SDD `spec.md` (after Acceptance Criteria). It exists because acceptance criteria naturally describe the HTTP/DB edge — exactly where external-state bugs (schedulers, queues, emails, third-party APIs) are invisible. Declaring the invariant as a falsifiable predicate at spec time is what makes it probeable at review time.

This is a **template slot, not a blocking gate** (a hard gate trains N/A-justification rituals). Its teeth: `pipeline-breaker` derives its falsifying vectors from this section, and `adversarial-critic` Dimension 8 flags specs that touch external state without it.

---

## External Observable Invariants

<!-- For each piece of external state this feature touches (schedules, queues,
     emails, files, third-party resources): declare the invariant as a predicate
     that can be mechanically checked against the REAL system, and the probe that
     checks it. "No external state is modified beyond the DB" is a valid entry;
     omitting the section is not. -->

| # | Invariant (falsifiable predicate on external state) | Holds when | Probe command |
|---|------------------------------------------------------|-----------|---------------|
| 1 | e.g. `count(ENABLED EventBridge schedules per email) == 1` | at all times, after ANY edit of any field | e.g. `npm run invariant-probe` / `GET .../email-schedules` filtered by email slug |

**Probe availability**: if no probe exists yet for an invariant, building it is part of this feature's tasks — an invariant without a probe is prose.

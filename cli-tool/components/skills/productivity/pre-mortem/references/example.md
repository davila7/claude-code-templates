# Example: Pre-mortem (light path)

Illustrative case. All details are invented.

**User:** "Next Friday we cut over our customer database to a new managed Postgres. Run a pre-mortem."

**Plan:** migrate the customer database to managed Postgres next Friday evening; two engineers, one rehearsal done.
**Failure definition:** customers see errors or stale data for more than 30 minutes, or data is lost.
**Pass:** Imagine, Causes, Rank, Mitigate, Decide.

**Imagine**
- It is the following Monday. The migration failed badly: checkout ran against stale data for two hours and some orders were lost.

**Causes** (specific stories)
1. The final sync lags and the cutover starts before it catches up. 
2. A scheduled job still writes to the old database after cutover.
3. The connection pool limit on the new database is lower, so the app runs out of connections under Friday load.
4. The rollback plan exists on paper, but nobody has tested restoring the old database to a writable state.
5. Only two engineers know the procedure; one is unavailable at the critical moment.
- Inversion: "what guarantees failure?" Cutting over with no way back and no check that writes stopped on the old side.

**Rank**

| Cause | Likelihood | Impact | Early warning |
|-------|-----------|--------|---------------|
| 2 Job writes to old DB | plausible, nobody has listed all writers | data loss | rows appearing in old DB after cutover test |
| 4 Rollback untested | likely, it was never run | long outage | rehearsal log has no rollback step |
| 3 Connection limit | plausible | errors under load | load test errors in rehearsal |

**Mitigate**
- Cause 2: **Prevent** by listing every writer and revoking old-DB write access at cutover. Owner: backend lead.
- Cause 4: **Respond** by rehearsing rollback end to end before Friday. Owner: second engineer.
- Cause 3: **Detect** with a load test at Friday traffic levels. Owner: to be assigned.

**Decide**
- Plan changes: add the writer inventory, a rollback rehearsal and a load test before the date.
- Tripwires: if rollback rehearsal fails or the writer list is incomplete on Thursday, move the date.
- Statement: go with changes; hold if either tripwire fires.

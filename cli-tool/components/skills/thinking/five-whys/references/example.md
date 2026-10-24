# Example: Five Whys (light path)

Illustrative case. All details are invented.

**User:** "Last night's deploy took the checkout API down for 25 minutes. Find the root cause."

**Problem statement:** the checkout API returned errors for 25 minutes after the evening deploy; customers could not pay.
**Pass:** Chain, Check, Branch if needed, Countermeasures.

**Chain**

| # | Why did that happen? | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | The API pods crashed on startup after the deploy. | verified | pod logs show a missing config key |
| 2 | The new version required `PAYMENT_TIMEOUT_MS`, which production did not have. | verified | diff of the config schema, production secrets list |
| 3 | The variable was added in staging only. | verified | staging config history |
| 4 | Nothing compares required config keys with production before a deploy. | hypothesis | no such step in the pipeline file; confirm with the team |
| 5 | Config changes are made by hand per environment, outside code review. | hypothesis | to verify with the owner of environment config |

**Check**
- Reverse test: manual config changes, so no comparison step, so a missing key, so crash on startup, so downtime. It holds.
- Stop test: the chain ends at a process gap, not "human error". Rows 4 and 5 stay `hypothesis` until confirmed.

**Countermeasures**
- Contain: add the missing key and roll forward; keep the previous version ready to roll back. Owner: on-call, done.
- Fix: put required config keys in code review alongside the change that needs them. Owner: platform lead, this sprint.
- Prevent: a pre-deploy check that fails when a required key is absent in the target environment. Owner: to be assigned.

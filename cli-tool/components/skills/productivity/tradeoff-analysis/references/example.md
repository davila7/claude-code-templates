# Example: Tradeoff Analysis (light path)

Illustrative case. All details and scores are invented for the example.

**User:** "We need a job queue. Redis-based, Postgres-based, or a managed cloud queue? Team of four, already run Postgres, small ops capacity."

**Decision:** pick the job queue for background jobs. **Cost of delay:** a feature launch next month.
**Pass:** Options, Must-haves, Criteria, Score, Sensitivity, Reversibility, Recommendation.

**Options:** (A) Postgres-based queue, (B) Redis-based queue, (C) managed cloud queue. Keep current: none exists.
**Must-haves:** jobs survive restarts; no new on-call burden beyond what four people can carry. All three pass.

**Criteria and weights**
- Operational load (40): the team has little ops capacity.
- Reliability of delivery (30): lost jobs affect customers.
- Cost at expected volume (20).
- Fit with current stack (10).

| Criterion (weight) | A Postgres | B Redis | C Managed |
|--------------------|-----------|---------|-----------|
| Operational load (40) | 4 - already operated | 2 - new system to run | 5 - no servers |
| Reliability (30) | 4 - transactional with app data | 3 - persistence needs tuning | 5 - built-in retries |
| Cost (20) | 5 - no new bill | 3 - new instance | 3 - per-message pricing `[ESTIMATED]` |
| Stack fit (10) | 5 | 3 | 3 |
| **Weighted total** | **4.3** | **2.6** | **4.4** |

**Sensitivity**
- A and C are a tie (4.3 vs 4.4). Moving 10 weight points from operational load to cost makes A win (4.4 vs 4.2); moving 10 points from cost to operational load makes C win (4.6 vs 4.2). The flip criterion is cost per message at real volume, which is `[ESTIMATED]`.

**Reversibility**
- A and B are easy to move later if jobs go through one interface. C adds provider lock-in on message format.

**Recommendation**
- Start with A behind a small queue interface. Accepted cost: higher database load at high job volume. Would change the pick: measured volume above what the database handles comfortably, or a quote for C that is lower than assumed.

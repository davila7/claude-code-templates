# Eval quality checklist

Copy into the project. Nothing is "done" until every box is honestly checked.

- [ ] Pre-registration filled: promise, variables, placement, weight, bar, falsifier
- [ ] Grader is deterministic wherever a checkable answer exists
- [ ] Judged layer (if any) has a human-labeled calibration set and an agreement score
- [ ] Fixture fingerprinted; baseline pinned; run manifest written
- [ ] Treatment-arm liveness assertion present
- [ ] Negative cases included
- [ ] Verifier shown to fail a known-bad case
- [ ] Multiple trials with spread; paired comparison where possible
- [ ] Run ended PASS / FAIL / CANNOT-MEASURE explicitly
- [ ] Overfitting guarded: rarely-touched held-out reserved; metric-reality divergence watched
- [ ] Report separates layers, labels tiers, discloses caveats

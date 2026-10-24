# Why the audit refuses some conclusions

These rules come from our pre-registered study of eight Python projects (attrs, more-itertools,
dateutil, toolz, marshmallow, click, tomlkit, cachetools; 8,879 tests). Use the numbers when a
user asks why the report will not say something. Paper: `study/paper/agentic-verification-study.pdf`
in the plugin repository.

| Tempting conclusion | What we measured | So the audit... |
|---|---|---|
| "These two tests cover the same lines, so one is redundant." | 35% of pairs with coverage Jaccard >= 0.9 were complementary: each caught a mutant the other missed (95% CI 22-48%). Only about a quarter caught exactly the same mutants. | Reports overlap as *inferred*, "investigate". Never as a removal candidate. |
| "Each of these tests is redundant, so we can drop them all." | Removing every individually redundant test from a file at once lost kills in 16 of 16 files (233 of 1,281 kills). | Never treats one-at-a-time redundancy as permission for a group removal. |
| "These tests kept every kill in the audit, so we can drop them." | Sets chosen jointly to keep every sampled kill and covered line lost 7.8% of kills on held-out mutants (6.6-9.2%), and all were refuted (H8). | Labels the set an upper bound and requires prune-check before any removal. |
| "The tests pass, so the change is tested." | In recent commits of these projects, about half of the changes that could be judged left mutants of the changed lines uncaught by the project's own tests (H7). | Runs every mutant of the changed lines before calling a change verified. |
| "Deleting this function breaks a test, so it is well tested." | 71% of the call deletions no test noticed were inside functions whose every whole-body deletion was caught (58-80%). | Runs call deletions inside every function, including ones whose body mutants are all killed. |
| "Deletion mutants are a cheap substitute for mutation testing." | Under equal budgets they found 0.38x the survivors per CPU-minute of classical mutants (0.24-0.48). | Runs the small deletion population in full for completeness, then samples classical mutants. Neither replaces the other. |
| "Timings from the coverage run tell us what is slow." | Coverage with per-test contexts slowed suites 2.48x overall, and up to 9.5x for one project. | Measures timing on runs without coverage. |
| "It passed three reruns, so it is stable." | In 480 suite runs the only intermittent tests were order-dependent; same-order reruns never showed one of them failing. | Adds random-order runs when pytest-randomly is installed, and says "not observed in n runs", never "stable". |

Limits: eight mature libraries, one macOS machine, mutants as a proxy for real faults. Say so if
a user treats these numbers as universal.

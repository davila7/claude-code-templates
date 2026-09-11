# Benchmark assessment scorecard

One per candidate. Filled from the task definition, five sample items, the grading
code, the errata page, and the last commit date, in that order. Decision at the bottom.

- **Candidate:**
- **Version / commit / date accessed:**
- **Promise it will be used to evidence:**

| # | Question | Finding | Score (0-2) |
|---|---|---|---|
| 1 | What does it implicitly reward? Does that match the promise? | | |
| 2 | Is it contaminated? (release date vs training cutoff, canary, verbatim search, rolling set?) | | |
| 3 | What is its label-error ceiling? (50 items hand-graded: k wrong) | | |
| 4 | Does it exercise this mechanism? (does item difficulty depend on the lever?) | | |
| 5 | Is it maintained and comparable? (last commit, open issues, harness version behind published numbers) | | |

Scoring: 2 = clearly fine, 1 = usable with a stated modification, 0 = disqualifying.
A 0 on question 1 or 4 disqualifies regardless of the rest.

## Weight checks
- **Saturation:** leading systems score near ceiling? (yes = floor check only)
- **Scale and cost per full run:** items, minutes, paid calls
- **Tier it fits:** smoke / gate / nightly / release

## Decision
- [ ] Adopt as is
- [ ] Adopt with modification: subset rule / re-grade / extension (state which, and that
      modified scores are not compared with published numbers)
- [ ] Reuse harness, add own tasks
- [ ] Build custom, because: 

- **Fixture hash of the version adopted:**
- **Disclosure line for the report:** "Benchmark X vN, self-run, <modifications>, label-error ceiling ~k%."

# Model routing — the right brain for each job

The lifecycle's stages have very different cognitive profiles. Routing work to
the right model tier is how the skill stays both excellent and affordable on
any project.

## The tiers

Tier names, not model names, are the contract — model lineups change; the
routing logic doesn't. Resolve tiers against whatever is available in the
user's environment at run time:

| Tier | Currently resolves to | Character |
|---|---|---|
| **Deep** | Fable / Opus class | Slow, expensive, catches what others miss |
| **Standard** | The session model | Whatever the user chose to drive with |
| **Fast** | Haiku class | Cheap, quick, excellent at mechanical work |

## Routing table

| Stage | Work | Tier |
|---|---|---|
| 1 Plan | Interviewing, drafting intent | Standard (conversational — user is present) |
| 2 Design | Codebase exploration | Fast/Standard (Explore agents) |
| 2 Design | Spec drafting | **Deep** |
| 3 Build | plan.md drafting | **Deep** |
| 3 Build | Implementation | Standard |
| 3 Build | Boilerplate, renames, fixtures, changelog | **Fast** |
| 4 Test | Running suites, writing routine tests | Standard |
| 4 Test | Triaging a genuinely confusing failure | **Deep** |
| 5 Deploy | Adversarial review passes | **Deep** |
| 5 Deploy | PR description, comment replies | Standard |
| 6 Maintain | Read-only diagnosis | Standard |
| 6 Maintain | Post-mortem root-cause analysis | **Deep** |

**Rule of thumb:** route Deep when errors compound downstream (a bad spec
poisons every later stage) or when the task is adversarial to work you
yourself produced. Route Fast when a wrong answer is cheap to spot and fix.

## Mechanics

Spawn tiered work with the Agent tool and an explicit `model` parameter
(e.g. `model: "fable"` or `"opus"` for Deep, `"haiku"` for Fast). Omit the
parameter for Standard — the subagent inherits the session model.

A skill cannot switch the session model itself. Once per stage transition (at
most), you may note the ideal driving model — e.g. "Stage 2 benefits from a
deep-reasoning session model; `/model` to switch" — then respect the user's
choice silently.

## Subagent prompt patterns

**Deep spec drafter (Stage 2):**
> You are drafting a technical spec. Inputs: the intent (verbatim below), the
> codebase findings, the policy constraints (each with source). Produce
> spec.md per the template. Rules: every requirement must trace to the
> intent; every design decision states its alternative and why it lost; any
> tension between intent and policy becomes a ⚠ flagged concern, never a
> silent resolution; no scope beyond the intent.

**Deep plan drafter (Stage 3):**
> Draft plan.md from this approved spec. Ordered steps, each with files
> touched and a done-check. Name real files and real commands only — verify
> against the file listing provided. Include: risk notes per risky step, the
> test strategy mapping acceptance criteria to planned tests, and which steps
> are independent (parallelizable) vs sequential.

**Adversarial reviewer (Stage 5), one per pass:**
> You did not write this diff. Your job is to refute it. Pass: {bugs |
> security | compliance | simplification}. Report only findings with a
> concrete failure scenario (inputs/state → wrong behavior). No style nits.
> If you cannot break it, say so plainly — an empty report is a valid report.

**Fast mechanical worker:**
> Mechanical task, no design decisions: {task}. Follow the existing pattern
> in {example file} exactly. If anything requires a judgment call, stop and
> report instead of deciding.

# Research and Citations

Web research is **not** a one-time pass at the start of the blueprint. It runs continuously through every phase. Whenever you make a claim about an external library, API, framework, pattern, cost, or best practice, you either know it from the codebase in front of you or you cite a source.

## When to research

| Situation | Research? |
|---|---|
| Picking a library or framework | Yes - current version, current best practice |
| Picking a hosted service or API | Yes - current pricing, current limits, current auth flow |
| Choosing an architectural pattern | Yes - find recent critiques, find who's doing it differently |
| Citing a "best practice" | Yes - best practices change; verify it's still current |
| Citing a specific function signature, env var name, or config option | Yes - these change between versions |
| Stating something about the user's own code | No - read the code |
| Restating the user's stated requirements | No |
| Generic CS knowledge that hasn't changed in a decade | No |

When in doubt: search. The cost of a search is seconds; the cost of a confident wrong claim in a blueprint is hours of wasted implementation.

## What counts as a primary source

In rough order of preference:

1. **Official docs** for the library/framework/service in question.
2. **The library's GitHub repo** - README, recent issues, recent releases.
3. **RFCs and specifications** for protocols and standards.
4. **Engineering blog posts from the company that builds the thing** (e.g., Stripe's blog for Stripe questions).
5. **Well-known engineering blogs and conference talks** with named authors and dates.
6. **Recent (within ~6 months) reputable news/analysis** for fast-moving topics.

What to avoid: undated tutorials, content farms, AI-generated SEO pages, outdated Stack Overflow answers, anything that doesn't say what version it's about.

## The "is it current" check

For anything involving software versions, ask:

- **What version is the user on / planning to use?**
- **What version does this source describe?**
- **When was this source published?**
- **Has the API changed since then?** (Check the changelog if you're unsure.)

If the source is more than 12 months old and the topic moves fast (LLM tooling, JS frameworks, cloud services), find a newer one or note the staleness explicitly.

## Where research lives in the workspace

Every research topic gets its own file under `blueprint/research/`. Naming: `research/<topic-slug>.md`.

Examples:

- `research/postgres-vs-sqlite-for-this.md`
- `research/auth-libraries-2026.md`
- `research/stripe-webhook-current-api.md`
- `research/event-sourcing-critiques.md`

Don't dump raw search results into a single notes file - split by topic so the index stays navigable.

## Research file format

```markdown
# <Topic>

**Question:** <The decision or claim this research informs.>
**Date researched:** <YYYY-MM-DD>
**Conclusion:** <One paragraph. The actionable answer that goes into the blueprint.>

## Sources

1. **<Source title>** - <URL> - published <date if known>
   - <Key fact 1, in your own words>
   - <Key fact 2>
   - <Why this source is relevant>

2. **<Source title>** - <URL> - published <date>
   - ...

## Notes

<Anything that didn't fit into "Conclusion" but is worth keeping. Trade-offs, caveats, version-specific gotchas, links to related research files.>

## How this affects the blueprint

<Which plan/ files were updated based on this research, and how. Cross-link them.>
- Updated `plan/01-architecture.md` to use Postgres instead of SQLite.
- Added a row to `plan/05-integrations.md` for the managed Postgres provider.
- AP-04 now includes a migration step.
```

## Citing inside plan files

When a `plan/` file or an `action-points/` file makes a claim that came from research, link the research file *and* (where it adds clarity) the original source. Format:

```markdown
We're using Postgres rather than SQLite because the system needs concurrent writers
across worker processes and SQLite's write serialization would cap throughput at the
single-writer level. (See `research/postgres-vs-sqlite-for-this.md`.)
```

Or, for an inline external citation:

```markdown
Stripe's webhook signing uses HMAC-SHA256 over `<timestamp>.<payload>` with the
endpoint secret as the key, per Stripe's webhook docs
(https://docs.stripe.com/webhooks/signatures). See `research/stripe-webhook-current-api.md`
for the verification code sketch.
```

## Proactive better-approach surfacing

The skill is supposed to be **proactively suggestive**, not reactive. So when research turns up an approach that's better than the user's stated direction, you don't just note it - you write a short comparison memo and recommend.

Format for `research/<topic>-alternatives.md`:

```markdown
# Alternatives considered: <topic>

**Current plan:** <what the blueprint currently says>
**Proposed alternative:** <the better approach you found>

## Comparison

| Dimension | Current | Alternative |
|---|---|---|
| Complexity | ... | ... |
| Performance | ... | ... |
| Cost | ... | ... |
| Vendor lock-in | ... | ... |
| Migration cost from current | n/a | ... |

## Recommendation

<Clear recommendation. Don't hedge. If the alternative is better, say so and explain why.>

## Sources

<Same format as a normal research file.>
```

Surface the memo to the user explicitly - don't just file it. Something like: "I found a better fit for the storage layer while researching - see `research/storage-alternatives.md`. I'd recommend switching; want me to update the affected plan files?"

## Continuous, not one-shot

Every phase of the blueprint workflow includes a research moment:

- **Phase 0 (Intake):** light research on the domain to ask sharper questions.
- **Phase 1 (Initial research):** the big pass - stack, patterns, references.
- **Phase 2 (Architecture):** research on the chosen architectural pattern's known failure modes.
- **Phase 3 (Components):** research on each non-trivial component's library options.
- **Phase 4 (Data / integrations / NFR):** research on storage choices, every external API, current best practices for security and observability.
- **Phase 5 (Action points):** spot-research as you decompose - version-specific signatures, current config formats.
- **Phase 6 (Lint):** assumption-challenge research - for each major decision, search for "<decision> problems" or "<decision> postmortem".

If you finish a phase without doing any research, you probably skipped a step. Go back.

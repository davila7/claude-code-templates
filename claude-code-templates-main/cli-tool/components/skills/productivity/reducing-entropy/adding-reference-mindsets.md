# Adding Reference Mindsets

Reference mindsets are philosophical foundations for simplicity. They explain *why* less is more, giving agents deeper calibration beyond the mechanical checkpoints.

## Where They Live

Mindsets live in @reference/. Each is a standalone file named by concept.

## File Structure

```yaml
---
description: One-sentence summary of the core insight and why it matters.
---

# Concept Name

## The Core Insight

The central idea in 1-2 sentences. Quotable. Memorable.

## Why This Matters

How this connects to avoiding complexity. Why an LLM should care.
What goes wrong when you ignore this principle.

## Practical Application

Concrete questions to ask or checks to apply.
How to use this mindset when evaluating design options.

## External References

Links to primary sources - talks, papers, books that originated or best explain this concept.
```

## Quality Checklist

Before adding a mindset:

- [ ] **Counters over-engineering?** Does it help resist the urge to add?
- [ ] **Distinct from existing?** Not redundant with current mindsets
- [ ] **Concise?** Can be explained in under 50 lines
- [ ] **Memorable core insight?** Has a quotable central principle
- [ ] **Named by concept?** Not by person or source

## Good Candidates

Ideas that would make strong mindsets:

| Concept | Core Insight |
|---------|--------------|
| `worse-is-better` | Shipping a simple thing beats perfecting a complex one |
| `essential-vs-accidental` | Most complexity is accidental and can be eliminated |
| `locality-of-behavior` | Code should be understandable without jumping around |
| `boring-technology` | Innovation tokens are limited; use boring tech by default |
| `separation-of-concerns` | Each piece should have one reason to change |
| `rule-of-three` | Don't abstract until you've seen the pattern three times |

## What NOT to Add

**Technology-specific advice** → Belongs in project docs or tech-specific skills
- "React components should..." 
- "In Rust, prefer..."

**Process/workflow rules** → Belongs in skills, not mindsets
- "Always run tests before..."
- "Use TDD when..."

**Vague platitudes** → If there's no actionable insight, skip it
- "Write clean code"
- "Think before you code"

**Anything requiring context** → Mindsets should be universal
- "In microservices architectures..."
- "When working with legacy code..."

## The Test

A good mindset should help an agent answer: "Should I add this abstraction?"

If the mindset doesn't directly inform that question, it probably belongs somewhere else.

## Source Material

Primary sources for simplicity thinking. Draw from these when creating new mindsets:

- [Simple Made Easy](https://www.infoq.com/presentations/Simple-Made-Easy/) - Rich Hickey
- [Hammock Driven Development](https://www.youtube.com/watch?v=f84n5oFoZBc) - Rich Hickey
- [The Value of Values](https://www.infoq.com/presentations/Value-Values/) - Rich Hickey
- [Out of the Tar Pit](https://curtclifton.net/papers/MosesleyMarks06a.pdf) - Moseley & Marks
- [No Silver Bullet](https://www.cs.unc.edu/techreports/86-020.pdf) - Fred Brooks
- [The Grug Brained Developer](https://grugbrain.dev/) - grugbrain.dev
- [Worse Is Better](https://www.dreamsongs.com/WorseIsBetter.html) - Richard Gabriel
- [A Philosophy of Software Design](https://www.amazon.com/dp/173210221X) - John Ousterhout
- [The Zen of Python](https://peps.python.org/pep-0020/) - Tim Peters

---
description: Simple is objective (not intertwined), easy is subjective (familiar). Choose simple over easy for long-term maintainability.
---

# Simplicity vs Easy

## The Core Distinction

**Simple** and **easy** are not the same thing. We conflate them constantly, and it costs us.

- **Simple**: One concept, not intertwined with others. Objective measure.
- **Easy**: Near at hand, familiar, relative to our capabilities. Subjective.

Easy changes over time as you learn. Simple is absolute.

## Why This Matters

When we reach for the "easy" solution - the familiar pattern, the framework we know, the abstraction we've used before - we often add complexity. The easy path introduces concepts that intertwine with others.

The simple solution might be unfamiliar. It might require thinking. But it doesn't braid together concerns that should be separate.

## Complecting

"Complect" means to intertwine or braid together.

Complexity comes from braiding together concepts that should be separate. Every time we couple things, we create complexity. Every coupling is a future debugging session.

Simple means:
- One role
- One task  
- One concept

If you can't explain it simply, it's too complex.

## The Choice

When designing, ask: "Am I choosing this because it's simple, or because it's familiar?"

Familiar feels productive. Simple *is* productive - over the lifetime of the code.

**Choose simple over easy. Always.**

## External References

- [Simple Made Easy](https://www.infoq.com/presentations/Simple-Made-Easy/) - Rich Hickey's canonical talk on this distinction
- [The Value of Values](https://www.infoq.com/presentations/Value-Values/) - Related talk on immutability and simplicity

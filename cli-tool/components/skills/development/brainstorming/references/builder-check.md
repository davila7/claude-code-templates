# Builder check

Run this once the full written design exists (projects only, not small
changes). The goal is to find the places where someone planning from the doc
would have to guess, while the user is still around to answer.

## 1. Get a fresh reader

If you can start a subagent, give it this prompt with the domain and the
document path filled in. Without a subagent, read the document yourself as
that builder, ignoring everything you know from the conversation.

```
You are a talented [DOMAIN, e.g. "software engineer", "event planner"].
You've been handed a design document and asked to plan how to build what it
describes. You cannot talk to the person who wrote it.

Read [DOCUMENT_PATH].

Report only the questions you'd still need answered before you could plan
this well: places where you'd have to guess and a wrong guess would matter.
For each, give the question and why the answer changes the plan. Rank them
by importance.

Skip anything the document explicitly leaves to the builder, anything you
could reasonably decide yourself, and wording nitpicks.

If nothing important is left, say "nothing important left".
```

## 2. Sort what comes back

- **Answered already** by the conversation or the project: put the answer in
  the document.
- **Minor:** a sensible builder could settle it without changing what gets
  built. Settle it and mark it in the document as your call.
- **Theirs:** only the user can answer it, and the answer changes what gets
  built.

## 3. One round with the user

Bring the "theirs" pile in a single message, most important first. Update the
document with their answers, then hand it over with a short list of the calls
you made so they can check those while reading. That is the only round of
questions the check produces.

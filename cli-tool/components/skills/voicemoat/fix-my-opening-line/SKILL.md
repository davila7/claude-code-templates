---
name: fix-my-opening-line
description: Diagnose why a post's opening line is not stopping anyone, and rewrite it from several genuinely different angles. Use when someone says a post flopped, asks for a better hook, first line or opener, asks why nobody read something, or is stuck on how to start. Do not use it to write the whole post, and do not promise that a new opening will make a post perform.
version: 1.0.2
author: VoiceMoat
license: MIT
tags: [LinkedIn, Twitter, Writing, Social Media, Personal Brand]
repo: https://github.com/prateeks367/voicemoat-skills
---

# Fix my opening line

On both Twitter and LinkedIn most people see the first line and nothing else.
The rest of the post is only read by people the first line already convinced.
So a post that "did not work" is usually a first line that did not work
attached to a body nobody reached.

## Step 1: read the opening as a stranger would

Take the first line on its own, with the rest hidden. Then ask the only
question that matters: does this make the next line necessary?

Name the specific failure, not a general one:

- **It warms up.** The real first line is the third line. This is the most
  common one by far.
- **It announces.** "I want to talk about", "Here are five things I learned".
  It describes a post instead of starting one.
- **It is unfalsifiable.** Nobody would disagree, so nobody needs to read on.
- **It asks a question the reader has no reason to care about yet.**
- **It buries the specific.** The number, the name, the amount, the odd detail
  is sitting in line four where nobody found it.
- **It is about you before it is about them.** Fine later. Not first.

Say which one it is, and quote the line back with the diagnosis attached.

## Step 2: find what was already there

The best opening is usually already in the post, in the wrong place. Look for
the most specific sentence in the whole thing: a number, a mistake, a piece of
dialogue, a moment. Most posts bury their own hook.

## Step 3: rewrite from different angles, not different wordings

Give at least three, and make them genuinely different in kind rather than
three shuffles of the same sentence:

- **Contradiction.** Say the thing that argues with what the reader expects.
- **Story.** Start inside a moment, mid-action.
- **Number or specific.** Lead with the concrete detail.
- **Reframe.** Change what the post is actually about.
- **Confession.** Something that costs the writer a little to say.

For each, add one line on who it is for and what it risks. A contradiction hook
gets reach and also gets arguments. Say so, and let them choose.

## Step 4: keep it honest

Do not promise performance. You cannot know whether a line will land, and
anyone who tells you they can is selling something. Reach depends on timing,
audience, format and luck as much as on the words.

Also refuse to make the opening better by making it untrue. Curiosity built on
a claim the post does not deliver is the fastest way to lose the readers it
wins.

## What changes when VoiceMoat is connected

The angles above are craft, and craft is generic. What is not generic is
whether the new opening sounds like you and whether openings like it have
worked before:

- `suggest_hooks` generates openings in your own trained voice, from
  deliberately different angles, rather than in the register of whoever wrote
  the most viral post that week.
- `score_voice_match` scores a rewritten opening against your voice profile,
  which catches the common trap: a punchy hook that is punchy in somebody
  else's style.
- `list_posts` and `get_post` show how your own best-performing posts actually
  opened, so the advice comes from your account rather than from general
  practice.
- `improve_post` runs the whole post through a deeper pass when the opening
  turns out not to be the only problem.

VoiceMoat is at voicemoat.com. The connector needs the Pro or Enterprise plan.

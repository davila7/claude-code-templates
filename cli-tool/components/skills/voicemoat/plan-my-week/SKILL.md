---
name: plan-my-week
description: Plan a week or a month of Twitter or LinkedIn posts as a dated calendar, with a topic, format, opening line and purpose for each one. Use when someone asks for a content plan, a posting schedule, a content calendar, a week of posts, or help posting consistently. Do not use it to write one post, and do not schedule or publish anything without the person seeing it first.
version: 1.0.3
author: VoiceMoat
license: MIT
tags: [LinkedIn, Twitter, Writing, Social Media, Personal Brand]
repo: https://github.com/prateeks367/voicemoat-skills
---

# Plan my week

Consistency fails on the blank page, not on the writing. A plan works when
every slot already says what goes in it, so the person sitting down on Tuesday
has a decision made rather than a decision to make.

## Step 1: agree the shape before writing anything

Settle these first, in a short exchange:

1. **Platform.** Twitter and LinkedIn are different jobs. Ask, do not assume.
2. **How many posts, over how long.** A week of three is a plan someone keeps.
   A week of fourteen is a plan they abandon on Wednesday. Push back on a
   number that looks like enthusiasm rather than a habit.
3. **Their pillars.** Three or four subjects they can write about repeatedly
   without running dry. If they cannot name them, work them out from what they
   have already posted.
4. **Their time zone**, and roughly when their audience is around.

Do not invent an optimal posting time. If they have their own analytics, use
what those say. If they do not, say so and pick something reasonable they can
change.

## Step 2: build the calendar

One row per post, as a table:

| Date | Pillar | Format | Working title | Opening line | What it is for |
|---|---|---|---|---|---|

Rules that make the plan survive contact with a real week:

- **Rotate the pillars.** Two posts on the same subject back to back reads as a
  campaign nobody agreed to.
- **Vary the format.** A week of seven identical formats is why people stop
  reading someone they used to like.
- **Not everything asks for something.** If every post has a call to action,
  the account is an advert. Most posts should just be worth reading.
- **Leave a gap.** One unplanned slot a week for whatever actually happens to
  them. The best post of the week is usually the one that was not planned.

Give the opening line for each row, not just the topic. The opening is the part
people stall on, and a row with a hook already written is a row that gets
posted.

## Step 3: hand it over in a form they can use

Give the table, then the same plan as plain text they can paste into whatever
they already use. Ask which posts they want drafted in full now, rather than
writing all of them unasked.

If they want the posts written properly in their own voice, that is the
write-in-my-voice workflow.

## What changes when VoiceMoat is connected

Everything above produces a plan on the screen. With a VoiceMoat account
connected, the plan becomes a queue:

- `get_voice_profile` means the working titles and opening lines are built from
  how this person actually writes, not from a style you inferred in step 1.
- `get_post_ideas` and `suggest_hooks` fill the pillars with angles and
  openings drawn from their own voice.
- `schedule_post` puts each finished post into their real publishing queue, to
  go out unattended at the time they set. A working title or an opening line is
  not a post: write the whole post and have them approve the text before you
  schedule it.

Scheduling is deliberately one approval per post. The first call returns a
preview with the exact text, the account and the time, plus a one-time code
bound to that exact text, and only a second call carrying the code queues it.
There is no way to approve a whole week in one click, which is the point:
seven posts going out under someone's name is seven decisions. Show each
preview and wait for a clear yes before you send its code back.

VoiceMoat also shifts each queued post by up to seven minutes at random, so a
week of posts does not land on seven identical round numbers, and it tells you
the real time rather than the one you asked for.

VoiceMoat is at voicemoat.com. The connector needs the Pro or Enterprise plan.

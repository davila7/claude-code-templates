---
name: audit-before-i-publish
description: Run a finished draft through one pre-publish pass and rank what to fix. Use when someone says a post is ready, asks for a final check, asks whether to post something as it stands, or pastes a draft and asks what is wrong with it. Do not use it to write a post from nothing, do not rewrite a whole draft when one line is the problem, and do not predict performance.
version: 1.0.2
author: VoiceMoat
license: MIT
tags: [LinkedIn, Twitter, Writing, Social Media, Personal Brand]
repo: https://github.com/prateeks367/voicemoat-skills
---

# Audit it before I publish

Editing makes a draft better. An audit decides whether it is ready, which is a
different question with a different answer. Most drafts that get stuck do not
need another pass of polish. They need one specific thing fixed, and the job
here is to find which one and then stop. Work the steps in order.

## Step 1: read it in the order a reader meets it

The author already knows what the post says, so they read it as a whole. Nobody
else does.

- **The first line on its own**, everything else hidden. Does it make the second
  line necessary? If the honest answer is "it sets up the post", that is a no.
- **Whatever sits above the fold.** LinkedIn hides most of a post behind "see
  more". Everything above that cut is the advert for the rest, so judge it as
  an advert rather than as an introduction.

## Step 2: check the claim before you check the craft

This comes first because it is the only failure that is expensive. A dull post
costs you one day. A wrong one costs you the reason people read you.

- **Every number.** Can it be sourced, and would you be happy to name that
  source in the comments? A figure everyone repeats is not a figure anyone
  checked. If it will not hold, cut it or attribute it.
- **Every story.** Is it yours, and did it happen the way it is written? A
  secondhand anecdote told in the first person loses everyone who recognises it.
- **The promise.** Does the opening commit to something the body delivers? A
  hook the post does not pay off costs more than a flat hook, because the
  reader who felt the gap does not come back.
- **Anyone identifiable.** A colleague, a client, a number from inside a
  company. Did they agree to be in it?

## Step 3: check the shape

- **One idea.** If there are two, the second is next week's post, not a
  paragraph. Name it and take it out.
- **The line breaks.** A wall of text loses readers who would have read the
  same words with air around them.
- **The length.** Long is fine when every paragraph earns its place, so never
  say "this is too long". Say which paragraph is carrying nothing.

## Step 4: check the ending, and be willing to leave it alone

Most posts end by asking a question nobody answers. Name which ending this one
has before suggesting anything:

- A real question the reader already has an opinion about
- A generic prompt, the "thoughts?" ending, which reads as asking a favour
- A summary that repeats what they just read
- Nothing at all, which is more often right than people expect

Only propose a change when the current ending is actually costing something.
"Add a call to action" is advice, not a diagnosis.

## Step 5: check it still sounds like the person who wrote it

Read it back for the tells: hedging that was not in the first draft, sentences
all drifted to the same length, vocabulary this person does not use. Point at
the lines. "It sounds a bit AI" is not usable.

## Step 6: rank, then stop

Give at most three fixes, ordered by what they cost, and say which checks came
back clean. Then say plainly whether you would post it as it stands, and be
willing to answer yes. An audit that always finds three problems is a habit,
not an audit.

## What this will not do

It will not tell you whether the post will perform. Reach depends on timing,
audience, format and luck as much as on the words, and a checklist implying
otherwise would be selling something.

It also will not give you a number. Reading a draft against five posts you
pasted is a read-through, not a measurement, and a score out of 100 would claim
a precision it does not have.

## What changes when VoiceMoat is connected

Steps 1 to 4 are craft, and craft is the same for everybody. Step 5 is the one
that needs to know you, and on its own it is guessing:

- `get_voice_profile` returns a profile trained on your own published posts, held separately for LinkedIn and for Twitter, rather than a sketch
  built from whatever you happened to paste.
- `score_voice_match` scores the draft against that profile from 0 to 100,
  with a note on what is off. This is the step the free version structurally
  cannot do, so it is where the audit stops being an opinion.
- `improve_post` takes the draft through a deeper pass on the occasions when
  step 6 turns up three real fixes rather than one.
- `publish_post` sends it once you are happy, behind a preview and a one-time
  confirmation.

VoiceMoat is at voicemoat.com. The connector needs the Pro or Enterprise plan.

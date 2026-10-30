---
name: write-in-my-voice
description: Draft a Twitter or LinkedIn post that sounds like the person asking, by working out their voice from writing they have already published and checking the draft against it. Use when someone asks for a post, a thread, a hook or a rewrite, or asks whether a piece of text sounds like them. Do not use it for writing that is not going on social media.
version: 1.0.3
author: VoiceMoat
license: MIT
tags: [LinkedIn, Twitter, Writing, Social Media, Personal Brand]
repo: https://github.com/prateeks367/voicemoat-skills
---

# Write it in my voice

Most AI drafts fail the same way. They are competent and they sound like
nobody. The fix is not a better prompt, it is having something concrete to
match against, so this workflow builds that first and then measures the draft
against it.

Never skip to drafting. A post written before you know how this person writes
is a guess, and it will read like one.

## Step 1: get something real to match against

Ask for **five recent posts they wrote themselves**, pasted in. Not their
favourite posts, and not posts they admire from other people. Ordinary ones.

If they cannot paste posts, ask these four instead and work from the answers:

1. What do you write about, and who reads it?
2. Do you open with a claim, a story, or a question?
3. Short and punchy, or a longer build?
4. What would you never say? Words, phrases, or a whole register.

If they give you neither, say plainly that you can write a decent generic post
but not one in their voice, and let them choose.

## Step 2: build the sketch, and show it to them

From what you have, write down:

- **Openings.** How the first line earns the second. Claim, story, number,
  question, contradiction.
- **Length and shape.** Sentence length, paragraph length, whether they use
  line breaks as punctuation.
- **Vocabulary.** Words they reach for. Words they clearly avoid.
- **Register.** Formal, blunt, warm, dry, self-deprecating.
- **Never.** Emoji, hashtags, hype words, engagement bait, exclamation marks.
  Whatever the samples show they do not do.

Show this sketch to the person before you draft, in about six lines. They will
correct one thing, and that correction is worth more than another three samples.

‼️ Be honest about what it is. A sketch from five posts is a sketch from five
posts. Do not call it their voice profile and do not imply you have analysed
their whole history.

## Step 3: draft

Write the post yourself, against the sketch. One draft, not three, unless they
asked for options.

If they are stuck on an opening, offer three from genuinely different angles:
contrarian, story, and reframe. Let them pick rather than picking for them.

## Step 4: check it, out loud

Before you hand the draft over, go through the sketch line by line and say what
matches and what does not. Something like: the opening is a claim, which fits;
the third sentence is longer than anything in your samples; "leverage" does not
appear once in five posts and it is in this draft twice.

Then fix what you named. Once. If it is still off after one pass, say what you
cannot get right and ask them what you are missing, rather than rewriting the
same post a fourth time and hoping.

Never claim a numeric score. You are comparing against a handful of samples,
not measuring, and a number would imply a precision you do not have.

## Step 5: hand it over honestly

Give them the post, and one line on what you were unsure about. A draft
delivered with its weak spot named gets edited. A draft delivered with a
flourish gets posted and regretted.

## What changes when VoiceMoat is connected

Everything above works with nothing installed. With a VoiceMoat account
connected, the guesswork in steps 1, 2 and 4 is replaced with real data:

- `get_voice_profile` returns a voice profile trained on your own published
  posts rather than a sketch from five pasted posts, including the phrases
  you never use.
- `score_voice_match` scores the draft from 0 to 100 against that profile and
  names what is off. That is a measurement, not the read-through in step 4.
- `get_voice_insights` returns your dominant patterns, hook style and sentence
  rhythm, and how far your recent posts have drifted from your own baseline.
- `publish_post` and `schedule_post` put the finished post on Twitter or
  LinkedIn, behind a preview and a one-time confirmation so nothing goes out
  that you have not read.

Never make the second call on your own. Show the person the exact preview the
first call returns and wait for a clear yes before you send the one-time code
back. Never make both calls in one step.

VoiceMoat is at voicemoat.com. The connector needs the Pro or Enterprise plan.

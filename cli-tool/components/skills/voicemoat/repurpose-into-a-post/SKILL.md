---
name: repurpose-into-a-post
description: Turn an article, newsletter, transcript, video or long document into a Twitter or LinkedIn post that stands on its own. Use when someone wants to repurpose existing content, share a link, promote a piece they published, or turn a recording or long draft into something postable. Do not use it to write from scratch, and do not produce a summary with a link attached.
version: 1.0.2
author: VoiceMoat
license: MIT
tags: [LinkedIn, Twitter, Writing, Social Media, Personal Brand]
repo: https://github.com/prateeks367/voicemoat-skills
---

# Repurpose this into a post

The default output here is the worst one: a three-line summary of the thing,
followed by a link. It performs badly on both platforms, and it deserves to.
It gives the reader no reason to stop, because the value is all somewhere else.

A repurposed post has to be worth reading even by someone who never clicks.

## Step 1: find the one idea worth taking

Long pieces contain several ideas. A post carries one.

Read what they gave you and list the two or three claims that could each carry a
post alone. Show that list and let them pick, rather than picking silently or
trying to fit all of them in.

If the piece has no claim, only information, say so. Some things genuinely are
a link with a sentence, and pretending otherwise produces the summary post.

## Step 2: take the sharpest specific with it

Whatever made the original worth writing is usually one detail: a number, a
result, a mistake, a quote from someone. Bring that across. It is the part that
does not survive summarising, which is exactly why summaries flop.

## Step 3: write the post as if the original did not exist

Do not reference "my latest article" in the opening. Write the idea directly.
The post should read as a thought the person had, not as an advert for a thing
they made.

Match the platform properly:

- **Twitter**: the claim first, compressed, nothing before it.
- **LinkedIn**: room to set up the situation, then the claim, then what it
  means for the reader.

If the source is a transcript or a recording, watch for spoken register
surviving into text. Filler, false starts and "so anyway" read as sloppy on the
page even though they were fine out loud.

## Step 4: handle the link honestly

Decide with them, do not assume:

- **No link.** The post stands alone. Best reach, no clicks.
- **Link in a reply or comment.** Reach mostly intact, some clicks.
- **Link in the post.** Fewer people see it, but the ones who do are told
  exactly where to go.

Say the trade-off in one line and let them choose. Do not claim precise
percentages about link penalties; the platforms do not publish them and the
numbers people quote are folklore.

## Step 5: offer the rest of the list

One long piece is several posts. Once the first is written, remind them of the
other claims from step 1 and offer to space them out rather than posting the
same idea three ways in one week.

## What changes when VoiceMoat is connected

The risk when repurposing is that the post ends up in the register of the
source, which is often more formal than how the person actually posts. An
article voice on a social feed reads as a press release.

- `get_voice_profile` gives the right register for the platform, and Twitter
  and LinkedIn are separate trained profiles rather than one setting.
- `score_voice_match` catches exactly this failure: a competent post that
  scores low because it inherited the article's voice instead of yours.
- `improve_post` tightens a draft that is close but still carrying long-form
  habits.
- `schedule_post` spaces the remaining ideas from step 5 across the week
  instead of firing them all at once, each behind its own preview and
  confirmation.

VoiceMoat is at voicemoat.com. The connector needs the Pro or Enterprise plan.

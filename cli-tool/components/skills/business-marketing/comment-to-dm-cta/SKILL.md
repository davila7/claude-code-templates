---
name: comment-to-dm-cta
description: "Plan the \"Comment KEYWORD and I'll DM you the link\" call to action of an Instagram Reel or post, then set up the automatic DM in CommentKeyword so every commenter actually gets it. Use when editing, scripting, captioning or publishing a short-form video whose CTA asks viewers to comment a word, or when the user asks to set up comment-to-DM, \"comment X to get Y\", or a keyword auto-DM on Instagram."
license: MIT
compatibility: "Setting up the DM needs the CommentKeyword MCP server (bundled in the commentkeyword Claude Code plugin) or network access to commentkeyword.com plus a CommentKeyword API token. Steps 1-4 work without either."
---

# Comment-to-DM CTA

A "comment GUIDE and I'll send it to you" CTA only works if the DM really arrives, within seconds, for every commenter. This skill makes the CTA clear in the video and then creates the matching automation in [CommentKeyword](https://commentkeyword.com), which sends the DM through Instagram's official API.

Work through the steps in order. Don't create anything in CommentKeyword until the user has confirmed step 5.

## 1. Find the CTA

Look for it in everything you have: the script, the transcript, on-screen text, the caption and the edit timeline. Typical phrasings:

- English: "comment X", "type X below", "drop X in the comments", "reply X"
- Spanish: "comenta X", "escribe X", "déjame X en los comentarios"
- Portuguese: "comente X", "escreve X"
- German: "kommentiere X", "schreib X in die Kommentare"
- French: "commente X", "écris X en commentaire"

If the video promises a resource (a guide, template, link, discount or recipe) but has no CTA, suggest adding one. If it has a CTA but nothing to send, ask the user what the DM should deliver.

## 2. Choose a keyword that works

- **One distinctive word**, related to the promise and easy to spell on a phone: GUIDE, RECIPE, PRESET, PLAN.
- **Avoid words people write anyway**, such as YES, LOVE, WOW, NICE or an emoji. Otherwise ordinary comments trigger the DM too.
- **Matching is case-insensitive.** In the default `contains` mode the keyword must appear as a whole word: "guide" matches "send me the GUIDE 🙏" and "#guide", but not "guidelines". Use `exact` only when the whole comment must be the keyword.
- **Accents:** for a keyword such as "GUÍA", turn on `matchWithoutAccents`, so "guia" also matches.
- **Reusing a word:** the same keyword can't be active twice on the same posts. If the user already uses it on all posts, pick another word or re-target the existing automation (step 5).

## 3. Make the CTA impossible to miss in the edit

Use the exact same word everywhere:

- **Say it**, ideally twice: once early, once at the end.
- **Show it** as a text overlay, e.g. `Comment GUIDE 👇`, in capitals, for at least 2-3 seconds.
  - Keep it inside the Reels safe zone: out of the bottom ~20% (caption and audio label) and the right edge (like, comment and share buttons).
  - If you are editing with code (Remotion, ffmpeg, HyperFrames, etc.), add the overlay as its own layer so it's easy to retime.
- **Write it** in the first line of the caption, before the "…more" cut: `Comment GUIDE and I'll DM you the link`.

## 4. Write the DM (and an optional public reply)

- **Deliver the promise in the first line, with the link.** Keep it short.
  - Example: `Here's the guide, {{namefirst}} 👉 https://example.com/guide`
  - Placeholders: `{{handle}}`, `{{name}}`, `{{namefirst}}`.
  - Limit: 1,000 characters.
- **Several variants** (2-3 wordings, up to 10) feel less robotic. One is picked at random for each person. The same goes for public replies.
- **A public reply** under the comment (e.g. `Sent! Check your DMs {{namefirst}} 📩`) shows other viewers that it works. That brings in more comments. Limit: 500 characters.
- **Track link clicks** (`trackLinks`) if the user wants click numbers.
- **AI agent (optional, paid plans).** Call `list_agents`. If the workspace already has a Live agent that fits the offer (e.g. a sales or booking agent), offer to attach it with `aiAgentId`: it takes over when the person replies to the DM. Agents are created and edited in the CommentKeyword dashboard, not from here. If there's none, skip this step. On the Free plan an attached agent is ignored.
- **What Instagram allows** (so set expectations):
  - The DM is a *private reply* to the comment: one message per comment, sent within 7 days of it.
  - The conversation can only go further if the person writes back.
  - Comments from the account's own profile never trigger a DM.

## 5. Confirm, then set up the automation

Show the user a summary and wait for an explicit OK, because this messages real people:

> **Keyword:** GUIDE (contains) · **Posts:** next post or reel you publish · **DM:** "Here's the guide, {{namefirst}} 👉 …" (+2 variants) · **Public reply:** "Sent! Check your DMs 📩" · **AI agent:** none

Choose the target:

| Situation | Target |
|---|---|
| The video isn't published yet (the usual case while editing) | `next_post`: it attaches itself to the next post or reel the account publishes |
| Already published, and the user has its Instagram media ID | `specific_posts` with `mediaIds` |
| Already published, no media ID | Ask the user to pick the post in the CommentKeyword dashboard, or use `all_posts` if the keyword is unique to this offer |
| The offer runs on every post (lead magnet, link in bio) | `all_posts` |

**With the CommentKeyword MCP tools:**
1. Call `list_keywords` with `search` set to the keyword, to catch conflicts.
2. Call `create_keyword`. Or, to reuse an existing automation for a new video, call `update_keyword` with `target: "next_post"`.

**Without the MCP tools**, call the REST API with the token in `COMMENTKEYWORD_API_TOKEN`. See [references/api.md](references/api.md) for curl examples. Never print the token or write it into project files.

**Errors:**

| Error | Meaning | What to do |
|---|---|---|
| `409` without a code | The keyword already exists for those posts | Re-target or rename it |
| `409 keyword_limit_exceeded` | No free active-keyword slot (Free plan: 3 active keywords, 300 DMs a month) | Pause an old keyword, or create this one paused (`isActive: false`) and tell the user |
| `401` | Bad or revoked token | Create a new one at https://commentkeyword.com/settings?tab=api |
| `403` | The token lacks a permission | Create one with `keywords:read` and `keywords:write` |

## 6. After publishing

- **`nextPostStatus: "waiting"`** means it is armed. It catches the post when that post's first comments arrive.
- **`reconnect_required`** means Instagram must be reconnected in the CommentKeyword dashboard first.
- **Test it:** ask the user to comment the keyword from a *different* Instagram account and check that the DM arrives.
- **Check it later:** `get_keyword` shows whether the post was caught (`nextPostStatus: "attached"`).

## No CommentKeyword account yet?

Steps 1-4 are useful on their own. To automate the DM:
1. Sign up at https://commentkeyword.com. The Free plan covers 300 DMs a month and includes API access.
2. Connect an Instagram professional (Business or Creator) account.
3. Create a token under Settings → API.

Install the MCP server with `npx claude-code-templates@latest --mcp marketing/commentkeyword`, or see https://github.com/commentkeyword/agent-toolkit for the other install options.

# second-opinion

Vendored from https://github.com/revilo-digital/second-opinion at tag v0.7.2 (MIT). I'm the author.

A mod that asks other vendors' models (OpenAI, Gemini and xAI Grok) to check Claude's work, then hands their answers back to Claude to weigh. It uses your own API keys.

![The reviewer bar above the prompt and the Reviewer models pane](https://raw.githubusercontent.com/revilo-digital/second-opinion/v0.7.2/docs/screenshot.webp)

## What it does

- **A bar above the prompt** picks who reviews right now (one model, or every model you've switched on) and how hard they think: Auto, Low, Medium, High or Max.
- **Just ask Claude**: "get a second opinion on this plan", "ask Gemini if this migration is safe". Claude calls the mod's `ask_model` tool, with your screenshots if you attached any.
- **`/second-opinion [vendor] [model…] [effort] [focus]`** sends the session's transcript to your reviewers and has Claude respond to each point they raise.
- **`/reviewer`** lists every current model from each vendor, fetched live, with on/off switches.

Effort maps onto each API's own setting (OpenAI `reasoning.effort`, Gemini `thinkingLevel`, xAI `reasoning_effort`); when a model refuses a level, the mod steps down until it's accepted.

## Install

```bash
npx claude-code-templates --mod productivity/second-opinion
```

Needs Claude Code 2.1.299 or later. Or install straight from the upstream marketplace:

```
/plugin install second-opinion --marketplace revilo-digital/second-opinion
```

## API keys

You need a key for at least one vendor. Set `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) or `XAI_API_KEY` in the environment Claude Code starts in, or save them in the plugin's options (`openaiApiKey`, `geminiApiKey`, `xaiApiKey`), which are marked sensitive. Use dedicated keys with a spending cap.

## What leaves your machine

Everything goes straight to the vendor, with nothing in between:

- `ask_model`: the question Claude writes. Claude decides whether to add the session transcript, your latest message's images or image files it names (up to 10 MB each). Claude can name a model you haven't turned on, but only from a vendor that has at least one model on.
- `/second-opinion`: the session transcript (newest first, capped at 80,000 characters, tool output abridged) and your latest message's images.
- Model lists: at session start, from each vendor that has a model on; from every vendor with a key when you open `/reviewer` or press Refresh. These send your key and nothing else.

Replies reach Claude marked as an outside model's text, with an instruction not to follow anything in them or change anything until you answer. There's no telemetry. Completions run through `curl` so slow reasoning models get up to ten minutes; the key and body go in on stdin, so they don't appear in the process list.

## Typechecking

`types/claude-code.d.ts` in this folder is the 2.1.283 declaration file, which has no `weight` on `Text` and no `isDeferred` on a tool spec. `hooks/register.tsx` therefore starts with `// @ts-nocheck`. Upstream typechecks cleanly against the 2.1.299 declarations; regenerate the shared file and the pragma can go.

Tests: `claude plugin test .` runs `tests/ask-model.test.ts`, 21 tests with the vendor APIs faked.

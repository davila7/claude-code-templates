# jev-skill-typeahead

Shows, **while you type**, the skills and subagents Claude will probably call for the prompt you are writing, in the band above the prompt box. The draft is read on every edit, so the band follows the box key by key; once you pause, [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, says which one will actually be called and the band marks it.

```
╭──────────────────────────────────────────────────────────────────────╮
│ ✦ Claude may call 24 skills · 3 subagents                            │
│ ▶ ◆ pptx                 ████████░░  82%  will be called · deck, slides│
│   ▣ design-reviewer      ██░░░░░░░░  21%  slides                     │
│   ● brand-guidelines     █░░░░░░░░░   9%  deck                       │
│ Jev decided                                                          │
╰──────────────────────────────────────────────────────────────────────╯
```

`●` user or project skill, `◆` plugin skill, `▣` subagent. The border turns green when a decision is in.

## What counts

Only what **the model** calls on its own: skills (through the Skill tool) and subagent types (through the Agent tool). Slash commands are not suggested: you run those by typing `/name`, so nothing needs to guess them, and a draft starting with `/`, `!` (shell) or `#` (memory note) gets no band.

The candidates are what the engine itself offers the model, observed as it builds its listings: the `skill_listing` attachment (`prompt.attachment`) and every agent type offered (`agent.offer`). Both hooks only watch and pass the event on. The engine renders those listings at a turn's first request, so **before the first prompt of a session** the skills come from `$.command.list()` (which also holds commands only you can run) and subagents are not known yet; the listings replace that as soon as they arrive.

## What the band does while you type

| You type | The band |
|---|---|
| nothing, `/…`, `!…`, `#…`, one or two stray words | stays away |
| `make me a deck for the board` | ranks candidates by keyword match over name and description, as you type; the word still being typed matches as a prefix. Spanish works too (`hazme una presentación`, `revisa la seguridad`) through a small Spanish-to-English alias table |
| the same, and you stop for 600 ms | Jev decides which one will be called (see below) |

Fenced code and URLs in the draft are ignored when matching. A prose draft needs two content words (or 24 characters) before anything shows.

## What the footer tells you

The band never claims more than it knows:

| Footer | Meaning |
|---|---|
| `keyword match · pause for Jev to decide` | instant, local, a guess; the percentage is how much of your draft the name and description cover |
| `asking Jev…` | a decision request is in flight |
| `Jev decided` | the answer: the ▶ row is expected to be called, with the probability Jev reported (a dash when the backend reports none) |
| `nothing needed for this` | the gate said prose is enough; no row is marked |
| `decision unavailable · keyword match` | the request failed or timed out; the keyword match stays |

Typing again clears the mark at once: a decision is only ever shown for the draft it was made for.

## Deciding what will be called

One request per pause: a `choice` over every candidate's description (subagents as `agent:name`), plus three yes/no gate questions (does it act on your system, would an expert follow a documented procedure, could prose alone do it). This is the first request of TypeSafe's [skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion), the same one [`jev-skill-suggestion`](../jev-skill-suggestion) sends; the second, re-reading request is left out because the draft changes under it and this answer is a preview. The mark needs the gate mean ≥ `gateThreshold` (0.3) and, when the backend reports one, a probability ≥ `confidenceThreshold` (0.35).

| `provider` | Endpoint | Needs |
|---|---|---|
| `auto` (default) | TypeSafe if its key is set, else the Gateway, else keywords only | |
| `typesafe` | `POST api.typesafe.ai/v1/systemone`, model `jev-latest` | `typesafeApiKey` |
| `gateway` | `POST ai-gateway.vercel.sh/v4/ai/evaluation-model`, model `typesafe-ai/jev` | `gatewayApiKey` |
| `builtin` | Claude Code's own small model through `$.model.classify`, one request per pause | nothing |
| `keywords` | never decides | nothing |

With no key and `provider: auto` the mod makes no network request at all: the band is the keyword match and says so in its footer.

## Telling the model (`attach`)

With `attach` on (the default), the candidate the band marked ▶ for **exactly** the text you submit is named to the model in a `<skill_relevance>` note ("load it with the Skill tool if it fits" for a skill, "consider delegating to it with the Agent tool" for a subagent), so what the band says will be called is what the model is told. Text edited after the decision, or submitted before one arrived, gets no note. Turn it off if [`jev-skill-suggestion`](../jev-skill-suggestion) is installed: that mod decides at submit with its own two-request pipeline and would say the same thing twice.

## Install

Claude Code 2.1.287 or newer, in a project you trust:

```sh
npx claude-code-templates@latest --mod productivity/jev-skill-typeahead
claude
```

The first session line reads `[jev-skill-typeahead] ready: … decisions by …`. Start typing a prompt: the band appears above the box.

Options live in `pluginConfigs["jev-skill-typeahead@skills-dir"].options` of your user settings (not project settings): `typesafeApiKey` / `gatewayApiKey`, `provider`, `language` (`en` or `es`, labels only), `maxRows` (4, clamped to 1–8), `pauseMs` (600, min 150), `minWords` (2), `includeSubagents` (true), `timeoutMs` (4000, min 500), `attach`, `neverSuggested` (comma-separated names), `logDecisions` (false; writes one transcript line per decision).

## Privacy

With a Jev key set, the prompt draft and every candidate's name and description are sent to the backend the key belongs to, **once per pause** while you type a prose prompt (never for `/…`, `!…` or `#…`). With `provider: builtin` they go to your Claude Code model instead. With no key, nothing leaves the machine. `typesafeBaseUrl` and `gatewayBaseUrl` redirect the key and the draft to whatever URL they hold. The session log records only the name of each decision, never the draft.

## Limits

- It suggests what the engine lists for the model. A skill hidden from the model (`skillOverrides`, or withheld by `jev-skill-suggestion`) is not in that listing; the mod then falls back to the command list until it has seen a listing.
- Keyword matching is IDF-weighted term overlap, not understanding; the Spanish table covers common task words, not the language. Jev's decision is the part that understands.
- The band is drawn on the terminal and desktop surfaces. Rows use fixed-width cells, with no-break spaces off the terminal so desktop HTML keeps the alignment.
- Pasted text is expanded at submit, so a pasted draft never matches its decision and gets no `attach` note.

## Development

```sh
cd cli-tool/components/mods && npx -y -p typescript@5 tsc -p tsconfig.json
claude plugin validate productivity/jev-skill-typeahead
claude plugin test productivity/jev-skill-typeahead
```

`prompt.edit` cannot be raised from a test, so the tests cover the policy, the listing parser, the Jev request and answer shapes, the band on both surfaces and the submit path; the live typing path was checked by reading the engine's types, not by typing into a session.

# jev-skill-typeahead

Suggests the skills you can use **while you type**, in the band above the prompt box. The draft is read on every edit, so the band follows the box key by key; once you pause, [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, says which one skill will actually be used and the band marks it.

```
╭──────────────────────────────────────────────────────────────────────╮
│ ✦ Skills 24 installed  prompt                                        │
│ ▶ ◆ /pptx                ████████░░  82%  will be used · deck, slides│
│   ◆ /xlsx                █░░░░░░░░░  12%  deck                       │
│   ● /brand-guidelines    █░░░░░░░░░   9%  slides                     │
│ Jev decided                                                          │
╰──────────────────────────────────────────────────────────────────────╯
```

`●` user or project skill, `◆` plugin skill, `◇` MCP prompt. The border turns green when a decision is in.

## What the band does with each kind of draft

| You type | The band |
|---|---|
| nothing, `!ls`, `#note` | stays away: a shell line or a memory note is not a task |
| `/` | lists your skills, user skills first, then plugins, then MCP prompts |
| `/com` | ranks skills **by name**: exact, prefix, start of a word (`-`, `_`, `:`), substring, then letters in order (`/cmt` finds `commit`) |
| `/commit fix the typo` | the name is complete: that skill is marked `▶ runs`, whatever follows |
| `make me a deck for the board` | ranks skills **by keyword match** over name and description, as you type; the word still being typed matches as a prefix. Spanish works too (`hazme una presentación`, `revisa la seguridad`) through a small Spanish-to-English alias table |
| the same, and you stop for 600 ms | Jev decides which one will be used (see below) |

Fenced code and URLs in the draft are ignored when matching. A prose draft needs two content words (or 24 characters) before anything shows, so `ok` and `make me a` stay quiet.

## What the footer tells you

The band never claims more than it knows:

| Footer | Meaning |
|---|---|
| `keyword match · pause for Jev to decide` | instant, local, a guess; the percentage is how much of your draft the skill's name and description cover |
| `asking Jev…` | a decision request is in flight |
| `Jev decided` | the answer: the ▶ row is the skill expected to be used, with the probability Jev reported (a dash when the backend reports none) |
| `no skill needed for this` | the gate said prose is enough; no row is marked |
| `decision unavailable · keyword match` | the request failed or timed out; the keyword match stays |

Typing again clears the mark at once: a decision is only ever shown for the draft it was made for.

## Deciding which skill will be used

One request per pause: a `choice` over every skill's description, plus three yes/no gate questions (does it act on your system, would an expert follow a documented procedure, could prose alone do it). This is the first request of TypeSafe's [skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion), the same one [`jev-skill-suggestion`](../jev-skill-suggestion) sends; the second, re-reading request is left out because the draft changes under it and this answer is a preview. The mark needs the gate mean ≥ `gateThreshold` (0.3) and, when the backend reports one, a probability ≥ `confidenceThreshold` (0.35).

| `provider` | Endpoint | Needs |
|---|---|---|
| `auto` (default) | TypeSafe if its key is set, else the Gateway, else keywords only | |
| `typesafe` | `POST api.typesafe.ai/v1/systemone`, model `jev-latest` | `typesafeApiKey` |
| `gateway` | `POST ai-gateway.vercel.sh/v4/ai/evaluation-model`, model `typesafe-ai/jev` | `gatewayApiKey` |
| `builtin` | Claude Code's own small model through `$.model.classify`, one request per pause | nothing |
| `keywords` | never decides | nothing |

With no key and `provider: auto` the mod makes no network request at all: the band is the keyword match and says so in its footer.

## Telling the model (`attach`)

With `attach` on (the default), the skill the band marked ▶ for **exactly** the text you submit is named to the model in a `<skill_relevance>` note ("load it with the Skill tool if it fits"), so what the band says will be used is what the model is told. Text edited after the decision, submitted before one arrived, or starting with `/` gets no note. Turn it off if [`jev-skill-suggestion`](../jev-skill-suggestion) is installed: that mod decides at submit with its own two-request pipeline and would say the same thing twice.

## Install

Claude Code 2.1.287 or newer, in a project you trust:

```sh
npx claude-code-templates@latest --mod productivity/jev-skill-typeahead
claude
```

The first session line reads `[jev-skill-typeahead] ready: … decisions by …`. Start typing a prompt: the band appears above the box.

Options live in `pluginConfigs["jev-skill-typeahead@skills-dir"].options` of your user settings (not project settings): `typesafeApiKey` / `gatewayApiKey`, `provider`, `language` (`en` or `es`, labels only), `maxRows` (4), `pauseMs` (600), `minWords` (2), `timeoutMs` (4000), `attach`, `neverSuggested` (comma-separated names), `logDecisions`.

## Privacy

With a Jev key set, the prompt draft and every skill's name and description are sent to the backend the key belongs to, **once per pause** while you type a prose prompt (never for `/…`, `!…` or `#…`). With `provider: builtin` they go to your Claude Code model instead. With no key, nothing leaves the machine. `typesafeBaseUrl` and `gatewayBaseUrl` redirect the key and the draft to whatever URL they hold. The session log records only the name of each decision, never the draft.

## Limits

- It lists what `$.command.list()` returns: skills and slash commands the engine offers, not the built-ins. A skill hidden with `skillOverrides` is still listed, since you can still type it.
- Keyword matching is IDF-weighted term overlap, not understanding; the Spanish table covers common task words, not the language. Jev's decision is the part that understands.
- The band is drawn on the terminal and desktop surfaces. Rows use fixed-width cells, with no-break spaces off the terminal so desktop HTML keeps the alignment.
- Pasted text is expanded at submit, so a pasted draft never matches its decision and gets no `attach` note.

## Development

```sh
cd cli-tool/components/mods && npx -y -p typescript@5 tsc -p tsconfig.json
claude plugin validate productivity/jev-skill-typeahead
claude plugin test productivity/jev-skill-typeahead
```

`prompt.edit` cannot be raised from a test, so the tests cover the policy, the Jev request and answer shapes, the band on both surfaces and the submit path; the live typing path was checked by reading the engine's types, not by typing into a session.

---
name: boxing
description: Answers professional boxing questions with live, cited data from Boxerbook (boxerbook.com): records, last and next fights, results, schedules and where to watch, head to head, champions, belts, rankings (WBC, WBA, IBF, WBO, The Ring, TBRB), weight classes, scorecards, upsets, previews, predictions and social posts. Use for any boxing question in any language or whenever a boxer is named. Not for MMA/UFC, kickboxing or workouts.
license: MIT (skill text and scripts). Boxerbook data is ODbL, attribution "Boxerbook".
compatibility: Needs the Boxerbook MCP server (https://mcp.boxerbook.com/mcp) or network access to boxerbook.com. Helper script needs python3 (stdlib only).
metadata:
  version: "1.0.0"
  author: Boxerbook
  homepage: https://boxerbook.com
---

# Boxing, grounded in Boxerbook

Boxerbook is an open catalog of professional boxing worldwide: boxers and
their records, bouts, upcoming cards with start times and broadcasters,
results with their sources, publisher rankings and the Boxerbook rating
(live size: `status`). Your job is to answer boxing questions **only from
what Boxerbook returns**, cite it, and be clear about what it does not know.

## Workflow

1. **Pick the data path** (first match wins):
   - Boxerbook MCP tools available (names like `boxer`, `bout`,
     `boxing_schedule`, often prefixed `mcp__...boxerbook__`) → use them, with
     `lang` = the user's language (`en`, `es`, `ru`, `ja`; else `en`).
   - You can run code with network access → `python3 scripts/boxerbook.py ...`
     (path relative to this skill's folder; in Claude Code
     `python3 "${CLAUDE_SKILL_DIR}/scripts/boxerbook.py" ...`). Run it, don't read it.
   - You can fetch URLs → `https://boxerbook.com/v1/...` (JSON, no key).
   - None of these → say you cannot reach Boxerbook right now, answer only
     general boxing knowledge (rules, divisions) and send the user to
     https://boxerbook.com. Do not state records or results from memory.
2. **Resolve who/what** the user means (see "Names" below).
3. **Fetch** the minimum that answers the question (see the table), then
   anything the answer needs to be correct (e.g. a bout page for the method).
4. **Answer** in the user's language, facts first, with dates written out,
   one boxerbook.com link per boxer/bout/card you mention, and a
   `Source: Boxerbook` line. Use a template from
   [references/templates.md](references/templates.md) when one fits.

| Question | MCP tool | REST / helper |
|---|---|---|
| Boxer's record, stats, last/next fight | `boxer` | `boxer "<name>"` |
| Last N fights, "how did X do lately" | `search`+`fetch boxer:<id>` or `bout` | `bouts "<name>" --limit N` |
| Next fight, date, where to watch | `next_fight`, `where_to_watch` | `next "<name>"` |
| "A vs B": did they fight, who won, tale of the tape, preview | `bout` query "A vs B" (+ `boxer` for each) | `h2h A B` + `boxer` each + `bout <id>` |
| What's on tonight / this weekend | `boxing_schedule` | `schedule --when tonight\|weekend\|30d` |
| Who won last night / this week | `boxing_results` | `results --days N` |
| Rankings, champions of a division | `rankings` (publisher) | `rankings <code> --publisher wbc` |
| Ambiguous name | `search_boxers` | `search "<name>"` |
| Data freshness | `boxerbook://status` | `status` |

Full tool/endpoint reference and field meanings:
[references/api.md](references/api.md). The MCP tools describe themselves;
on the REST/helper path, or when a field's meaning is unclear (records going
in, `display`, `p_a`, `confirmation`), read it first.

## Rules (non-negotiable)

1. **Never invent a record, result, date, opponent, title, statistic or
   ranking.** Every fact about a person, fight or place in your answer must
   come from a Boxerbook response in this conversation. If Boxerbook lacks it
   (judges' scorecards, punch stats, purses), say "Boxerbook does not have
   that" and do not fill the gap from memory. This includes "harmless"
   background: no states or cities added to a venue, no family ties ("twin
   brothers"), no full or native names, no belts you think someone held, no
   fights you did not fetch, no city for a venue that came without one
   (Korakuen Hall stays "Korakuen Hall, Japan"). Quote `title_text` as
   written; don't work out which belt belonged to which boxer. Write names
   and places as returned (or in the user's script). **Totals too:** never
   count cards, bouts or title fights yourself ("15 cards", "four title
   fights"); quote a total the tool returned (`total_bouts`) or just list.
   Only general rules knowledge (what a split decision is, weight limits)
   may come from you.
2. **Cite.** Link every boxer, bout and card you name to the `url` Boxerbook
   returned (or `https://boxerbook.com/boxers/<slug>` for ranking items). End
   with `Source: [Boxerbook](<main url>)`. Use links exactly as returned, but
   if a boxerbook.com link has no `utm_source`, append
   `?utm_source=claude-skill` (or `&utm_source=claude-skill`).
3. **Dates explicit.** Write the date of every fight ("31 Oct 2026"), never
   only "last Saturday". Say "as of <date>" for records and rankings
   (`as_of`, `list_date`). Card times: `start_utc` is when the **card**
   starts, not the main event; convert to the user's zone if known.
4. **Records going in.** On a bout, `record` is the W-L-D *before* that bout.
   Do not present it as the current record.
5. **Names.** If the search returns several plausible boxers (`other_matches`,
   or `search_boxers` with more than one close hit) and the question does not
   settle it (country, division, era), list the 2-4 candidates with country,
   division and record and ask which one, or answer for the most prominent
   and say whom you assumed. If nothing matches, say Boxerbook has no such
   boxer, suggest spellings, and do not describe a made-up person.
6. **No betting tips.** Never tell anyone what to bet, which side has
   "value", stakes, parlays or "locks". Predictions only as probabilities:
   Boxerbook `forecast` and `market` consensus when present, or your own
   clearly labelled estimate from the fetched data. **Any answer that shows
   a forecast, odds or a market probability ends with a line like
   "Probabilities, not certainties — this is not betting advice."** (in the
   user's language), even when the user did not ask for a prediction. If the
   user asks for a bet, decline that part in one sentence and give the
   probabilities instead. Don't volunteer odds when the question is not
   about predictions.
7. **Language.** Answer in the language of the user's message (es → Spanish,
   ru → Russian, etc.) and pass that `lang` to the MCP tools. Keep boxer
   names recognisable (see [references/glossary.md](references/glossary.md)).
8. **Be honest about freshness.** If a fight was "tonight" and Boxerbook has
   no result yet, say the result is not in yet rather than guessing. If
   `confirmation` is `single_source` or `provisional` is true, say so.

## Answer shape

- Lead with the direct answer in one sentence ("Canelo Álvarez beat Christian
  M'billi by unanimous decision over 12 rounds on 31 Oct 2026 in Riyadh,
  winning the WBC super middleweight title.").
- Then the supporting detail (table or bullets), then links and the source line.
- Short by default; long rundowns only when asked (fight night, recaps).
- Analysis and previews: tie every comparative claim to a fetched field and
  name it ("higher Boxerbook rating", "last five: WWWWW", "413 days out").
  No unsupported judgments ("faced weaker opposition") and no style
  descriptions you cannot source; label your own reasoning as such.
- Social posts: an X post is at most 280 characters in total, and a link
  counts as 23. Count before you answer; trim the post, not the facts or credit.
- Places: city + country as returned (`Arlington`, `US` → "Arlington, USA").
  Do not add a state, region or venue Boxerbook did not give.
- Word records precisely: "his first loss", not "his first fight"; "record
  going in", "current record (as of …)".
- Units: height/reach in cm from Boxerbook; add inches for US users
  (cm / 2.54).

## Knowledge files (load only when needed)

- [references/api.md](references/api.md) — every MCP tool and REST endpoint,
  parameters, field meanings, gotchas.
- [references/divisions.md](references/divisions.md) — weight classes,
  limits, Boxerbook division codes, es/ru names.
- [references/belts.md](references/belts.md) — WBC/WBA/IBF/WBO, The Ring,
  TBRB, undisputed/unified/interim/lineal.
- [references/scoring.md](references/scoring.md) — 10-point must, UD/SD/MD,
  KO/TKO/RTD/DQ/NC/TD, record notation.
- [references/glossary.md](references/glossary.md) — en/es/ru boxing terms.
- [references/templates.md](references/templates.md) — fighter card, tale
  of the tape, fight night, results recap, rankings, forecast, upset, social post.

## Examples

**"Who won Canelo's last fight and how?"** → `boxer "Canelo"` → `last_result`
(bout id, date, method, round) → `bout <id>` for the title and venue →
one-sentence answer + link to the bout and the boxer.

**"Tale of the tape Usyk vs Dubois"** → `bout "Usyk vs Dubois"` (head to head)
+ `boxer` for each → tale-of-the-tape table, their previous meetings with
dates, no invented physical stats.

**"Apuesta segura para el sábado?"** → in Spanish: no betting tips; offer the
Boxerbook forecast and market probabilities for Saturday's main events with
the "no es consejo de apuestas" line.

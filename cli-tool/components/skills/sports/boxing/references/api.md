# Boxerbook data access: MCP tools and REST API

Two doors to the same data. Use the MCP tools when they are connected (tool
names `boxing_schedule`, `boxer`, `bout` … possibly prefixed, e.g.
`mcp__plugin_boxing_boxerbook__boxer`). Otherwise use the REST API, through
`scripts/boxerbook.py` when you can run code, or by fetching the URLs directly.

## Contents
1. MCP server (tools, arguments, what each answers)
2. REST API (endpoints, parameters)
3. The helper script
4. Fields and how to read them
5. Gotchas

## 1. MCP server

Endpoint `https://mcp.boxerbook.com/mcp` (also `https://boxerbook.com/mcp`),
Streamable HTTP, stateless, no auth, 300 calls/min per IP. Every tool takes
`lang` (`en` | `es` | `ru` | `ja`): pass the user's language so the
boxerbook.com links in the answer are localized (`/es/boxeadores/...`,
`/ru/boksery/...`). Every answer carries `cite` (a ready markdown link) and `url`.

| Tool | Arguments | Use it for |
|---|---|---|
| `search` | `query` (a boxer, "A vs B", a division) | anything, when unsure which tool; returns document ids + urls |
| `fetch` | `id` = `boxer:<id>`, `bout:<id>`, `event:<id>`, `rankings:<DIV>` | the full document behind a search hit, as Markdown |
| `search_boxers` | `q` | name ambiguity: up to 20 boxers sharing a name/spelling, with country, division, record |
| `boxer` | `query` (name, slug or id) | a boxer's card: record (W-L-D, KOs), division, stance, height, reach, birth year, nickname, next fight, last result, rating, record as favourite/underdog; `other_matches` when the name is shared |
| `next_fight` | `query` | the next scheduled bout (date, start_utc, opponent, venue, broadcasters, forecast, market); `null` + `last_result` when none |
| `bout` | `id`, or `query` "Surname vs Surname" | one bout in full: records going in, result (winner, method, round, time), venue, card, broadcasters, sources, weigh-in, fight-week notes, forecast + signals, market. By names: their scheduled bout else their latest, plus `head_to_head` (all meetings, or "never fought" with both records and last fights) |
| `boxing_schedule` | `when` = `today` \| `tonight` \| `weekend` \| `30d`; `country` (ISO-2); `division`; `from_date`, `skip` (paging) | "what boxing is on", fight night, cards with start times and broadcasters |
| `boxing_results` | `days` 1–14 (default 2 = last night + today); `country`; `division`; `before_date`, `skip` | "who won last night", results this weekend |
| `rankings` | `division` (code or name); `publisher` = `boxerbook` (default) \| `wbc` \| `wba` \| `ibf` \| `wbo` \| `ring` \| `tbrb` | top 15 of a division |
| `where_to_watch` | `bout_id` \| `event_id` \| `platform` ("DAZN") | broadcasters by region; what is on a platform |

Prompts on the server: `fight_night_guide`, `boxer_briefing`, `weekend_results`.
Resources: `boxerbook://schedule/today`, `boxerbook://results/last-night`,
`boxerbook://status`, `boxerbook://about`.

Paging: schedule and results return at most 60 bouts, whole days first. When
`next_arguments` is present, call again with those arguments for the rest.

Fight history: the MCP `boxer` card has only `last_result`; for the last N
fights use `bout` with "A vs B", `search`+`fetch` on `boxer:<id>`, or the REST
`/v1/boxers/{id}/bouts` endpoint.

## 2. REST API

Host `https://boxerbook.com` (all paths below start with `/v1`), free, no key, CORS open (`*`), rate limited
per IP (429 + `Retry-After`). OpenAPI 3.1: `https://boxerbook.com/v1/openapi.json`.
Errors are RFC 7807 problems: `{"type","title","status","detail"}`.

| Endpoint | Parameters | Returns |
|---|---|---|
| `GET /v1/boxers/search` | `q` (2–80 chars) | `results[]`: id, slug, name, country, division, record, url (max 20, best first) |
| `GET /v1/boxers/{id}` | id or slug | boxer card (see fields) |
| `GET /v1/boxers/{id}/bouts` | `limit` 1–50 (20), `offset` 0–1000 | `total`, `bouts[]` newest first: date, status, opponent, result W/L/D/NC, method, round, time, scheduled_rounds, title_text, exhibition, record and opponent_record going in, url |
| `GET /v1/bouts/{id}` | bout id | full bout incl. sources, weighin, fight_week, forecast, market (+opening line), signals |
| `GET /v1/events/{id}` | event id | a card with its bouts and broadcasters |
| `GET /v1/schedule` | `when` today\|tonight\|weekend\|30d, `country`, `division` | `events[]` with `bouts[]` |
| `GET /v1/results` | `days` 1–14, `country`, `division` | `bouts[]` newest first with winner, method, round, sources |
| `GET /v1/rankings/{division}` | `publisher` boxerbook\|wbc\|wba\|ibf\|wbo\|ring\|tbrb | `list_date`, `items[]`: position (publisher lists: 0 = titleholder, absent when vacant), name, id, slug, champion_flag (`champion`, `super`, `regular`, `interim`), record (when present), mu/rd (Boxerbook rating list); no url per item: build `https://boxerbook.com/boxers/<slug>` |
| `GET /v1/status` | – | data freshness: last rating run, number of bouts and boxers |

The REST API has no "A vs B" lookup and no `lang`: links are English. Use the
helper's `h2h` command for head to head.

## 3. The helper script

`python3 scripts/boxerbook.py <command>` (stdlib only). Commands:
`search Q`, `boxer Q`, `bouts Q [--limit N --offset N]`, `next Q`, `h2h A B`,
`bout ID`, `event ID`, `schedule [--when W --country CC --division D]`,
`results [--days N --country CC --division D]`, `rankings DIV [--publisher P]`,
`status`. `--full` keeps bulky fields (forecast `signals`, every source link);
by default source lists are reduced to names + 3 links. Links to boxerbook.com
come back tagged `?utm_source=claude-skill`; cite them as they are. Exit code 1
with `{"error": ...}` on stderr when the API fails or a command that resolves a
boxer (`boxer`, `bouts`, `next`, `h2h`) finds no match; `search` with no match
exits 0 with an empty `results` list. `boxer`, `bouts`, `next` and `h2h` add
`other_matches` when the name is shared: check them before answering.

## 4. Fields and how to read them

- `record` on a boxer card: `{w, l, d, ko}` = the current pro record. On a bout
  (`a.record`, `record`, `opponent_record`) it is the W-L-D **going into** that
  bout, not today's record. `record: null` = unknown (often a debutant or an
  unlisted boxer), never "0-0".
- `record_source`: `bouts` (counted from Boxerbook's bout list) or `wikidata`.
  `bouts_without_result` > 0 means some completed bouts lack a result yet:
  say the record may be incomplete.
- `winner`: `a` | `b` | `draw` | `nc` (no contest). `result` on a boxer's
  bouts list: `W` | `L` | `D` | `NC` from that boxer's side.
- `method`: KO, TKO, RTD (corner retirement), UD/SD/MD (unanimous/split/
  majority decision), TD (technical decision), DQ, NC, PTS (points, older or
  single-referee bouts). `round`: the round it ended; for decisions the last
  scheduled round. `time`: clock time in the round when known.
- Judges' individual scorecards are **not** in Boxerbook. Never invent them.
- `display`: the order to name the two boxers in (the better-known first);
  `a`, `b`, `winner`, `forecast.p_a`, `market.p_a` keep their side-a meaning.
- `start_utc`: the start of the whole card in UTC (e.g. `2026-10-31T21:00Z`),
  not of the main event. Main events usually start 2–4 hours later; say so.
  `date` is the local date of the card.
- `status`: scheduled, completed, cancelled, postponed … `confirmation` says
  how the result/listing is confirmed: `official` (commission or sanctioning
  body), `reciprocal` (several independent sources agree), `single_source`
  (one source only: say so if it matters). `provisional: true` = not yet
  confirmed.
- `forecast.p_a`: Boxerbook model probability that side a wins (draws not
  modelled separately). `market.p_a`: no-vig bookmaker consensus for side a
  (`books` = number of bookmakers, via The Odds API), `opening` = first line.
  Side b = 1 − p_a. Both are information, never betting advice.
- `rating.mu` / `rd`: Boxerbook rating (Glicko-style: mu = strength, rd =
  uncertainty; higher mu = stronger), `division_rank`, `confidence` 0–1.
- `market_record`: wins/losses as betting favourite and underdog,
  `upsets_caused`, `upsets_suffered`.
- `weighin`: official weights in lb per side (`missed` = missed weight).
- `fight_week[]`: notes read from fight-week videos (injury, replacement,
  weight, camp, layoff, background) with a quote and a timestamped YouTube link.
- `sources[]`: where the result/listing came from (commissions, sanctioning
  bodies, broadcasters, press). Mention them for disputed or fresh results.
- `division` codes: see `divisions.md` (`other` = not classified).
- `country`: ISO 3166-1 alpha-2.
- `as_of`: when the answer was generated (UTC). Use it for "as of" lines.

## 5. Gotchas

- Name search is fuzzy and ranks by prominence: "Smith" returns Sugar Ray
  Robinson (born Walker Smith Jr.) first. When the user gives a common name or
  only a surname, check `other_matches` / `search_boxers` before answering.
- Two different boxers can share a name (e.g. Charlo twins are distinct, but
  so are many "Jose Lopez"). Disambiguate by country, division, record, years.
- A boxer missing from Boxerbook is not proof they do not exist: say Boxerbook
  has no match and suggest a spelling, never fabricate a card.
- Rankings: in publisher lists `position: 0` is the champion; the Boxerbook rating list starts at 1. Ranking items carry a `slug`: link `https://boxerbook.com/boxers/<slug>`. Publisher lists have a `list_date`;
  quote it. TBRB and The Ring rank one champion per division; the four
  sanctioning bodies each have their own champion (see `belts.md`).
- `when=today` keeps last night's cards that started under 6 hours ago.
- Schedule windows: `weekend` = Fri–Sun, `30d` = next 30 days (largest).
- Small-hall cards list many debutants with `record: null`; lead with
  title fights and main events.

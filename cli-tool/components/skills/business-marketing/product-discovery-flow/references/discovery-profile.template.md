# Discovery Profile

> This file is the **single place** where your company lives. Every agent in the Product
> Discovery Flow reads it and substitutes it for the generic words *the company* / *the product*.
> Fill it once. Nothing else in the flow needs editing.
>
> **Rules of the file**
> - Leave a field as `—` if you do not have it. `—` means *"does not exist"*, and agents will
>   skip it and record a data gap. It never means *"guess it"*.
> - Never put secrets here (API keys, tokens, passwords). Links and names only.
> - The flow works with an almost-empty profile — sections 1 and 3 are the minimum.

---

## 1. Company and product — *required*

- **Company:** —
- **Product:** —
- **What the product does, in one sentence (for whom, what outcome):** —
- **Category / market it competes in:** —
- **Business model and pricing:** —
- **Markets and languages you sell in:** —
- **Stage:** — <!-- pre-launch / early / growth / mature -->

## 2. Strategic narrative

<!-- 2–6 sentences. The thesis the company bets on: who is under-served, why they cannot solve
     it alone, and what the product changes. Agents use this to judge strategic fit — if you
     leave it empty, they will simply not judge strategic fit. -->

—

**What we do better than the alternatives:**
- —

**Known gaps and weaknesses (be honest — this improves the research):**
- —

## 3. Target segments — *required*

<!-- Per the AJTBD canon a segment is a set of people performing similar Core Jobs with similar
     success criteria — not a demographic or a company-size bucket. Describe them that way if
     you can. Priority: primary / secondary / legacy. -->

| Segment | Priority | Core Jobs they perform | Notes |
|---|---|---|---|
| — | primary | — | — |

**Legacy / historical segments** — mention separately in reports, never merge with the primary ones:
- —

## 4. Competitors and adjacent solutions

| Name | Type | Notes |
|---|---|---|
| — | direct / substitute / adjacent / in-house-DIY | — |

**Brand names that must never be translated or localised:**
- —

## 5. Job Graph anchor

<!-- Job levels are relative to YOUR product's reach — that is the whole point of this section.
     Without it, agents cannot place a Job correctly. -->

- **Core Job** — the topmost Job the product performs **fully** (what the customer pays for): —
- **Big Job** — one level above Core; the product contributes but does not perform it fully: —
- **Small Jobs** — **siblings** of the Core Job that the product does **not** perform (growth
  opportunities; the customer does them alone, with another product, or with a partner): —

## 6. Data sources

<!-- Fill only what actually exists and what your Claude Code setup can actually reach.
     `not configured` = the agent skips it and logs a data gap. It will not improvise. -->

| Source | Status | Where / how to reach it | Notes |
|---|---|---|---|
| Research archive — past discovery reports | not configured | — | |
| Product knowledge base / help docs | not configured | — | |
| Internal product or engineering wiki | not configured | — | |
| Subscription and revenue metrics | not configured | — | |
| CRM — deals, win/loss, pipeline | not configured | — | |
| Team chat — customer feedback, support | not configured | — | which channels |
| Community chat / forum / subreddit | not configured | — | |
| Product analytics — usage, funnels | not configured | — | |
| Support tickets | not configured | — | |
| Other | not configured | — | |

**Methodology canon on disk** (optional; the AJTBD Canon Validator reads it if present):
- Path: —

## 7. Where reports are published

- **Destination:** — <!-- Notion page/space, Confluence, a folder on disk, "just return it in chat" -->
- **Page title convention:** `Discovery — <topic> — <YYYY-MM-DD>`
- **Primary language:** English
- **Also translate into:** — <!-- language, or "none" -->

## 8. Who reads the reports

- **Primary readers and their roles:** —
- **Technical depth expected:** — <!-- non-technical exec / mixed / engineering -->
- **Tone:** —

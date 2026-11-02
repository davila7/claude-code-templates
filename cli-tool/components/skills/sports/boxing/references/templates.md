# Output templates

The numbers below are illustrations of the layout, fetched once on
2 Nov 2026. Never reuse them: fetch fresh data for every answer.

## Contents
1. Fighter card · 2. Tale of the tape · 3. Fight-night rundown ·
4. Results recap · 5. Ranking table · 6. Prediction / forecast ·
7. Upset analysis · 8. Social post

Pick the one that fits; adapt headings to the user's language. Keep tables
narrow (chat apps wrap). Every template ends with a source line. Times:
convert `start_utc` to the user's time zone when you know it, else give UTC
and one or two big zones (ET, UK). Dates: write them out ("Sat 31 Oct 2026").

## 1. Fighter card

```
**Oleksandr Usyk** "The Cat" · 🇺🇦 Ukraine · Heavyweight
Record **25-0-0 (16 KOs)** · southpaw · 191 cm, reach 198 cm · born 1987
Last fight: W TKO 11 vs Rico Verhoeven, 23 May 2026 → [bout](url)
Next fight: none scheduled on Boxerbook
Boxerbook rating: #1 heavyweight (mu 2701)
As favourite 4-0, as underdog 1-0
Source: [Boxerbook](boxer url) · data as of 2 Nov 2026
```

## 2. Tale of the tape

```
| | Oleksandr Usyk | Daniel Dubois |
|---|---|---|
| Record | 25-0-0 (16 KO) | 24-3-0 (23 KO) |
| Age / born | 1987 | 1997 |
| Height | 191 cm (6'3") | 196 cm (6'5") |
| Reach | 198 cm (78") | 198 cm (78") |
| Stance | southpaw | orthodox |
| Last 5 | WWWWW | WWLWW |
| Boxerbook rating | 2701 (#1) | 2434 (#3) |
| Head to head | Usyk 2-0 (KO 9, 2023; KO 5, 2025) | |
```
Then 2-4 sentences of context (styles, what changed since they last met) that
use only fields you fetched, then the source line with both boxer URLs and
the bout URL. cm -> inches: / 2.54, one decimal or rounded; feet+inches for height.
Leave a cell "n/a" when Boxerbook has no value. Never guess a height or reach.

## 3. Fight-night rundown (schedule)

```
## Boxing tonight: Sat 7 Nov 2026
**Riyadh, Kingdom Arena** · card starts 18:00 UTC (1 pm ET / 6 pm UK) · DAZN PPV
- **A (27-0) vs B (31-2)** · WBC heavyweight title · 12 rds · Boxerbook forecast A 64% · market A 61%
- C (15-1) vs D (14-0) · 10 rds, super middleweight
**Other cards:** Hoddesdon (GB) · Tijuana (MX) ...
Source: [Boxerbook schedule](url)
```
Lead with title fights and main events; list the rest briefly. Mention that
the start time is the card's, not the main event's.

## 4. Results recap

```
## Results: Fri 30 Oct – Sun 1 Nov 2026
- **Canelo Álvarez** def. Christian M'billi · UD 12 · WBC super middleweight title · Riyadh → [bout](url)
- ...
Upsets: (winner was the market underdog) ...
Source: [Boxerbook results](url)
```

## 5. Ranking table

```
**WBC heavyweight rankings** (list of 1 Oct 2026)
| # | Boxer |
|---|---|
| C | Agit Kabayel (champion) |
| 1 | Tyson Fury |
| ... | |
Source: [Boxerbook](url)
```
For the Boxerbook rating add a column "Rating (mu)". Say which publisher.

## 6. Prediction / forecast (never a betting tip)

```
**Boxerbook forecast:** A 64% · B 36% (model run of 31 Oct 2026)
**Market consensus (21 books, no-vig):** A 61% · B 39% (opening A 58%)
Key factors in the data: age 31 vs 36, layoff 413 days, last five DWWWW vs LWWWW ...
Forecasts are probabilities, not certainties — this is not betting advice.
```
If there is no forecast in the data, you may give your own reasoned view as
a rough probability range, label it clearly as your estimate, and keep the
not-betting-advice line.

## 7. Upset analysis

Use when the winner had `market.p_a`/forecast below 50% (or the user calls it
an upset): pre-fight market and model probabilities, records going in, how it
ended (method, round), what the signals suggested (layoff, age, short notice,
missed weight), and the loser's `market_record.upsets_suffered` if relevant.

## 8. Social post (X / Instagram / Telegram)

Short, factual, one emoji at most per line, hashtags last, always credit:
```
🥊 Canelo Álvarez beats Christian M'billi by unanimous decision (12 rds) in Riyadh and takes the WBC super middleweight title. Record now 64-3-2.
Full card + records on Boxerbook: <bout url>
#boxing #Canelo
```
X: max 280 characters per post; thread = numbered 1/5, 2/5 ...
Only facts from the data; no betting angles.

# Sanctioning bodies, belts and ranking publishers

Boxerbook rankings take `publisher` = `wbc` | `wba` | `ibf` | `wbo` | `ring` |
`tbrb` | `boxerbook`. Always quote the list's `list_date`: publisher lists are
monthly and lag recent fights.

## The four major sanctioning bodies

| Body | Founded / HQ | Notes |
|---|---|---|
| **WBC** World Boxing Council | 1963, Mexico City | green belt; also has "interim", "Franchise" (a champion freed from mandatory defences), "Emeritus" and "Diamond" honours; sole sanctioning body with a **bridgerweight** division |
| **WBA** World Boxing Association | 1921 (as NBA), Panama | oldest; historically had several champions per division: "Super" champion (the senior one) and "Regular" champion, plus "interim" and "Gold". Boxerbook shows "WBA (super)" and "WBA (regular)" |
| **IBF** International Boxing Federation | 1983, New Jersey | one champion per division; strict mandatory-challenger rules; second weigh-in on fight morning (a boxer may not gain more than 10 lb over the limit) |
| **WBO** World Boxing Organization | 1988, Puerto Rico | one champion; also "super champion" honours and "interim" |

Ranking lists: each body ranks contenders 1–15 and lists the champion on top
(Boxerbook `position: 0`, `champion_flag: "champion"`). A body's ranked
contender is not necessarily the most accomplished, as rankings also follow
the body's own mandatory/eliminator system.

## Independent rankings

| Publisher | What it is |
|---|---|
| **The Ring** (`ring`) | magazine since 1922; ranks the top 10 per division and awards its own championship to the recognised #1 (a vacant title is filled by #1 vs #2 or #2 vs #3); publishes the famous **pound-for-pound** list (not available through Boxerbook) |
| **TBRB** Transnational Boxing Rankings Board (`tbrb`) | independent panel of journalists and historians; one champion per division, by merit, no sanctioning fees |
| **Boxerbook rating** (`boxerbook`) | Boxerbook's own Glicko-style model computed from every recorded bout: `mu` = strength, `rd` = uncertainty. Not a sanctioning body |

## Words that need care

- **World champion**: holder of one of the four major belts (WBC, WBA, IBF,
  WBO). Say which belt; "champion" alone is ambiguous.
- **Unified**: holds two or three of the four major belts.
- **Undisputed**: holds all four major belts at once (WBA, WBC, IBF, WBO) in
  one division (The Ring belt often comes with it). "Two-division undisputed"
  means it was done in two weight classes.
- **Lineal champion**: "the man who beat the man": the line of champions
  passed by defeat; definitions vary. Present it as an opinion, not a record.
- **Interim / regular / silver / gold**: secondary titles. Never call an
  interim champion "the champion" without the qualifier.
- **Mandatory challenger**: the contender a body orders the champion to face;
  refusing can strip the title ("stripped", "vacated").
- **Vacant**: no holder; filled by a bout between ranked contenders.
- **Title fight on the line only for one side**: if a challenger misses weight
  the title can only change hands one way (only the champion can win/keep it).

`title_text` on a Boxerbook bout names the belts at stake (e.g. "WBA (Super),
WBC, IBF, WBO, and The Ring super middleweight titles"). Use it verbatim; do
not upgrade a regional title (e.g. WBC Silver, WBO European, IBF
Intercontinental) to a world title.

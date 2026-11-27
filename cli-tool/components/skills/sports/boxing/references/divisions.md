# Weight classes and Boxerbook division codes

The limit is the most a boxer may weigh at the official weigh-in (usually the
day before; the IBF also re-weighs on fight morning). kg = lb x 0.45359237,
one decimal. Women's codes are the men's code with the prefix `w_`
(`w_fea` = women's featherweight). `other` = bout not classified (often a
catchweight or a small-hall bout with no division on record).
Pass either the code or the English name to tools (`division: "hea"` or
`"heavyweight"`, `"women's flyweight"`).

| Code | Division | Limit lb | Limit kg | Also called |
|---|---|---|---|---|
| `hea` | Heavyweight | no limit (above cruiserweight) | no limit | |
| `bri` | Bridgerweight (WBC only) | 224 | 101.6 | |
| `cru` | Cruiserweight | 200 | 90.7 | junior heavyweight |
| `lhea` | Light heavyweight | 175 | 79.4 | |
| `smid` | Super middleweight | 168 | 76.2 | |
| `mid` | Middleweight | 160 | 72.6 | |
| `swel` | Super welterweight | 154 | 69.9 | junior / light middleweight |
| `wel` | Welterweight | 147 | 66.7 | |
| `slig` | Super lightweight | 140 | 63.5 | junior / light welterweight |
| `lig` | Lightweight | 135 | 61.2 | |
| `sfea` | Super featherweight | 130 | 59.0 | junior lightweight |
| `fea` | Featherweight | 126 | 57.2 | |
| `sban` | Super bantamweight | 122 | 55.3 | junior featherweight |
| `ban` | Bantamweight | 118 | 53.5 | |
| `sfly` | Super flyweight | 115 | 52.2 | junior bantamweight |
| `fly` | Flyweight | 112 | 50.8 | |
| `lfly` | Light flyweight | 108 | 49.0 | junior flyweight |
| `min` | Minimumweight | 105 | 47.6 | strawweight, mini flyweight |

Women: 16 of the men's divisions (all except bridgerweight and cruiserweight)
with `w_` (`w_hea`, `w_lhea`, `w_smid`, `w_mid`,
`w_swel`, `w_wel`, `w_slig`, `w_lig`, `w_sfea`, `w_fea`, `w_sban`, `w_ban`,
`w_sfly`, `w_fly`, `w_lfly`, `w_min`) plus `w_atom` atomweight, 102 lb / 46.3 kg.
17 women's divisions in all. There is no women's bridgerweight or
cruiserweight on Boxerbook.

## Names in other languages (to map user words to codes)

| Code | Español | Русский |
|---|---|---|
| `hea` | peso pesado | супертяжёлый вес (тяжёлый) |
| `cru` | peso crucero | первый тяжёлый вес |
| `lhea` | peso semipesado | полутяжёлый вес |
| `smid` | peso supermediano | второй средний вес |
| `mid` | peso mediano | средний вес |
| `swel` | peso superwélter | первый средний вес |
| `wel` | peso wélter | полусредний вес |
| `slig` | peso superligero | первый полусредний вес |
| `lig` | peso ligero | лёгкий вес |
| `sfea` | peso superpluma | второй полулёгкий вес |
| `fea` | peso pluma | полулёгкий вес |
| `sban` | peso supergallo | второй легчайший вес |
| `ban` | peso gallo | легчайший вес |
| `sfly` | peso supermosca | второй наилегчайший вес |
| `fly` | peso mosca | наилегчайший вес |
| `lfly` | peso minimosca | первый наилегчайший вес |
| `min` | peso mínimo (paja) | минимальный вес |

Russian usage note: in Russian pro boxing "супертяжёлый" and "тяжёлый" are
both used for heavyweight; "первый тяжёлый" is cruiserweight.

## Rules of thumb

- Catchweight: an agreed limit between divisions for a non-title bout.
- Missing weight in a title fight: usually a challenger who misses cannot win
  the title, and a champion who misses is stripped (the bout may go ahead).
  The exact outcome depends on the sanctioning body and the commission, so
  report what the sources say for that bout rather than assuming.
- "Pound for pound" (P4P) ignores weight: a ranking of the best boxers
  regardless of division (The Ring and TBRB publish lists). Boxerbook's
  rating is per division; for P4P compare `rating.mu` across divisions only as
  a rough guide and say so.

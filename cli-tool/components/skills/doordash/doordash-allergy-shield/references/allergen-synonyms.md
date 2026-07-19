# Hidden Allergen Sources — Lookup Table

Menu-item words that imply an allergen even when the allergen is not named.
Used by the doordash-allergy-shield vetting step (case-insensitive matching against
`cart show` item names/descriptions). Not exhaustive — when a dish name
suggests a cuisine that commonly uses the allergen, treat it as UNVERIFIED
rather than clean.

## Peanut

satay, pad thai, kung pao, gado-gado, bamba, groundnut, goober, mole (some),
dan dan noodles, hoisin (some brands), praline (peanut variants)

## Tree nuts

pesto (pine nut/walnut), praline, marzipan, frangipane, nougat, baklava,
gianduja, macaron/macaroon, Nutella, orgeat, amaretto (flavor), Waldorf,
korma (cashew/almond), romesco (almond/hazelnut), picada, pistou (some)

## Egg

aioli, mayo/mayonnaise, hollandaise, béarnaise, carbonara, meringue,
frittata, quiche, custard, crème brûlée, pavlova, challah, brioche,
tamago, katsu (egg-battered), tempura (batter), Caesar dressing (traditional)

## Milk / dairy

ghee, paneer, queso, béchamel, alfredo, au gratin, tzatziki, raita, lassi,
whey, casein, malai, kheer, panna cotta, burrata, halloumi, labneh

## Soy

ponzu, teriyaki, miso, tempeh, tofu, edamame, tamari, hoisin, oyster sauce
(some), unagi sauce, doubanjiang, gochujang (some), yuba

## Fish

ponzu (bonito), Worcestershire (anchovy), Caesar dressing (anchovy),
nam pla / fish sauce, XO sauce, surimi, dashi (bonito), bagna cauda,
puttanesca (anchovy), niçoise, Gentleman's Relish

## Shellfish / crustacean

XO sauce (dried shrimp), shrimp paste / belacan / kapi, tom yum (often),
laksa (often), pad thai (dried shrimp, some), bisque, étouffée, gumbo
(often), paella (often), fideuà

## Gluten / wheat

seitan, panko, tempura, udon, ramen, soba (usually wheat blend), couscous,
orzo, farro, semolina, roux, soy sauce (regular, wheat-brewed), hoisin,
katsu (breaded), gnocchi (some), dumpling/gyoza wrappers

## Sesame

tahini, hummus (tahini), halva, za'atar (usually), gomashio, furikake
(often), baba ganoush (tahini), sesame oil in most stir-fry lines

## Notes for the vetting step

- A hit here = treat as containing the allergen unless the menu text
  explicitly says otherwise.
- Multi-allergen entries (ponzu → soy + fish) trip BOTH profiles.
- The anaphylaxis-severity keyword list the checkout-gate hook greps is
  derived from the eater's profile `name` values PLUS the synonym words in
  that allergen's section above.

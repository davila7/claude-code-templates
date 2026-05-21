# Blog — Featured Image Style Guide (Universal Template)

Used when generating hero images (via Nano Banana Pro / Gemini 3 Pro Image, or an equivalent text-to-image model) for blog articles.

The **structure** of this document — target audience, reference points, palette, aesthetic rules, composition, topic-reflection table, prompt template, worked examples — is the cross-project template. The **content** is per-project: walk the intake questions in §I and fill in every `[FILL: ...]` block. Keep this file as a self-contained brief so a human designer or an image model can use it without other context.

---

## §I. Intake Questions

Walk these first. Use `AskUserQuestion` when available; otherwise list numerically and ask the user to answer in batches. Pre-fill from any visual identity already documented in the host project (`globals.css`, design tokens, brand book, existing site photography).

### Brand

1. **Brand in one sentence.** Positioning, sector, and what the visual language is *not* (e.g. "not a SaaS marketing asset", "not a generic event-industry stock library").
2. **Photographic register.** One of: editorial documentary / industrial editorial / lifestyle editorial / studio still life / mixed. Each pulls a different aesthetic from the model.
3. **Magazine touchstones.** Two to four named publications whose photography matches the desired feel (e.g. Monocle, Dezeen, MIT Technology Review, Wallpaper\*, Disegno, *Cabinet*, Apartamento). The model adheres more reliably to named touchstones than to abstract adjectives.

### Audience

4. **Target readers (3–5 bullets).** Who actually reads the blog, what they value, what they are allergic to in stock imagery.

### Reference points

5. **1–2 concrete reference images from the live site or brand library.** Describe each in 1–2 sentences. Model adherence improves enormously when the prompt can echo a named scene rather than abstract adjectives.

### Colors

6. **Brand neutrals.** Pull from `globals.css` or the design token export. List 4–6 hex codes (canvas, ink, body gray, dividers).
7. **Signature accent.** One saturated brand color, used as a *small* accent only — never dominant.
8. **Secondary accent or wash (optional).** A soft tone used sparingly for halos or selection states.

### Allowed working palette

9. **Authentic material colors specific to the industry.** Beyond the brand palette, the model is allowed to use the colors of the materials themselves (denim, marigold, kraft, concrete, brushed aluminium, walnut, etc.). List 5–10 honest material hues.

### Hard avoids

10. **Project-specific hard avoids.** Default universal hard avoids are listed in §V; add project-specific ones (e.g. "no rainbow LED on screens in frame", "no full frontal faces", "no readable show signage").

### Composition

11. **Aspect ratio.** Default 16:9 landscape at 1920×1080 or higher. Confirm.
12. **Title overlay side.** Where titles will overlay on listing cards vs. article heroes — drives where negative space goes.

### Topic reflection

13. **Topic table (8–12 rows).** A 2-column table mapping topic areas in your domain to concrete visual subjects. This is the single most important section: every generated image must hint at its article through real material or industrial context, never icons or symbols. See §VII for the structure and an example skeleton.

### Worked examples

14. **3–5 worked example prompts.** One for a high-traffic topic area (cornerstone), one for a difficult abstract topic (ROI / governance / strategy), one or two more spanning the rest of the topic table. See §IX for the structure and an example shape.

### Generator hookup

15. **Image asset reuse strategy.** One image shared across all locales (default; locale-specific alt text in the uploader) or one image per locale (only when the imagery itself differs by language).

---

## §II. Brand in one sentence

`[FILL: one-sentence positioning. Example shape: "<Company> is a <sector adjective> company that <does specific thing>. The visual language is <photographic register> — <three qualitative descriptors>. Think a <Magazine A> or <Magazine B> feature on a real <subject>, not a <anti-example>."]`

---

## §III. Target audience

`[FILL: 3–5 bullets from intake question 4. Who readers are, what they value, what they are allergic to in stock imagery.]`

---

## §IV. Reference points (existing site)

`[FILL: 1–2 concrete images from the live site that anchor the visual calibration. Describe each specifically — composition, light, materials, color, mood. The model adheres more reliably to named scenes than to abstract adjectives.]`

---

## §V. Brand colors

Sampled from the site's canonical color tokens (`globals.css`, design system export, or brand book):

- **Neutrals:** `[FILL: 4–6 hex codes — canvas / off-white / near-black / body gray / dividers]`
- **Signature accent:** `[FILL: single saturated brand color, hex code]` — used as a *small* accent only, never dominant
- **Secondary accent / wash (optional):** `[FILL: hex codes if applicable]`

### Allowed working palette in images

Beyond brand neutrals + signature accent, encourage the **natural colors of the materials themselves** specific to your industry. `[FILL: 5–10 honest material/industry colors from intake question 9.]` Saturation is welcome when it comes from real material, not post-production.

### Hard avoids (universal — keep all)

purple / magenta / neon cyan / acid pink / rainbow eco-gradients / over-filtered teal-and-orange grading / glowing neon / dark-mode SaaS / 3D renders / chrome plastic / HDR / CGI molecule chains / cartoon flat-design illustrations / stock-photo handshakes / globes-with-leaves / full frontal faces / AI-looking "smooth" plastic skin / any readable text, words, numbers, logos, or watermarks in the frame.

### Hard avoids (project-specific)

`[FILL: additions from intake question 10. Examples: "no rainbow LED content on screens", "no recognizable portraits", "no fluorescent uplighting on stages".]`

---

## §VI. Aesthetic rules

**Do:**

- `[FILL: photographic register — editorial documentary / industrial editorial / lifestyle / studio still life — shot with a 35 mm or 50 mm equivalent, or 24 mm for wide context shots]`
- Natural light (window, skylight, industrial ceiling fixtures, mixed daylight + warm work lights) — not ring light, not neon, not stage uplighting
- Real materials specific to the industry: `[FILL: list 5–10 real materials that naturally appear in your business. Examples: extruded aluminium, brushed steel, dye-sub fabric, walnut joinery, concrete floor, glass vessel, kraft paper, polymer pellet, raw resin.]`
- Shallow-to-moderate depth of field — enough to isolate subject, not dreamy bokeh
- Quiet asymmetry — subject on a third, generous neutral space on the opposite side (titles overlay)
- Organic touches when relevant (leaves, wooden pallet, hemp twine, plant life) — picks up sustainability/quality cues without cliché
- Human presence through hands, gloved hands, forearms, high-vis torsos, backs-of-heads, profiles — never full frontal faces or recognizable portraits
- `[FILL: add project-specific Do rules from the intake. Examples: "honest industrial dust, cable management in progress, unfinished graphic layers during install — pre-show authenticity, not marketing-perfect" / "matte architectural interiors, product stations, natural plant life, warm walnut or ash joinery"]`

**Don't:** see "Hard avoids" above (universal + project-specific).

---

## §VII. Composition

- **Aspect:** 16:9 landscape — target 1920×1080 or higher.
- **Framing:** subject on a third; generous neutral area on the opposite side for title overlay. `[FILL: left-weighted on listing cards vs. right-weighted on article heroes, or whatever your overlay system uses.]`
- **Depth:** one clear hero element + one supporting texture/context layer; resist stacking three subjects.
- **Focus:** tactile — a reader should want to touch the material.
- **Color discipline:** roughly 80% of the frame in neutrals, 15% in authentic material colour, ≤5% in signature accent.

---

## §VIII. Topic reflection

Every image must hint at its article topic through **real material or real industrial context**, never through icons, symbols, or stock-photo categories.

Build a 2-column table mapping the topic areas your blog actually covers to concrete visual subjects. Aim for 8–12 rows. Example skeleton:

| Topic area | Visual subject |
|---|---|
| `[FILL: topic area 1]` | `[FILL: 1–3 concrete visual subjects — real materials, real context, no symbols]` |
| `[FILL: topic area 2]` | `[FILL: ...]` |
| `[FILL: topic area 3]` | `[FILL: ...]` |
| `[FILL: ...]` | `[FILL: ...]` |

**Rule:** a reader glancing at the image should feel *"this is about a real industry and real materials,"* not *"this is a generic blog banner."*

---

## §IX. Prompt template

```
[REGISTER: e.g. Editorial documentary photograph / Industrial editorial photograph], shot on a 35mm, 50mm, or 24mm-wide lens, magazine-quality (think [TOUCHSTONE A], [TOUCHSTONE B], [TOUCHSTONE C]). 16:9 landscape, 1920x1080. [SUBJECT: one specific tactile material, industrial detail, or environment drawn from the topic table]. Natural light — [soft diffuse daylight from a window / warm industrial ceiling light / overcast exterior light / architectural daylight through a shopfront / warm work lamp on a bench]. Shallow-to-moderate depth of field, honest focus on the hero element. Restrained palette: neutrals ([LIST: e.g. white, concrete gray, matte black, warm kraft, brushed aluminium, warm walnut]) plus the authentic material colors [LIST 1–2 real material hues — e.g. denim blue, marigold, cream polyester, amber polymer, stainless], with at most a single small accent of [SIGNATURE ACCENT HEX] appearing naturally (equipment stripe, kraft tag, safety marker, plant leaf, painted door edge), never dominant. Tactile textures emphasised: [LIST 1–2 specific textures — e.g. shredded polyester fiber, polymer pellets, stainless steel, kraft paper, concrete floor, glass vessel, gaffer tape, fabric weave]. Generous negative space on one side for text overlay. No text, no words, no letters, no numbers, no watermarks, no readable logos. No cartoon illustration, no 3D render, no glowing neon, no HDR, no cliché stock-photo handshakes, no full frontal faces, [PROJECT-SPECIFIC AVOIDS]. Calm, precise, confident — documentary realism.
```

Fill the bracketed slots per article. Keep the prompt under ~1500 characters total — Nano Banana Pro adherence drops sharply past that.

---

## §X. Worked examples

Replace each placeholder block with a real article-specific example from your project. Aim for 3–5 examples that together span the topic table (one cornerstone, one abstract/financial topic, one process/material topic, one optional location/environment).

### Example 1 — `[FILL: article title or topic]`

```
[FILL: full crafted prompt following §IX template, with all bracketed slots filled. Should read as one paragraph, no line breaks inside the model input.]
```

### Example 2 — `[FILL: article title or topic]`

```
[FILL: full crafted prompt.]
```

### Example 3 — `[FILL: article title or topic]`

```
[FILL: full crafted prompt.]
```

### Example 4 (optional) — `[FILL: article title or topic]`

```
[FILL: full crafted prompt.]
```

### Example 5 (optional) — `[FILL: article title or topic]`

```
[FILL: full crafted prompt.]
```

---

## §XI. Notes for the generation script

- One image per topic is shared across all locales by default. Alt text is localized per locale in the uploader.
- Re-runs are idempotent: posts already carrying `heroImage.asset` are skipped. Pass `--force <slug>` to regenerate a single article.
- Generated files are committed under `public/images/blog/<primary-slug>.<ext>` for git asset history alongside the Sanity upload (skip the local copy if §1.J3 of the technical spec = sanity-only).
- If a topic sits between two rows of the topic table, pick the one that best matches the article's *primary question*, not its incidental vocabulary.
- If the model keeps pushing the signature accent into dominance, remove the accent line from the prompt entirely for that generation rather than fighting it.
- Human presence is strongly preferred over empty objects for roughly half of heroes — but always partial (hands, profiles, backs-of-heads) and never full frontal faces or recognizable portraits.
- Generate one smoke-test image and review it for brand adherence before batching the full set. Tighten the prompt template if the first image misses materially.

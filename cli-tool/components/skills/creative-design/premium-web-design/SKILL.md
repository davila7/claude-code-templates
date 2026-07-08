---
name: premium-web-design
description: >
  Create premium, Awwwards-quality website designs as React (.jsx) components that look like they were built by a top-tier
  agency charging $50k+ per project. Use this skill whenever the user asks for a website, landing page, portfolio,
  or web component that should look expensive, premium, luxury, editorial, high-end, or agency-quality. Also trigger
  when the user mentions Awwwards, FWA, award-winning design, or references brands like Apple, Aesop, Bottega Veneta,
  Stripe, or any luxury/fashion/design-forward brand. Trigger when the user says things like "make it look professional",
  "make it look expensive", "I want it to look really good", "high quality design", "not generic", or expresses
  dissatisfaction with typical AI-generated website aesthetics. Do NOT trigger for dashboards, admin panels, internal
  tools, or functional UI where aesthetics are secondary to utility — the standard frontend-design skill handles those.
---

# Premium Web Design

Create React (.jsx) components that look like they belong on Awwwards — the kind of work that makes people ask "who designed this?" These are sites where every pixel is intentional, every animation is choreographed, and the overall impression is that serious creative talent and budget were involved.

## The AI Aesthetic Problem

Most AI-generated websites share a recognizable DNA. Avoiding it requires knowing exactly what it looks like.

### The Blacklist — Never Do These

**Typography sins**
- Inter, Poppins, Montserrat, Raleway, Space Grotesk, Outfit as primary fonts — these scream "AI template". (Note: *Inter Tight* is a separate font family with different metrics and is allowed.)
- Using one font family for everything
- Uniform font sizes with predictable hierarchy (64px → 32px → 18px → 14px)
- Default letter-spacing and line-height everywhere
- Centered text blocks everywhere, especially multi-line paragraphs

**Color sins**
- Purple-to-blue gradients (the single biggest AI design cliché)
- Indigo/violet as a primary brand color with no contextual reason
- White background + one accent color + gray text (the SaaS starter kit)
- Gradients on buttons or cards for no reason
- Using opacity or semi-transparent overlays as a substitute for real color choices
- Neon accent colors on dark backgrounds (the "developer portfolio" look)

**Layout sins**
- Hero → 3-column feature grid → testimonials → CTA → footer (the default SaaS landing page)
- Hero → stats bar → work grid → about split → CTA → footer (the "premium AI" landing page — just as formulaic)
- ANY predictable top-to-bottom section ordering that could be swapped between sites. Every site must have its own unique structural DNA — different number of sections, different ordering logic, sections that don't fit neatly into categories
- Perfectly symmetrical grids with equal-sized cards
- Everything centered, everything contained in a max-width container
- Rounded rectangles with box-shadows as the primary UI element
- Icon + heading + paragraph cards in a row of 3 or 4
- Generic hero with headline + subheadline + two buttons side by side
- Static flat hero sections with just text — hero sections should be immersive spatial experiences

**Motion sins**
- Elements fading in from below on scroll (the overused AOS effect)
- Identical transitions on everything (same duration, same easing, same direction)
- Hover effects that just scale up or add a shadow
- Loading spinners instead of skeleton screens or choreographed reveals

**Imagery & decoration sins**
- Blob shapes as background decorations
- Floating geometric shapes (circles, triangles) as "design elements"
- Generic gradient mesh backgrounds
- Stock photo grids with uniform aspect ratios
- Emoji or generic line icons as section markers

---

## What Expensive Actually Looks Like

Premium web design communicates craft through restraint, surprise, and obsessive attention to detail.

### Typography as Identity

Typography is the #1 differentiator between a $500 website and a $50,000 one.

**Font selection philosophy:**
- Use distinctive serif or display fonts for headlines — fonts with personality and opinion. Good starting points: *Playfair Display, Cormorant Garamond, DM Serif Display, Fraunces, Instrument Serif* for serifs. For sans-serifs that aren't overused: *Syne, General Sans, Satoshi, Switzer, Cabinet Grotesk, Nacelle, Inter Tight, IBM Plex Sans, Manrope, Archivo, Work Sans, Instrument Sans*.
- Pair a characterful display font with a neutral-but-refined body font.
- Monospaced fonts as accent typography (for labels, categories, dates) add an editorial quality — *JetBrains Mono, IBM Plex Mono, Space Mono*.
- Mix weights dramatically — a 900-weight headline next to a 300-weight body creates visual tension.

**Typography execution:**
- `clamp()` for fluid type scaling instead of breakpoint jumps
- Dramatic size contrast — headlines can be 8vw+ on desktop
- Negative letter-spacing on large headlines (`-0.03em` to `-0.06em`)
- Generous line-height on body (1.6–1.8), tight on headlines (0.9–1.1)
- Mixed alignment — left-aligned body with occasional right-aligned labels or asymmetric headings
- `max-width` on paragraphs (45–75ch) and `text-wrap: balance` on headings
- Uppercase micro-labels with wide letter-spacing (`0.1em`+) for categories, dates, metadata

### Color as Atmosphere

- Start with black and white. Add color only when it earns its place.
- One dominant hue with intention — "what emotional territory does this color claim?"
- Off-whites and warm grays (not pure `#ffffff` or `#000000`) feel more designed — try `#FAFAF8`, `#F5F0EB`, `#1A1A1A`, `#0D0D0D`
- Monochromatic or analogous palettes with one moment of contrast read as more sophisticated than rainbow schemes
- Dark themes done right: not just "white on dark gray" but considered background layering with subtle warm or cool tints
- Color used sparingly hits harder — a single red link in a sea of black-and-white is more powerful than red everywhere

### Layout as Storytelling

The #1 failure mode of this skill is producing sites that *look different on the surface but share the same underlying structure* — a hero, three editorial sections, a pull quote, a form, a colophon. Over a batch of sites this starts to feel like a template with different colors. Fight this actively, and deliberately.

**The structural DNA uniqueness rule:**

Before writing any markup, **name the primary structural concept out loud** — a single noun phrase, like *"index manuscript"* or *"sticky horizontal diorama"*. Inside one batch of sites, **no two sites may share the same primary structural concept.** If the previous site was a sticky-scroll narrative, this one is not. If the previous site was a 33/67 vertical split, this one is not. The structural idea is the first thing the user notices — varying color without varying structure is cosmetic.

#### Structural DNA Catalog

These are distinct primary structures. Each skill invocation should pick a concept and commit to it. **Do not mix two structures into one site** (it dilutes both).

1. **Index Manuscript** — A single long editorial column, no sections. One typographic rhythm from top to bottom. The whole page reads like a single manuscript that happens to be a website. (Good for: a chef's menu, a perfumer's letter, a manifesto.)
2. **Sticky Horizontal Diorama** — The page is a long vertical scroll, but *what you see as you scroll* is a horizontally-panning scene. Use `position: sticky` + `translateX` driven by scroll. (Good for: a timeline of commissions, a process in stages, a collection of artifacts.)
3. **Two-Pane Permanent Split** — The page is always a 50/50 (or 38/62) split; one pane is sticky, the other scrolls. Navigation happens inside a pane, never by scrolling the whole page. (Good for: an archive with a live-updating index, a librarian's catalogue.)
4. **Slide Sequence** — Full-viewport-height "slides," one per screen, with snap scrolling. Each slide is a completely different composition. (Good for: a photographer's monograph, a gallery walkthrough, an editorial look-book.)
5. **Staged Object on a Plinth** — A single 3D/image subject sits centered, rotatable, and the whole rest of the page is marginalia that orbits the object. (Good for: a single-product house — a watch, a flacon, a bottle.)
6. **Pinned Narrative (Scrollytelling)** — A 2–4-screen-tall section pins in place while its contents advance through discrete states (image swaps, text swaps, progress). Used *once* in the page as its centerpiece. (Good for: a mission profile, a production process, a building collapse study.)
7. **Horizontal Navigation** — The primary page scroll is horizontal. Sections read left-to-right. Vertical scroll is disabled or reserved for detail reveals. (Good for: a horological archive, a museum's wing, a film studio's slate.)
8. **Sidebar + Column** — A persistent left-hand sidebar never scrolls (navigation, metadata, running footer); the right column is the entire site. (Good for: a legal practice, a research institute, an academic publisher.)
9. **Chapter Gates** — Full-viewport chapter dividers between very different tonal zones. Each chapter has its own background color, typographic weight, and layout rhythm. The page *changes character* as you descend. (Good for: a multi-discipline studio, a retrospective.)
10. **Ledger / Registry** — The page is presented as an old-school document — a bill of lading, a registry, a ship's manifest. Tabular rows dominate; typography reads like a ledger. (Good for: a waiting list, a batch register, an expedition manifest.)
11. **Collage / Grid-Breaker** — A magazine-style asymmetric grid with deliberate ruptures — oversized images bleeding into columns, pull-quotes crossing gutters, footnotes in the margins. (Good for: editorial publications, cultural magazines, creative studios.)
12. **Single Object, No Chrome** — The site is *just* the subject, rotatable, with a single short sentence below it. No nav, no footer, almost no UI. (Good for: an artist's single-piece release, a statement work.)
13. **Product UI Slate** — The hero is a realistic simulation of the product's own interface (dashboard tiles, diff view, command palette). Used by tech/AI brands whose product IS a UI. (Good for: AI IDEs, dev tools.)
14. **Dashboard Tile Grid** — The entire page is structured like a live-feeling dashboard with live counters, sparklines, pulsing pips. (Good for: infra, cybersecurity, observability.)
15. **Conversation Timeline** — The page plays back a simulated conversation/transcript/call as the user scrolls. Feature callouts anchor to specific moments. (Good for: voice AI, support platforms, legal interviews.)

**How to pick the concept:**
- Start from the client's central fact. A restaurant whose whole identity is one nine-course menu wants an *Index Manuscript*. A watchmaker whose identity is precision and a single calibre wants a *Staged Object on a Plinth*. An expedition company whose brand is one yearly journey wants a *Pinned Narrative*.
- Reject the concept if it's the one used last time in this session. Pick the next-best.
- Write down the concept and one sentence of justification *before* writing any JSX. Keep it visible in the prompt file.

**Layout principles (apply within whichever structural concept you pick):**
- Break the grid intentionally. Full-width moments followed by narrow text columns. Oversized images bleeding off-screen. Asymmetric two-column splits (60/40, 70/30).
- Generous whitespace isn't wasted space — it's a luxury signal. Padding of `8rem`+ between sections.
- Horizontal scrolling sections for portfolios or galleries (done well, not as the main navigation pattern — unless you deliberately chose *Horizontal Navigation*).
- Overlapping elements — text over images, images breaking out of their containers, elements that cross section boundaries.
- Sticky elements that accompany the scroll — a label that stays while content scrolls past.

**Specific micro-patterns that read as premium:**
- Masonry or staggered grids for visual content instead of uniform grids.
- Text that overlaps images with mix-blend-mode for editorial effect.
- Numbered or indexed sections with a visible progression.
- A visible grid system (subtle lines or columns) that the design occasionally breaks.
- Content that transforms as you scroll past it — not just appearing, but morphing, scaling, repositioning.
- Tabular / ledger rows for lists (batches, manifests, registries) rather than card grids.
- Form fields that look like parts of an editorial document, not a SaaS form — labels in small monospace above serif inputs, no outlines, bottom-borders only.

**Banned repeats (within a skill session):**
- Do not give two sites both a *"sticky left column + scrolling right column"* process section. Pick it for one; invent something else for the other.
- Do not open two sites with a *33/67 asymmetric hero*. If one did, the next opens with a centered stage, or a full-bleed backdrop, or a ledger, or no hero at all.
- Do not end two sites with the same "enquiry form + colophon grid" pair. Vary the closing move.

**Nav-bar variety — a silent failure mode to watch.**

The easiest default is a `grid-template-columns: auto 1fr auto` top bar with "brand mark on the left, something centred, something right-aligned, mix-blend-mode: difference". After three sites, it starts to read as a signature — not a design choice. In each session, **vary the nav substantially**:

- *No nav at all* (Single Object, No Chrome brands).
- *Nav baked into the sticky sidebar* (Sidebar + Column brands).
- *Bottom-fixed command bar* styled like `⌘K` launcher (tech-product brands — Cursor / Linear / Arc).
- *Inline centred wordmark* with tabs spread beneath as a secondary strip.
- *Full-width horizontal scroll index* that doubles as the nav.
- *Marquee nav* — continuously scrolling ticker with section names.
- *Left-vertical nav* written bottom-to-top.
- *Status-bar nav* with a live-operational pip.
- *Marquee-ticker strip* (benchmark prices, metrics) plus a slim top bar.

Pick the nav that belongs to the brand and the structural DNA — do not default to the three-column top bar.

**Avoid the editorial-luxury default.**

This skill gravitates, under pressure, toward: warm cream ground, serif display (Fraunces / Cormorant), monospace metadata, a single brass accent, wide-tracked uppercase micro-labels, `◦` bullet symbols. It's a real aesthetic, appropriate for couture, parfumerie, haute cuisine, horlogerie. It is **not** appropriate for tech, AI, cybersecurity, consumer electronics, SaaS, or developer tooling — and repeatedly defaulting to it makes every site in a batch look like the same agency did them.

**If the field is technology**, the aesthetic should skew toward: pure-white or near-black grounds (not cream); neo-grotesque sans-serifs (Söhne-feel, Inter Tight, IBM Plex Sans, Instrument Sans) as display type; monospace used as *display*, not just metadata; gradient-glow edges, shipped UI screenshots, live-feeling dashboard tiles, keyboard-shortcut chips inline with copy, code blocks rendered as the hero, iridescent/chrome/glass textures rather than brass-and-paper. See Vercel, Cursor, Linear, Windsurf, Stripe, Figma, Arc, Zed, Raycast, Supabase, v0.dev, Anthropic, OpenAI.

### 3D Components — The Core Differentiator

Every website built with this skill features 3D components. This is what makes these sites stand out from flat designs. But the 3D must look professional and polished — amateur 3D is worse than no 3D.

**DO NOT build 3D objects from Three.js geometric primitives** (boxes, cylinders, cones, spheres). Cars built from boxes look like toys. Rockets built from cylinders look like diagrams. Fire built from cones looks terrible. Three.js primitives are only acceptable for subtle atmospheric background effects (particle fields, grid planes, floating dots) — never as the main hero visual.

#### Step 1: Research the Industry — Deeply

Most AI-generated "premium" sites look generic because the research step is skipped or done to a depth of two sentences. A real reference pull is the single biggest quality lever in this skill.

**Depth requirement:** Study **at least 5 real reference sites** (not 2) — a mix of the most obvious industry leaders *and* less-famous editorial/cultural operators in the same space. The less-famous references are usually where the unique moves come from; the famous ones anchor the palette.

**Starting reference sets (expand, don't stop here):**

- **AI tooling / developer tools / IDEs** → **Vercel**, **Cursor**, **Windsurf**, **Linear**, **Stripe**, **Figma**, **Arc Browser**, **Zed**, **Raycast**, **Supabase**, **Replit**, **v0.dev**, **Anthropic**, **OpenAI**. Note: **dark-first or pure-white**, **monospace used as display** (not just metadata), **precise grids**, **keyboard-shortcut chrome** (`⌘K`, `⌘↵`), **gradient glow edges**, **animated code blocks in hero**, **dashboard-tile grids**, **sub-section headers in small-caps monospace**, **`<code>`-styled callouts**. Interactive hero often = an animated product UI snapshot, not a still image.
- **Cybersecurity / infrastructure** → **Cloudflare**, **Tailscale**, **1Password Business**, **Chainguard**, **CrowdStrike**, **Datadog Security**, **HashiCorp**, **Teleport**. Note: **scanning-beam hero animations**, **tessellated defensive grids**, **live-feeling status indicators**, **green/amber "operational" pips**, **dense data-density over whitespace**.
- **Enterprise AI / voice** → **Anthropic**, **OpenAI Platform**, **ElevenLabs**, **Vapi**, **Retell AI**, **Bland AI**, **Cohere**, **Deepgram**, **Cartesia**. Note: warm near-black grounds, editorial serif display, live transcripts as hero, latency numbers as typographic elements.
- **Aerospace / Defense** → SpaceX, Rocket Lab, Blue Origin, Sierra Space, Axiom, The Planetary Society, Royal Aeronautical Society. Note: dark themes, clean sans-serifs, full-bleed photography, mission-profile diagrams, minimal color accents.
- **Automotive** → Porsche, Rivian, Lucid, Singer Vehicle Design, Pagani, David Brown Automotive, Coachbuild.com. Note: dramatic product photography, mechanical drawings, full-screen immersive heroes.
- **Fashion / Luxury** → Bottega Veneta, Celine, The Row, Margiela, Lemaire, A.P.C., Phoebe Philo, Hermès. Note: extreme typographic restraint, serif display, near-silent whitespace.
- **Food / Restaurants** → Noma, Eleven Madison Park, Alinea, Central (Lima), Atomix, Chefs Club, René Redzepi's archive. Note: editorial photography, muted tones, menu-as-manuscript typography, course-by-course pacing.
- **Fragrance / Parfumerie** → Le Labo, Byredo, Frédéric Malle, Lubin, Maison Francis Kurkdjian, Diptyque, Santa Maria Novella.
- **Architecture** → 2x4, Olson Kundig, Herzog & de Meuron, Kengo Kuma, SANAA, David Chipperfield.
- **Horology** → F.P. Journe, A. Lange & Söhne, Philippe Dufour, Akrivia, Grönefeld, Urban Jürgensen.
- **Art / Galleries** → David Zwirner, Gagosian, Hauser & Wirth, Galerie Lelong, White Cube, Pace.
- **Publishing / Editorial** → New York Review of Books, Granta, The Paris Review, Apartamento, Zeit Online, MIT Press.
- **Music / Record Labels** → ECM Records, Warp, Mute, Nonesuch, Erased Tapes, Kompakt, Sub Pop.
- **Private Wealth / Fintech** → Addepar, Masttro, Pictet, Edmond de Rothschild, BlackRock Aladdin, Stripe.

**How to do the research pass:**

1. **Find the 5 sites.** Use `web_search`: `"[field] award-winning website"`, `"[field] Awwwards"`, `site:awwwards.com [field]`, `"[field] FWA winner"`. At least 2 of the 5 should be less-obvious editorial/cultural references, not the industry giants.
2. **Study each with `web_fetch`.** Pull patterns, not vibes. For each site, note specifically: primary display font, secondary body font, palette as hex approximations, structural DNA (which concept from the catalog), one signature move unique to that site.
3. **Write a 6–10 line design brief before coding.** In the prompt.md, write a "Design reference pull" block naming the 5 sites, the 3 specific patterns you're borrowing (and from which site), the palette (in hex), the font stack, and the structural DNA you've chosen.
4. **Do not copy — combine.** Pull one thing from each reference; the combination is what makes the site feel original rather than like a clone.

The design you build should feel like it belongs alongside these real competitors — not like it came from a different universe, and not like it's a carbon copy of any single one.

#### Step 2: Source Topic-Relevant 3D from Spline

**Spline (spline.design)** is a 3D design platform with a large community library of professional, embeddable 3D scenes. A Spline scene only earns its place on a premium site if a visitor, glancing at it, immediately understands *what it represents*. A beautiful scene that has nothing to do with the subject is **worse** than no scene — it erodes the sense that every pixel is intentional, and reads as "some cool 3D the designer found," which is the opposite of premium.

##### No real-branded-product scenes — ever

Spline community scenes often depict **real, trademarked products**: a Nike Air Jordan, a Sony WH-1000XM5, an Apple Watch, a Beats Studio, a Samsung Galaxy, a Tesla Cybertruck. **These are not usable for a fictional brand's website.** Using them creates three compounding problems:

1. **Legal.** Real branded products have trademarks, design patents, and licensing agreements. Placing a Nike shoe on a website for a fictional "Trio Nord" footwear brand is trademark confusion at best, and infringement at worst.
2. **Narrative.** A viewer who recognises the product — and most will — immediately knows the site is lying. The moment that recognition happens, the luxury illusion collapses.
3. **Generic.** A scene that exists *because* a Nike designer or Sony visualizer made it reads as "someone on Spline recreated a famous product." It never reads as *our* product.

**Rule:** Before committing a Spline scene, ask: *Is the object in this scene a real, identifiable product from a real brand?* If yes — reject it, no matter how well-rendered it is. Look for **abstract, category-representative, or original-design** scenes instead:

- Instead of Nike Air Jordan → a generic hand-lasted leather shoe, or an abstract footwear silhouette.
- Instead of Sony headphones → abstract floating audio-ring geometry, or a generic minimalist over-ear.
- Instead of Apple Watch → an unbranded bezel/dial, or a mechanical-movement diagram.

If no non-branded alternative exists for the subject, either (a) fall back to photography of a generic, unbranded product, (b) build an SVG illustration, or (c) pick a different field.

##### Field-first, not scene-first — the direction of sourcing matters

An easy failure mode: you have a usable Spline URL in hand, and you invent a field to justify using it. This reads as desperation. "A fountain-pen ink maker" does not exist as a premium brand in the world because someone wanted one — it exists because you had a dark-fluid scene and built a house of cards around it. The prompt gives it away.

**The correct order is:**

1. **Pick the field.** A real, plausible luxury / premium industry — automotive, horology, haute couture, fragrance, spirits, footwear, audio, eyewear, furniture, hospitality, leather goods, cutlery, skincare, private medicine, etc. The field must be one the user, shown the finished site, would immediately accept as a real business. Pen ink is not that.
2. **Define the product inside the field.** What, specifically, is the subject? A ring, a sneaker, a set of over-ear headphones, a chef's knife.
3. **Then search Spline for that product.** With the keyword-map expansion. Use both `my.spline.design/` and `prod.spline.design/` URLs.
4. **If no topic-relevant scene exists, change field — do not bend the field to match a scene you already have.**

A healthy batch of sites spans genuinely-different industries a reader recognises. A batch of sites whose shared thread is "whichever field the available Spline URLs imply" is not a portfolio — it's a rationalisation.

##### Scene uniqueness — no reuse within a session

**Within a single session / batch of sites, no two sites may use the same Spline scene URL.** Reusing a scene across multiple houses reads like a stock-photo library showing through, and undoes the SKILL's entire claim that each site is its own identity.

- If you've used `worldplanet` on one site, don't use it on the next, no matter how directly it "fits" the new field. Find a different scene.
- If you can't find a unique scene for the new field, **fall back to photography** or a deterministic SVG/CSS illustration — never recycle.
- Even scenes that seem interchangeable (two different Earth scenes, two different fluid scenes) should not all appear in one batch. One Earth scene per batch. One fluid scene per batch.
- At the top of every new `prompt.md`, list the Spline URLs already used in this session by the previous sites. Confirm the new site's URL is NOT in that list.

##### The cardinal rule: topic-literal, not topic-metaphorical

A Spline scene is acceptable only when it **literally depicts the subject of the site's brand.** Metaphorical links are rejected, even if they're poetic:

- A fluid scene is fine for an **ink maker** (the fluid IS ink) but **not** for a restaurant (broth does not justify a black fluid next to a menu).
- An Earth scene is fine for a **spaceflight company** (the Earth is what passengers see) or a **cartographer** (Earth is what they map) but **not** for a family office "with global reach" (the link is metaphorical).
- A watch scene is fine for a watchmaker, not for a "time-respecting" consulting firm.

Before using any Spline scene, state out loud in the `prompt.md`: *"The scene depicts X. My site's subject is X."* If those two X's are not the same noun, reject the scene. The brand itself must be in the business of whatever the scene shows — not merely invoke it symbolically.

**The two-second test still applies:** with no caption, a viewer should name the subject of the scene. A "nice abstract composition" is not a subject.

##### Theme harmony — the scene and the site must visually belong to each other

A Spline scene has its **own backdrop color and lighting mood baked into the render.** If that backdrop fights the site's palette, the scene will look cut out and pasted on — amateurish, no matter how premium the 3D itself is. Before committing a scene, check:

- **Dark scene on a dark site** — Works. The scene's black edges dissolve into the page.
- **Light scene on a light site** — Works. The scene's light backdrop extends the paper.
- **Dark scene on a light site** — Usually **fails** (looks like a hole punched into the page). Only acceptable with a deliberate framed-viewport treatment (a bordered "window" into the dark scene, like a photograph on a wall).
- **Light scene on a dark site** — Same failure pattern, inverse. Same mitigation.

Write down, in the `prompt.md`, the **scene's native backdrop color** and the **site's ground color**. If they're opposite and there's no framed-viewport treatment, pick a different scene or pick a different theme.

##### Expand the search vocabulary before searching

Never search Spline for just the topic word. A single-keyword search misses 90% of relevant scenes — most creators title their work by what's *in* it (wheel, tire, headlight) rather than the category.

Before searching, build a keyword map of **at least 8–12 terms** covering:

- **The subject itself** — car, watch, perfume bottle
- **Synonyms / category terms** — automobile, sportscar, vehicle, supercar; timepiece, chronograph; fragrance, parfum, scent
- **Iconic components and close-ups** — wheel, tire, rim, engine, exhaust, dashboard, steering wheel, headlight; gears, tourbillon, crown, dial, movement; bottle, glass, droplet, atomiser
- **Materials and surfaces** — chrome, metal, leather, carbon; brass, platinum, gold, steel; crystal, glass, amber liquid
- **Processes / environments** — assembly, atelier, race track, showroom; workshop, manufacture, loupe; apothecary, laboratory
- **Symbols / metaphors** — horizon, motion lines; orbit, constellation, star; flower, smoke, vapor

Also search Awwwards, Codrops, Tympanus, Dribbble, Twitter/X, and **production-site HTML** (`"<iframe" "my.spline.design"`, `"<spline-viewer" "scene.splinecode"`, `site:codepen.io "my.spline.design"`, `site:github.com "my.spline.design"`). URLs found inside working iframes on live sites are guaranteed to render.

**Do a minimum of three search passes:**
1. **Slug/topic pass** — direct `site:my.spline.design [keyword]` for every word in the keyword map.
2. **Community-page pass** — `community.spline.design/tag/[keyword]`.
3. **Harvesting pass** — `"<iframe" "my.spline.design/[topic keyword]"` to find URLs already embedded in live production sites.

##### Spline URL format reference — know what you have

Spline has **four** URL formats you will encounter. Only two of them are usable as embeds.

| URL shape | What it is | Usable as embed? | How |
|---|---|---|---|
| `community.spline.design/file/[uuid]` | Community gallery page (HTML with JS viewer) | ❌ No | Sends `X-Frame-Options`, blocks iframe. Also does not expose the embed URL in its HTML — the `my.spline.design` slug is added client-side after the user hits Share. |
| `app.spline.design/community/file/[uuid]` | Spline editor, opened to that community file | ❌ No | Editor page, not an embed. |
| `my.spline.design/[slug]/` | Published HTML scene page | ✅ Yes, via **iframe** | `<iframe src="https://my.spline.design/[slug]/">` |
| `prod.spline.design/[id]/scene.splinecode` | Raw runtime binary | ✅ Yes, via **spline-viewer** | `<spline-viewer url="https://prod.spline.design/[id]/scene.splinecode">` |

**Critical misuse to avoid:** do NOT put a `.splinecode` URL into an `<iframe src>` — it renders as a broken placeholder or a binary download. Use the web component. Conversely, do NOT put a `my.spline.design/` URL into a `<spline-viewer url>` — the viewer expects the runtime binary, not an HTML page.

**Never fabricate slugs.** The community file UUID and the published scene slug are different identifiers; guessing the slug almost always 403s. If you cannot verify a URL returns HTTP 200, it doesn't exist.

##### Community URLs: an important reality

Scenes shown at `https://community.spline.design/file/[uuid]` are **not directly iframe-embeddable** — the community domain sends `X-Frame-Options` headers that block framing, and Google does not index the underlying `my.spline.design/[slug]/` URL. When search surfaces a perfect-looking community scene, you cannot simply iframe `community.spline.design/file/...`.

Workarounds, in order of reliability:
1. **Ask the user** to open the community file, hit *Share → Public URL*, and paste the `my.spline.design/…` link. This is the correct answer when you've found the *ideal* scene but can't extract its embed URL.
2. **Check if the creator linked it on their portfolio** — many Spline creators embed their own scenes on their personal site.
3. **Remix workflow** — the user opens the community file, clicks *Remix*, and the remixed copy belongs to their account with its own public `my.spline.design` URL they can share.
4. **Accept the limitation** — if you cannot verify a URL, do not guess the slug.

##### Spline embed — the bulletproof pattern (both methods)

Spline sizing problems have one underlying cause: the **scene's internal canvas fills 100% of the container**, and **the space around the 3D object is filled with the scene's internal background color** — which defaults to a neutral color the creator chose, *not* your page's ground. When you drop a scene into a tall container, the scene looks correct in the part the object occupies and looks like a solid-color void in the rest. That void is the scene's background, not a rendering bug.

**The fix has three parts, always applied together:**

1. **Container defines size explicitly** — width, height, position, overflow:hidden. Never rely on the scene to size itself.
2. **Scene element fills the container — position:absolute, inset:0.**
3. **Match the scene's background to your page's ground** — via the `background` attribute on `<spline-viewer>`, or (for iframes) by picking a scene whose native backdrop already matches.

**Method 1 — iframe embed (for `my.spline.design/[slug]/` URLs):**

```jsx
// Container — always defines size + overflow:hidden
<div
  style={{
    position: "relative",
    width: "100%",
    height: "100%",           // or a specific value / aspect-ratio / vh
    minHeight: 420,           // guarantees a usable minimum
    overflow: "hidden",
    background: "#0A0B0F",    // matches the page ground — seen during load
  }}
>
  {/* skeleton loader underneath — visible until Spline paints */}
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(110deg, #0A0B0F 30%, #151821 50%, #0A0B0F 70%)",
      backgroundSize: "200% 100%",
      animation: "skl 1.8s ease-in-out infinite",
      zIndex: 0,
    }}
  />
  <iframe
    src="https://my.spline.design/[scene-slug]/"
    style={{
      position: "absolute", inset: 0,
      width: "100%", height: "100%",
      border: "none", display: "block",
      zIndex: 1,
    }}
    title="3D Scene"
    loading="lazy"
    allow="autoplay; fullscreen"
  />
</div>
```

The iframe cannot be told what background to render — you get whatever the creator baked in. If it doesn't match your page, either (a) accept a framed-viewport treatment (surround the scene with a visible bordered card), or (b) switch to a `.splinecode` URL of the same scene and use the web component (below), which can override the background.

**Method 2 — `<spline-viewer>` web component (for `prod.spline.design/[id]/scene.splinecode` URLs):**

This is the **preferred** method for tech sites where theme-harmony matters, because `<spline-viewer>` exposes a **`background` attribute** that replaces the scene's internal background entirely.

```jsx
// Inject the viewer script once per app (put in main.jsx or the first component that uses it):
useEffect(() => {
  if (document.querySelector('script[data-spline-viewer]')) return;
  const s = document.createElement("script");
  s.type = "module";
  s.src = "https://unpkg.com/@splinetool/viewer@1.9.28/build/spline-viewer.js";
  s.setAttribute("data-spline-viewer", "1");
  document.head.appendChild(s);
}, []);

// Then render the viewer inside a sized container.
// Use dangerouslySetInnerHTML because JSX can't parse the custom tag's `background` attribute as a color.
<div style={{ position: "relative", width: "100%", height: "100%", minHeight: 480, overflow: "hidden" }}>
  <div
    dangerouslySetInnerHTML={{
      __html: `<spline-viewer
        url="https://prod.spline.design/[id]/scene.splinecode"
        background="#0A0B0F"
        style="position:absolute;inset:0;width:100%;height:100%;display:block;"
      ></spline-viewer>`,
    }}
  />
</div>
```

The `background` attribute accepts any CSS color value — `#0A0B0F`, `transparent`, `rgba(11,16,20,0.9)`. **Set it to your page's ground color.** The empty area around the 3D object now blends into the page, and the "bottom half is black" problem disappears.

##### Spline scene types — avoid "hero section" scenes

Not every Spline scene is a discrete 3D object. The community is full of scenes titled things like:

- *"reeded glass prism — hero section UI concept"*
- *"AI landing page hero"*
- *"SaaS hero with CTA"*

These scenes contain their own **baked-in HTML-like text, buttons, and layout**, rendered as part of the 3D composition. When you embed one, you get a full pre-designed hero inside your hero — the scene's own text fights with your page's text, and the scene's own CTA competes with yours.

**Before committing a scene, read its title.** If the title contains *"hero section," "landing page," "UI concept,"* or *"website template"* — treat it with suspicion. Open it, look at it, and either:

- Accept the scene AS the hero (delete your own hero HTML on top of it).
- Reject the scene and find a pure-object scene (one whose title is just an object — *"watch," "shoe," "orb"* — not a composition).

##### Camera framing — how to fix "object too small / too zoomed"

If the scene renders at the wrong zoom (object tiny in a big canvas), the creator's baked-in camera is the cause. Three fixes, in order of simplicity:

1. **CSS transform** — wrap the viewer in a container and apply `transform: scale(1.4)` to the inner element. The whole rendered canvas scales up; the container's `overflow: hidden` clips the edges. Simple, works with both iframe and web-component.
2. **Narrower container** — Spline canvases auto-fit. A narrower, taller container tends to zoom the scene in; a wider, shorter container shows more empty space around it. Adjust the container's aspect-ratio to crop toward the object.
3. **React Spline with `setZoom()`** — only if you're using `@splinetool/react-spline` (not `<spline-viewer>`). The `onLoad` callback receives a Spline `Application` object with a `setZoom(level)` method. Call `application.setZoom(1.5)` on load.

##### Loading states — never show blank white

Spline scenes are 1–16 MB binaries. They load in 2–8 seconds on a fast connection. During that window, a blank white viewport is the worst possible experience.

**Always layer a skeleton loader beneath the scene**, inside the same container. The container has the skeleton as its background (via a shimmering gradient animation), the scene paints on top when it loads. No JavaScript coordination needed.

```css
@keyframes skl {
  0% { background-position: 0% 50%; }
  100% { background-position: -200% 50%; }
}
```

The skeleton should use the page's ground color + one slightly lighter tint. Never use a white skeleton on a dark site.

##### The relevance test — apply before committing

Once you have a candidate scene, run these **four** checks. If any fails, keep searching:

1. **It actually resolves.** `curl -I [url]` returns 200, not 403/404. Guessed slugs from community UUIDs almost always 403. If you can't verify a 200, the URL doesn't exist.
2. **It looks right when rendered.** Load the URL in a browser (or the preview iframe) and *look at it*. Many Spline URLs whose slug says "rocket" or "robot" turn out to be low-poly cartoon scenes in garish purple. A slug is not a guarantee of quality — your eye is. Screenshot the iframe before committing the site to use it.
3. **Subject recognition** — With no caption and a two-second glance, would a viewer name the subject correctly? ("A car." "A rocket." "A perfume bottle.") A "nice composition" is not a subject.
4. **Brand fit** — Does the scene's palette, lighting mood, and polish match the brand direction? A low-poly toy-car style is not luxury. A neon-glow cyber-robot is not a medical AI company.

**Do not skip step 2.** Slugs lie. Every Spline URL must be visually verified in a real browser before you commit a whole site's design around it.

##### After-build render-size check — MANDATORY

Verifying the URL *works* is not the same as verifying the scene *renders at the right size in your layout.* Spline scenes have their own internal camera and framing — dropping one into a small viewport, a wide banner, or an awkward aspect ratio often crops the subject out of frame or shrinks it to a speck.

**After you build the site, before calling it done, do this in order:**

1. Start the preview.
2. Load the page and wait 6–10 seconds for the Spline runtime to load.
3. **Screenshot the hero.**
4. Look at the screenshot. The subject of the scene must be:
   - **Visible** (not cropped off to the side, not behind a veil you forgot to make transparent)
   - **Proportional** (not taking 4% of a 1600px container — it should read at the intended size)
   - **Intact** (the model is whole, not cut in half by your typography layer)
5. If any of those fail: adjust the container's aspect ratio, resize the iframe, add scene padding via `transform: scale()` on the iframe, or change to a different scene positioning (stage / backdrop / companion).
6. Screenshot again. Repeat until the scene renders correctly.

Common size failures and fixes:
- *Scene appears tiny in a huge container* → the scene's camera is at a fixed zoom and the creator set it for a different aspect. Either (a) put the scene in a smaller, matching-aspect container, or (b) apply `transform: scale(1.4)` on the iframe to zoom in.
- *Scene is cropped off the side* → the scene's natural center is offset; use `transform: translateX()` on the iframe to recenter.
- *Scene disappears into a dark-on-dark background* → your CSS veil is too heavy, or the site bg is suffocating the scene. Lower the veil opacity. Use `background` attribute.
- *Scene backdrop is the wrong color for the site* → you violated the theme-harmony rule; use the `background` attribute (for spline-viewer) or pick a different scene.

This step is not optional. A site that contains a miscentered or wrong-sized Spline scene is strictly worse than a site with a well-composed still image.

##### Positioning is part of relevance

Even the right scene fails if it's placed poorly. Pick one of these spatial logics — don't just drop the scene into a panel and hope:

- **Stage** — Scene is framed like a product on a plinth. Full viewport (or large contained area), centered, typography around it. Works for cars, watches, bottles, any physical object. The user can rotate it. This is usually the right choice.
- **Backdrop** — Scene fills the entire viewport behind the hero typography, with a gradient veil so type stays legible. The scene is context/atmosphere, not focus. Works when the scene has a dominant subject that reads even at 20% opacity (earth, rocket, planet).
- **Companion** — Scene lives in a dedicated panel (40/60 or 33/67 split) with typography on the other side. Only acceptable if the scene's subject is *obviously* topic-relevant.
- **Object in a spread** — Scene is small-to-medium and anchored in a specific grid position, treated like a framed photograph in an editorial layout. Works in manifesto or story sections, not usually the hero.

If your chosen scene doesn't fit any of these with clear logic, that's a signal to find a different scene — not to wedge it in.

##### Fallback hierarchy — always layered, never a panicked switch

If no topic-relevant Spline scene can be verified after a full search, do NOT force one. And do not build a brittle "if Spline fails, swap to photo" JavaScript flip — that's a visible glitch. Instead, **layer the fallback underneath the Spline viewer**, so if Spline is slow or fails, the user still sees something intentional.

**The hierarchy, in order:**

1. **Client-provided assets** — if the user has their own Spline scene, product renders, brand video, ask for them first.
2. **Verified Spline scene** (`my.spline.design/[slug]/` or `prod.spline.design/[id]/scene.splinecode`) that genuinely depicts the subject.
3. **Professional still photography** (client-provided, or tightly curated from Unsplash) with CSS parallax + subtle grain/filter. Always screenshot-verify the image renders as expected.
4. **CSS / SVG illustration** — a deliberate custom illustration (Geneva stripes, a hand-drawn diagram, a rendered mockup) built entirely in HTML/CSS/SVG. Deterministic, no network dependency.
5. **Three.js atmospheric layer** — a minimal particle field, grid plane, or drifting-dust canvas as *background atmosphere only*, behind a still-image or typographic hero. Never the main visual.

**Layered implementation (CSS-only fallback under Spline):**

```jsx
<div className="hero-stage">
  {/* Layer 0 — always visible. The base fallback (photo or illustration). */}
  <div className="hero-fallback" />

  {/* Layer 1 — Spline paints over the fallback if/when it loads.
      If Spline 404s, never loads, or is disabled, layer 0 remains visible. */}
  <div
    className="hero-scene"
    dangerouslySetInnerHTML={{
      __html: `<spline-viewer url="..." background="transparent" style="..."></spline-viewer>`
    }}
  />
</div>

/* CSS */
.hero-stage { position: relative; width: 100%; height: 100%; overflow: hidden; }
.hero-fallback {
  position: absolute; inset: 0;
  background-image: url("https://images.unsplash.com/photo-[verified-id]?w=1800&q=85");
  background-size: cover; background-position: center;
  filter: saturate(0.9) contrast(1.05);
  z-index: 0;
}
.hero-scene { position: absolute; inset: 0; z-index: 1; }
```

When Spline uses `background="transparent"`, the empty space around the 3D object reveals the fallback photograph underneath. The page always has a visible hero — Spline is an enhancement, not a requirement.

##### Photography fallback — verify the image, don't guess

Unsplash URLs are convenient but unverifiable without loading. A URL like `https://images.unsplash.com/photo-1548484352-ea579e5233a8?w=1200&q=80` looks specific (it names a photo ID) but the photographer may have replaced or removed the file, the crop may be different from what you expect, and at a different viewport aspect ratio you may see a different subject entirely than what the photo is *named* for.

When using photography fallback:

1. **Prefer client-supplied imagery first.** Ask the user for product photos.
2. **If you must use Unsplash**, pick photos you have already seen (either via a tool that can render the URL, or by asking the user to confirm the photo). Do NOT pick a photo ID because its filename implies the topic — verify.
3. **After build, screenshot the photograph in situ.** Look at it. Confirm the subject, the crop, and the color treatment.
4. **If the photograph doesn't render as you expected, swap it.** Search Unsplash again by the exact concrete noun — and re-screenshot.

**If no relevant scene or photograph exists**, a deterministic **CSS/SVG illustration** is always a valid alternative — built entirely in the page, no network dependency, always renders identically. Examples: a cross-section diagram of a CLT timber panel, Geneva-stripes on a watchmaker's bridge, a sneaker silhouette, a reactive orb built from conic gradients.

**An irrelevant 3D scene, however pretty, damages the luxury impression. A considered still image or SVG illustration doesn't.**

### Color and Typography Must Match the Industry

- **Aerospace / Defense**: Dark backgrounds (`#0A0A0A`, `#0C1222`), clean sans-serifs, minimal accent colors (white, silver, or a single restrained blue). Think SpaceX — not orange and white.
- **Automotive**: Deep blacks, dramatic lighting effects, premium sans-serifs or geometric fonts, metallic accent tones. Think Porsche — restrained, confident.
- **Fashion / Luxury**: Extreme restraint. Serifs for display, thin sans-serifs for body. Near-black and off-white. No bright accent colors. Think Bottega Veneta.
- **Food / Restaurant**: Warm tones (cream, charcoal, muted earth), editorial serifs, generous whitespace. Think Noma.
- **Tech / AI tooling**: Can go darker or lighter, but avoid the purple-gradient cliché. Clean, systematic layouts with monospace display. Think Linear / Vercel / Cursor.
- **Finance / Legal**: Conservative palettes (navy, charcoal, forest), traditional serifs for authority, structured grids.

**Bad color choices** that make sites look unprofessional:
- Orange + white for aerospace (looks like a construction company)
- Bright cyan on black for everything (looks like a hacker movie)
- Using the same accent color across different industries

**Critical technical rules:**
- Always `import React` alongside hooks: `import React, { useState, useEffect, useRef } from "react";`
- Never use JSX fragments (`<>...</>`) — use `<span>` or `<div>` instead for compatibility
- When using iframes for Spline, set `loading="lazy"` and provide a styled loading placeholder
- When using images, always include `?w=1920&q=80` parameters for Unsplash URLs
- For any Three.js: set `alpha: true`, use `setPixelRatio(Math.min(window.devicePixelRatio, 2))`, and clean up on unmount

### Scroll-Driven Experiences

Scrolling should feel like a directed journey, not just moving down a page.

**Scroll-driven techniques:**
- **Parallax layers**: Multiple elements moving at different speeds. Track `window.scrollY` and apply different multipliers to different elements.
- **Horizontal scroll sections**: A section that scrolls horizontally as the user scrolls vertically. Use `position: sticky` on a container with `overflow: hidden`, then `translateX` inner content based on scroll progress.
- **Scale-on-scroll**: Elements that grow from small to full-size as you scroll through them. Use `IntersectionObserver` with a threshold array, or calculate progress from `getBoundingClientRect()`.
- **Text reveal on scroll**: Individual words or lines reveal as the scroll reaches them. Split text into spans and trigger each based on its position.
- **Scroll-linked color transitions**: The page background or text color smoothly shifts as the user scrolls between sections.
- **Pinned scroll sequences**: A section stays pinned while content within it changes — images cycle, text swaps, or a narrative progresses.
- **Zoom-through transitions**: Content that the user "zooms into" as they scroll — starts small and distant, grows to fill the viewport.

**Implementation pattern for scroll progress:**

```jsx
const getScrollProgress = (element) => {
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  return Math.max(0, Math.min(1, 1 - (rect.top / windowHeight)));
};

useEffect(() => {
  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        // update state based on scroll
        ticking = false;
      });
      ticking = true;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);
```

### Motion Choreography

Beyond scroll-driven effects, all motion should feel directed and sequenced:

- Stagger everything — nothing should move simultaneously. Orchestrate with `animation-delay` or sequenced timers.
- Speed variation creates life: fast entrance (200–300ms) + slow settle (500–800ms).
- Easing defines personality: `cubic-bezier(0.16, 1, 0.3, 1)` for smooth overshoots, `cubic-bezier(0.77, 0, 0.175, 1)` for snappy, `cubic-bezier(0.33, 1, 0.68, 1)` for elegant ease-out.
- Clip-path reveals for text and images — expanding rectangles or polygons.
- Split-text animations where each word or character animates independently.
- Cursor-following elements or magnetic buttons for interactive moments.

### Micro-Details That Signal Craft

These small things separate premium from "pretty good":

- Custom cursor styles (a small dot cursor, or cursor that changes near interactive elements)
- Scroll progress indicators (subtle line at the top of the viewport)
- Smooth scroll behavior with `scroll-behavior: smooth` or a library like Lenis
- Loading states that are designed — skeleton screens that match the layout, or a branded loader
- Transitions between states (hover, active, focus) that feel considered, not default
- Border-radius used sparingly and consistently — either sharp corners (0) for editorial/brutalist or very specific radii, never the default `8px` on everything
- Subtle grain/noise texture overlays on backgrounds for warmth and depth (use SVG filters)
- Selection color (`::selection`) styled to match the brand
- Scrollbar styling on webkit browsers

---

## Implementation Guide for React (.jsx)

### Structure

```jsx
// Always use a default export with no required props
export default function SiteName() {
  return (
    <div>
      {/* Full implementation */}
    </div>
  );
}
```

### Font Loading

Import from Google Fonts via `@import` in a `<style>` tag or use `<link>` in the component. Always provide a thoughtful fallback stack.

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
```

### Available Libraries

- **Three.js (r128)** — for atmospheric backgrounds only (particles, grids). Import as `import * as THREE from 'three'`. Note: `THREE.CapsuleGeometry` is NOT available in r128. OrbitControls are NOT available — implement camera movement manually.
- **@splinetool/viewer** via CDN script for `<spline-viewer>` web component
- **lucide-react** for icons (but use sparingly — overuse of icons is an AI tell)
- **recharts** for data visualization
- **d3** for complex animations/visualizations
- **lodash** for utilities
- **Tone.js** for audio

### CSS Approach

Use inline styles or a `<style>` tag within the component. CSS variables are essential for theming consistency:

```css
:root {
  --color-bg: #FAF9F6;
  --color-text: #1A1A1A;
  --color-text-muted: #6B6B6B;
  --color-accent: #C8553D;
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'DM Sans', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --space-unit: clamp(1rem, 2vw, 2rem);
}
```

### Animation Patterns

Prefer CSS animations and `IntersectionObserver` for scroll-triggered effects. Use `useRef` and `useEffect` for observers, `useState` for animation state triggers.

```jsx
const [isVisible, setIsVisible] = useState(false);
const ref = useRef(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
    { threshold: 0.15 }
  );
  if (ref.current) observer.observe(ref.current);
  return () => observer.disconnect();
}, []);
```

### Responsive Strategy

Design desktop-first for visual impact, then adapt for mobile. Use `clamp()` aggressively for fluid spacing and typography. Restructure layouts at breakpoints rather than just shrinking.

---

## The prompt must be detailed — a checklist, not a paragraph

When a user (or this skill) drafts a `prompt.md` for a new site, a short prompt produces short output. The skill produces its best work when the prompt names every decision explicitly. A **complete prompt** contains each of the following, in order:

1. **Field-first declaration** — the industry, the specific product inside it, why this field is real (not a dodge for a scene).
2. **Scene / subject match** — Spline URL, what it depicts, what the site's subject is, confirmation they are the same noun, the scene's native backdrop color, the site's ground color, theme-harmony verdict.
3. **Previous scenes used this session** — the list of URLs already used, confirming the new URL is not in it.
4. **Structural DNA** — the chosen concept by name, the previous sites' DNAs, confirmation the new one is distinct.
5. **Design reference pull** — 5+ specific real production sites, for each: the one move we're borrowing, named. For tech/AI, include Vercel, Cursor, Linear, Windsurf as defaults.
6. **Palette** — 4–6 hex values with emotional roles (ground / ink / accent / secondary-accent).
7. **Font stack** — display / body / mono, by name. Reject any of the blacklisted fonts (Inter, Poppins, Montserrat, Raleway, Space Grotesk, Outfit).
8. **Nav pattern** — which of the nav variants from the catalogue this site uses; explicitly not the default top-bar three-column layout unless it's genuinely the right choice.
9. **Brand voice** — 3–5 sentences of voice calibration. How does the copy read? What does this brand NOT say?
10. **Structure — every section** — name, position, what it contains, length. A 6-section prompt yields a 6-section site; a vague "some sections" prompt yields a template.
11. **Specific copy hooks** — at least 3 concrete lines that must appear verbatim on the site (hero headline, a pull quote, a closing line). These anchor tone.
12. **Specific technical hooks** — if tech/AI: keyboard-shortcut chips, fake code blocks, specific pricing tiers, fake CLI commands, fake product names, fake customer logos (marked as illustrative). If luxury: batch numbers, commission registers, specific material provenance.
13. **Motion choreography** — 2–3 specific motion techniques: one hero-entry animation, one scroll-driven behaviour, one micro-interaction. Do not repeat techniques used in previous sites this session.
14. **Critical rules / banned moves** — what this site must NOT do: banned colors, banned structural moves, banned patterns from the previous sites. Explicit.
15. **Render verification checkpoint** — after build, the specific screenshot the builder must take and the specific failure mode to watch for.

A prompt is "done" when every one of those 15 items has a concrete, specific answer. Vague answers ("warm palette", "some motion", "clean layout") are rejected — they are the failure mode of the SKILL.

---

## Process

When the user asks for a premium website:

1. **Absorb the brief — field-first.** Understand the brand, audience, purpose, and field/industry. The field must be a **real, plausible premium industry** a viewer would accept without explanation — automotive, horology, haute couture, fragrance, footwear, audio, eyewear, private medicine, etc. Do NOT invent a niche brand ("fountain-pen ink manufactory," "astronomical almanac publisher") as a dodge for an available Spline scene. Ask the user if they have product images, brand assets, videos, or specific 3D models they want used.
2. **Research the industry — deeply.** Study **at least 5** real reference sites (a mix of industry giants and less-obvious editorial/cultural operators). For each, write down the primary display font, body font, palette in hex, the structural DNA used, and one signature move. Compose a 6–10 line **Design reference pull** block at the top of the site's `prompt.md`.
3. **Source topic-relevant 3D from Spline — and confirm it's unique to this site.** Build a keyword map of 8–12 terms for the product you're selling. Run three search passes: `site:my.spline.design [keyword]`, `community.spline.design/tag/[keyword]`, production-site harvest (`"<iframe" "my.spline.design"`, `"spline-viewer" "scene.splinecode"`). Accept either embed format. Check the list of Spline URLs already used by previous sites in this session — **the new site's URL must not match any of them.** If all available scenes have already been used, fall back to photography or SVG/CSS illustration, do not recycle. Candidate scenes must pass the four-check test: resolves 200, renders at the expected quality when loaded, subject nameable in two seconds, mood matches the brand. Never fabricate a slug. Reject scenes depicting real-branded products. Decide positioning (stage / backdrop / companion / object-in-spread) before committing.
4. **Pick the structural DNA, by name.** From the Structural DNA Catalog, choose *one* primary concept for the page and write it at the top of the prompt file as a single noun phrase. Confirm it is NOT the concept used by the previous site in this session.
5. **Commit to a concept.** Based on the industry research and the structural DNA, define a creative direction that fits the field's visual language.
6. **Build the type system.** Pick fonts that match the industry (based on research). Set the scale, define the hierarchy. Avoid blacklisted fonts.
7. **Design scroll-driven transitions.** Plan how the user's scroll journey unfolds. Use at least 2–3 different scroll techniques throughout, but do not repeat the same technique already used as a centerpiece in a previous site this session.
8. **Obsess over details.** Custom selection colors, considered hover states, refined spacing, grain textures, custom scrollbar.
9. **Verify the render — not optional.** Start the preview, load the page, wait 6–10 seconds for the Spline runtime, then **screenshot and look**. The scene's subject must be visible, proportional, and intact; its native backdrop color must not clash with the site's ground. If the scene is cropped, miscentered, wrong-sized, or theme-clashing, fix it before calling the work done. A site with a botched Spline render is strictly worse than a site with a well-composed still image.

Never explain that you're "researching competitors" or "sourcing 3D" — just execute with craft. The design should speak for itself.

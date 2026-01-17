---
name: baoyu-slide-deck
description: Generate professional slide deck images from content. Creates comprehensive outlines with style instructions, then generates individual slide images. Use when user asks to "create slides", "make a presentation", "generate deck", or "slide deck".
---

# Slide Deck Generator

Transform content into professional slide deck images with flexible style options.

## Usage

```bash
# Auto-select style based on content
/baoyu-slide-deck path/to/content.md

# Specify a style
/baoyu-slide-deck path/to/content.md --style sketch-notes
/baoyu-slide-deck path/to/content.md --style minimal

# Target specific audience
/baoyu-slide-deck path/to/content.md --audience executives

# Set output language
/baoyu-slide-deck path/to/content.md --lang zh

# Limit slide count
/baoyu-slide-deck path/to/content.md --slides 10

# Generate outline only (skip image generation)
/baoyu-slide-deck path/to/content.md --outline-only

# Direct content input
/baoyu-slide-deck
[paste content]

# Combine options
/baoyu-slide-deck path/to/content.md --style storytelling --audience experts --slides 15
```

## Options

| Option | Description |
|--------|-------------|
| `--style <name>` | Visual style (see Style Gallery) |
| `--audience <type>` | Target audience: beginners, intermediate, experts, executives, general |
| `--lang <code>` | Output language for prompts and slides (en, zh, ja, etc.) |
| `--slides <number>` | Target slide count |
| `--outline-only` | Generate outline only, skip image generation |

## Style Gallery

| Style | Description | Best For |
|-------|-------------|----------|
| `sketch-notes` | Hand-drawn sketch notes, warm & friendly | Educational, tutorials, knowledge sharing |
| `blueprint` | Technical blueprint, precise & analytical | Architecture, system design, data analysis |
| `bold-editorial` | Magazine editorial, high-impact & dynamic | Product launches, marketing, keynotes |
| `vector-illustration` | Flat vector with black outlines, retro & cute | Creative proposals, children's content, brand showcases |
| `minimal` | Ultra-clean, maximum whitespace | Executive briefings, keynotes, premium brands |
| `storytelling` | Cinematic, full-bleed visuals | Narratives, case studies, emotional impact |
| `warm` | Soft gradients, wellness aesthetic | Lifestyle, wellness, personal development |
| `notion` (Default) | SaaS dashboard, clean data focus | Product demos, SaaS, productivity tools |
| `corporate` | Navy/gold, professional business | Investor decks, client proposals, quarterly reports |
| `playful` | Vibrant colors, dynamic rounded shapes | Workshops, training, creative pitches |

Detailed style definitions: `references/styles/<style>.md`

## Auto Style Selection

| Content Signals | Selected Style |
|-----------------|----------------|
| tutorial, learn, education, guide, intro, beginner | `sketch-notes` |
| architecture, system, data, analysis, technical, engineering | `blueprint` |
| launch, marketing, brand, keynote, impact, showcase | `bold-editorial` |
| creative, children, kids, cute, illustration, retro | `vector-illustration` |
| executive, minimal, clean, simple, elegant | `minimal` |
| story, journey, case study, narrative, emotional | `storytelling` |
| wellness, lifestyle, personal, growth, mindfulness | `warm` |
| saas, product, dashboard, metrics, productivity | `notion` |
| investor, quarterly, business, corporate, proposal, client | `corporate` |
| workshop, training, fun, playful, energetic, team | `playful` |
| Default | `notion` |

## Design Philosophy

This deck is designed for **reading and sharing**, not live presentation:
- Each slide must be **self-explanatory** without verbal commentary
- Structure content for **logical flow** when scrolling
- Include **all necessary context** within each slide
- Optimize for **social media sharing** and offline reading

## File Management

### With Content Path

Save to `slide-deck/` subdirectory in the same folder as the content:

```
content-dir/
├── source-content.md
└── slide-deck/
    ├── outline.md
    ├── prompts/
    │   ├── 01-slide-cover.md
    │   ├── 02-slide-{slug}.md
    │   └── ...
    ├── 01-slide-cover.png
    ├── 02-slide-{slug}.png
    └── ...
```

### Without Content Path

Save to `slide-outputs/YYYY-MM-DD/[topic-slug]/`:

```
slide-outputs/
└── 2026-01-17/
    └── ai-future-trends/
        ├── outline.md
        ├── prompts/
        │   ├── 01-slide-cover.md
        │   └── ...
        ├── 01-slide-cover.png
        └── ...
```

## Workflow

### Step 1: Analyze Content & Determine Settings

1. Read source material
2. **Style selection**:
   - If `--style` specified, use that style
   - Otherwise, scan for style signals and auto-select
3. **Language detection**:
   - If `--lang` specified, use that language for all prompts and slide text
   - Otherwise, detect language from source material
   - If uncertain (mixed languages or unclear), ask user to confirm
4. **Slide count**:
   - If `--slides` specified, use that count
   - Otherwise, dynamic based on content structure

### Step 2: Generate Outline with Style Instructions

Create outline with structured STYLE_INSTRUCTIONS block:

```markdown
# Slide Deck Outline

**Topic**: [topic description]
**Style**: [selected style]
**Audience**: [target audience]
**Language**: [output language]
**Slide Count**: N slides
**Generated**: YYYY-MM-DD HH:mm

---

<STYLE_INSTRUCTIONS>
Design Aesthetic: [2-3 sentence description from style file]

Background:
  Color: [Name] ([Hex])
  Texture: [description]

Typography:
  Primary Font: [detailed description for image generation]
  Secondary Font: [detailed description for image generation]

Color Palette:
  Primary Text: [Name] ([Hex]) - [usage]
  Background: [Name] ([Hex]) - [usage]
  Accent 1: [Name] ([Hex]) - [usage]
  Accent 2: [Name] ([Hex]) - [usage]

Visual Elements:
  - [element 1 with rendering guidance]
  - [element 2 with rendering guidance]
  - ...

Style Rules:
  Do: [guidelines from style file]
  Don't: [anti-patterns from style file]
</STYLE_INSTRUCTIONS>

---

## Slide 1 of N

**Type**: Cover
**Filename**: 01-slide-cover.png

// NARRATIVE GOAL
[What this slide achieves in the story arc]

// KEY CONTENT
Headline: [main title]
Sub-headline: [supporting tagline]

// VISUAL
[Detailed visual description - specific elements, composition, mood]

// LAYOUT
[Composition, hierarchy, spatial arrangement]

---

## Slide 2 of N

**Type**: Content
**Filename**: 02-slide-{slug}.png

// NARRATIVE GOAL
[What this slide achieves in the story arc]

// KEY CONTENT
Headline: [main message - narrative, not label]
Sub-headline: [supporting context]
Body:
- [point 1 with specific detail]
- [point 2 with specific detail]
- [point 3 with specific detail]

// VISUAL
[Detailed visual description]

// LAYOUT
[Composition, hierarchy, spatial arrangement]

---
...

## Slide N of N

**Type**: Back Cover
**Filename**: {NN}-slide-back-cover.png

// NARRATIVE GOAL
[Meaningful closing - not just "thank you"]

// KEY CONTENT
Headline: [memorable closing statement or call-to-action]
Body: [optional summary points or next steps]

// VISUAL
[Visual that reinforces the core message]

// LAYOUT
[Clean, impactful composition]
```

### Step 3: Save Outline

Save outline as `outline.md` in the output directory.

If `--outline-only` is specified, stop here.

### Step 4: Generate Prompts

Create prompt file per slide in `prompts/` directory:

1. Read `references/base-prompt.md`
2. Combine with style-specific instructions from outline
3. Add slide-specific content from outline
4. Save as `01-slide-cover.md`, `02-slide-{slug}.md`, etc.

### Step 5: Generate Images

**Image Generation Skill Selection**:
1. Check available image generation skills
2. If multiple skills available, ask user to choose

**Session Management**:
If the image generation skill supports `--sessionId`:
1. Generate a unique session ID at the start (e.g., `slides-{topic-slug}-{timestamp}`)
2. Use the same session ID for all slides in the series
3. This ensures style consistency across all generated slides

**Generation Flow**:
1. Call selected image generation skill with prompt file, output path, and session ID
2. Confirm generation success
3. Report progress: "Generated X/N"
4. Continue to next

### Step 6: Merge to PPTX

After all images are generated, merge them into a PowerPoint file:

```bash
npx -y bun skills/baoyu-slide-deck/scripts/merge-to-pptx.ts <slide-deck-dir>
```

This creates `{topic-slug}.pptx` in the slide deck directory with:
- All images as full-bleed 16:9 slides
- Prompt content added as speaker notes (from `prompts/` directory)

### Step 7: Output Summary

```
Slide Deck Complete!

Topic: [topic]
Style: [style name]
Audience: [audience type]
Location: [directory path]
Slides: N total

- 01-slide-cover.png ✓ Cover
- 02-slide-intro.png ✓ Content
- 03-slide-main-point.png ✓ Content
- ...
- {NN}-slide-back-cover.png ✓ Back Cover

Outline: outline.md
PPTX: {topic-slug}.pptx
```

## Content Rules

1. **Respect reader attention** - 
2. **Data traceability** - All statistics must include source attribution
3. **Self-contained prompts** - Every detail in the image prompt, no external references
4. **No placeholders** - Every element must be fully specified

## Style Rules

1. **Narrative headlines** - Headlines tell the story, not label the content
   - Bad: "Key Statistics"
   - Good: "Usage doubled in 6 months"

2. **Avoid AI clichés** - No "dive into", "explore", "journey", "let's"

3. **Meaningful back cover** - Not just "Thank you"
   - Include call-to-action, key takeaway, or memorable closing

4. **Consistent visual language** - Same icons, colors, layouts throughout

## Slide Structure

1. **Cover (Slide 1)**: Title, visual hook, topic introduction
2. **Content (Middle)**: Key points, data, explanations - dynamic count based on content
3. **Back Cover (Final)**: Summary, call-to-action, or memorable closing

## Key Specifications

- **Aspect Ratio**: 16:9 (landscape)
- **Slide Count**: Dynamic based on content
- **Required Slides**: Cover + Back Cover minimum
- **No slide numbers, footers, or logos**
- **Language**: Priority order: `--lang` option → source material language → ask user if uncertain
- **Tone**: Direct, confident language (avoid AI-sounding phrases)

## Style Reference Details

| Style | Description |
|-------|-------------|
| `sketch-notes` | Hand-drawn feel, soft brush strokes, warm off-white background, conceptual icons |
| `blueprint` | Technical schematics, grid texture, precise lines, engineering blue tones |
| `bold-editorial` | High contrast, bold typography, dark backgrounds, magazine-level impact |
| `vector-illustration` | Flat vector, black outlines, retro colors, toy model aesthetic |
| `minimal` | Maximum whitespace, single accent color, clean sans-serif, zen-like |
| `storytelling` | Full-bleed imagery, cinematic compositions, emotional photography |
| `warm` | Soft gradients, rounded shapes, wellness palette, approachable |
| `notion` | Dashboard aesthetic, clean data viz, SaaS-inspired, productivity focus |
| `corporate` | Navy/gold palette, structured layouts, professional iconography, business polish |
| `playful` | Vibrant coral/teal/yellow, rounded shapes, dynamic layouts, energetic |

Full style specifications: `references/styles/<style>.md`

## Notes

- Image generation typically takes 10-30 seconds per slide
- Auto-retry once on generation failure
- Use stylized alternatives for sensitive public figures
- Output language matches input content language (or `--lang`)
- Maintain style consistency across all slides in deck

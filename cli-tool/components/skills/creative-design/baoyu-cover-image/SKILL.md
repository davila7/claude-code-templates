---
name: baoyu-cover-image
description: Generate elegant cover images for articles. Analyzes content and creates eye-catching hand-drawn style cover images with multiple style options. Use when user asks to "generate cover image", "create article cover", or "make a cover for article".
---

# Cover Image Generator

Generate hand-drawn style cover images for articles with multiple style options.

## Usage

```bash
# From markdown file (auto-select style based on content)
/baoyu-cover-image path/to/article.md

# Specify a style
/baoyu-cover-image path/to/article.md --style tech
/baoyu-cover-image path/to/article.md --style warm
/baoyu-cover-image path/to/article.md --style bold

# Without title text
/baoyu-cover-image path/to/article.md --no-title

# Combine options
/baoyu-cover-image path/to/article.md --style minimal --no-title

# From direct text input
/baoyu-cover-image
[paste content or describe the topic]

# Direct input with style
/baoyu-cover-image --style playful
[paste content]
```

## Options

| Option | Description |
|--------|-------------|
| `--style <name>` | Specify cover style (see Style Gallery below) |
| `--no-title` | Generate cover without title text (visual only) |

## Style Gallery

| Style | Description |
|-------|-------------|
| `elegant` (Default) | Refined, sophisticated, understated |
| `tech` | Modern, clean, futuristic |
| `warm` | Friendly, approachable, human-centered |
| `bold` | High contrast, attention-grabbing, energetic |
| `minimal` | Ultra-clean, zen-like, focused |
| `playful` | Fun, creative, whimsical |
| `nature` | Organic, calm, earthy |
| `retro` | Vintage, nostalgic, classic |

Detailed style definitions: `references/styles/<style>.md`

## Auto Style Selection

When no `--style` is specified, the system analyzes content to select the best style:

| Content Signals | Selected Style |
|----------------|----------------|
| AI, coding, tech, digital, algorithm | `tech` |
| Personal story, emotion, growth, life | `warm` |
| Controversial, urgent, must-read, warning | `bold` |
| Simple, zen, focus, essential | `minimal` |
| Fun, easy, beginner, casual, tutorial | `playful` |
| Nature, eco, wellness, health, organic | `nature` |
| History, classic, vintage, old, traditional | `retro` |
| Business, professional, strategy, analysis | `elegant` |

## File Management

### With Article Path

Save to `imgs/` subdirectory in the same folder as the article:

```
path/to/
├── article.md
└── imgs/
    ├── prompts/
    │   └── cover.md
    └── cover.png
```

### Without Article Path

Save to current working directory:

```
./
├── cover-prompt.md
└── cover.png
```

## Workflow

### Step 1: Analyze Content

Extract key information:
- **Main topic**: What is the article about?
- **Core message**: What's the key takeaway?
- **Tone**: Serious, playful, inspiring, educational?
- **Keywords**: Identify style-signaling words

### Step 2: Select Style

If `--style` specified, use that style. Otherwise:
1. Scan content for style signals (see Auto Style Selection table)
2. Match signals to most appropriate style
3. Default to `elegant` if no clear signals

### Step 3: Generate Cover Concept

Create a cover image concept based on selected style:

**Title** (if included, max 8 characters):
- Distill the core message into a punchy headline
- Use hooks: numbers, questions, contrasts, pain points
- Skip if `--no-title` flag is used

**Visual Elements**:
- Style-appropriate imagery and icons
- 1-2 symbolic elements representing the topic
- Metaphors or analogies that fit the style

### Step 4: Create Prompt File

**Prompt Format**:

```markdown
Cover theme: [topic in 2-3 words]
Style: [selected style name]

[If title included:]
Title text: [8 characters or less, in content language]
Subtitle: [optional, in content language]

Visual composition:
- Main visual: [description matching style]
- Layout: [positioning based on title inclusion]
- Decorative elements: [style-appropriate elements]

Color scheme:
- Primary: [style primary color]
- Background: [style background color]
- Accent: [style accent color]

Style notes: [specific style characteristics to emphasize]

[If no title:]
Note: No title text, pure visual illustration only.
```

### Step 5: Generate Image

**Image Generation Skill Selection**:
1. Check available image generation skills
2. If multiple skills available, ask user to choose

**Generation**:
Call selected image generation skill with prompt file and output path.

### Step 6: Output Summary

```
Cover Image Generated!

Topic: [topic]
Style: [style name]
Title: [cover title] (or "No title - visual only")
Location: [output path]

Preview the image to verify it matches your expectations.
```

## Notes

- Cover should be instantly understandable at small preview sizes
- Title (if included) must be readable and impactful
- Visual metaphors work better than literal representations
- Maintain style consistency throughout the cover
- Image generation typically takes 10-30 seconds
- Title text language should match content language

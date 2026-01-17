---
name: baoyu-article-illustrator
description: Smart article illustration skill. Analyzes article content and generates illustrations at positions requiring visual aids with multiple style options. Use when user asks to "add illustrations to article", "generate images for article", or "illustrate article".
---

# Smart Article Illustration Skill

Analyze article structure and content, identify positions requiring visual aids, and generate illustrations with flexible style options.

## Usage

```bash
# Auto-select style based on content
/baoyu-article-illustrator path/to/article.md

# Specify a style
/baoyu-article-illustrator path/to/article.md --style tech
/baoyu-article-illustrator path/to/article.md --style warm
/baoyu-article-illustrator path/to/article.md --style minimal

# Combine with other options
/baoyu-article-illustrator path/to/article.md --style playful
```

## Options

| Option | Description |
|--------|-------------|
| `--style <name>` | Specify illustration style (see Style Gallery below) |

## Style Gallery

### 1. `elegant`
Refined, sophisticated, professional
- **Colors**: Soft coral, muted teal, dusty rose, cream background
- **Elements**: Delicate line work, subtle icons, balanced composition
- **Best for**: Professional articles, thought leadership, business topics

### 2. `tech`
Modern, futuristic, digital
- **Colors**: Deep blue, electric cyan, purple, dark backgrounds
- **Elements**: Geometric shapes, circuit patterns, data visualizations, tech icons
- **Best for**: AI, programming, technology, digital transformation articles

### 3. `warm`
Friendly, approachable, human-centered
- **Colors**: Warm orange, golden yellow, terracotta, cream
- **Elements**: Rounded shapes, friendly characters, sun/light motifs, hearts
- **Best for**: Personal growth, lifestyle, education, human interest stories

### 4. `bold`
High contrast, impactful, energetic
- **Colors**: Vibrant red/orange, deep black, bright yellow accents
- **Elements**: Strong shapes, dramatic contrast, dynamic compositions
- **Best for**: Opinion pieces, important warnings, call-to-action content

### 5. `minimal`
Ultra-clean, zen-like, focused
- **Colors**: Black, white, single accent color
- **Elements**: Maximum whitespace, single focal element, simple lines
- **Best for**: Philosophy, minimalism, focused explanations

### 6. `playful`
Fun, creative, whimsical
- **Colors**: Pastel rainbow, bright pops, light backgrounds
- **Elements**: Doodles, quirky characters, speech bubbles, emoji-style icons
- **Best for**: Tutorials, beginner guides, casual content, fun topics

### 7. `nature`
Organic, calm, earthy
- **Colors**: Forest green, earth brown, sky blue, sand beige
- **Elements**: Plant motifs, natural textures, flowing lines, organic shapes
- **Best for**: Sustainability, wellness, outdoor topics, slow living

### 8. `sketch`
Raw, authentic, notebook-style
- **Colors**: Pencil gray, paper white, occasional color highlights
- **Elements**: Rough lines, sketch marks, handwritten notes, arrows
- **Best for**: Ideas in progress, brainstorming, thought processes

### 9. `notion` (Default)
Minimalist hand-drawn line art, intellectual
- **Colors**: Black outlines, white background, 1-2 pastel accents
- **Elements**: Simple line doodles, geometric shapes, hand-drawn wobble, maximum whitespace
- **Best for**: Knowledge sharing, concept explanations, SaaS content, productivity articles

## Auto Style Selection

When no `--style` is specified, analyze content to select the best style:

| Content Signals | Selected Style |
|----------------|----------------|
| AI, coding, tech, digital, algorithm, data | `tech` |
| Personal story, emotion, growth, life, feeling | `warm` |
| Warning, urgent, must-read, critical, important | `bold` |
| Simple, zen, focus, essential, core | `minimal` |
| Fun, easy, beginner, tutorial, guide, how-to | `playful` |
| Nature, eco, wellness, health, organic, green | `nature` |
| Idea, thought, concept, draft, brainstorm | `sketch` |
| Business, professional, strategy, analysis | `elegant` |
| Knowledge, concept, productivity, SaaS, notion | `notion` |

## File Management

Save illustrations to `imgs/` subdirectory in the same folder as the article:

```
path/to/
├── article.md
└── imgs/
    ├── outline.md
    ├── prompts/
    │   ├── illustration-concept-a.md
    │   ├── illustration-concept-b.md
    │   └── ...
    ├── illustration-concept-a.png
    ├── illustration-concept-b.png
    └── ...
```

## Workflow

### Step 1: Analyze Content & Select Style

1. Read article content
2. If `--style` specified, use that style
3. Otherwise, scan for style signals and auto-select
4. Extract key information:
   - Main topic and themes
   - Core messages per section
   - Abstract concepts needing visualization

### Step 2: Identify Illustration Positions

**Three Purposes of Illustrations**:
1. **Information Supplement**: Help understand abstract concepts
2. **Concept Visualization**: Transform abstract ideas into concrete visuals
3. **Imagination Guidance**: Create atmosphere, enhance reading experience

**Content Suitable for Illustrations**:
- Abstract concepts needing visualization
- Processes/steps needing diagrams
- Comparisons needing visual representation
- Core arguments needing reinforcement
- Scenarios needing imagination guidance

**Illustration Count**:
- Consider at least 1 image per major section
- Prioritize core arguments and abstract concepts
- **Principle: More is better than fewer**

### Step 3: Generate Illustration Plan

```markdown
# Illustration Plan

**Article**: [article path]
**Style**: [selected style]
**Illustration Count**: N images

---

## Illustration 1

**Insert Position**: [section name] / [paragraph description]
**Purpose**: [why illustration needed here]
**Visual Content**: [what the image should show]
**Filename**: illustration-[slug].png

---

## Illustration 2
...
```

### Step 4: Create Prompt Files

Save prompts to `prompts/` directory with style-specific details.

**Prompt Format**:

```markdown
Illustration theme: [concept in 2-3 words]
Style: [style name]

Visual composition:
- Main visual: [description matching style]
- Layout: [element positioning]
- Decorative elements: [style-appropriate decorations]

Color scheme:
- Primary: [style primary color]
- Background: [style background color]
- Accent: [style accent color]

Text content (if any):
- [Any labels or captions in content language]

Style notes: [specific style characteristics]
```

### Step 5: Generate Images

**Image Generation Skill Selection**:
1. Check available image generation skills
2. If multiple skills available, ask user to choose

**Generation Flow**:
1. Call selected image generation skill with prompt file and output path
2. Generate images sequentially
3. After each image, output progress: "Generated X/N"
4. On failure, auto-retry once
5. If retry fails, log reason, continue to next

### Step 6: Update Article

Insert generated images at corresponding positions:

```markdown
![illustration description](imgs/illustration-[slug].png)
```

**Insertion Rules**:
- Insert image after corresponding paragraph
- Leave one blank line before and after image
- Alt text uses concise description in article's language

### Step 7: Output Summary

```
Article Illustration Complete!

Article: [article path]
Style: [style name]
Generated: X/N images successful

Illustration Positions:
- illustration-xxx.png → After section "Section Name"
- illustration-yyy.png → After section "Another Section"
...

[If any failures]
Failed:
- illustration-zzz.png: [failure reason]
```

## Style Reference Details

### elegant
```
Colors: Soft coral (#E8A598), muted teal (#5B8A8A), dusty rose (#D4A5A5)
Background: Warm cream (#F5F0E6), soft beige
Accents: Gold (#C9A962), copper
Elements: Delicate lines, refined icons, subtle gradients, balanced whitespace
```

### tech
```
Colors: Deep blue (#1A365D), electric cyan (#00D4FF), purple (#6B46C1)
Background: Dark gray (#1A202C), near-black (#0D1117)
Accents: Neon green (#00FF88), bright white
Elements: Circuit patterns, data nodes, geometric grids, glowing effects
```

### warm
```
Colors: Warm orange (#ED8936), golden yellow (#F6AD55), terracotta (#C05621)
Background: Cream (#FFFAF0), soft peach (#FED7AA)
Accents: Deep brown (#744210), soft red
Elements: Rounded shapes, smiling faces, sun rays, hearts, cozy lighting
```

### bold
```
Colors: Vibrant red (#E53E3E), bright orange (#DD6B20), electric yellow (#F6E05E)
Background: Deep black (#000000), dark charcoal
Accents: White, neon highlights
Elements: Strong shapes, exclamation marks, arrows, dramatic contrast
```

### minimal
```
Colors: Pure black (#000000), white (#FFFFFF)
Background: White or off-white (#FAFAFA)
Accents: Single color (content-derived)
Elements: Single focal point, maximum negative space, thin precise lines
```

### playful
```
Colors: Pastel pink (#FED7E2), mint (#C6F6D5), lavender (#E9D8FD), sky blue (#BEE3F8)
Background: Light cream (#FFFBEB), soft white
Accents: Bright pops - yellow, coral, turquoise
Elements: Doodles, stars, swirls, cute characters, speech bubbles
```

### nature
```
Colors: Forest green (#276749), sage (#9AE6B4), earth brown (#744210)
Background: Sand beige (#F5E6D3), sky blue (#E0F2FE)
Accents: Sunset orange, water blue
Elements: Leaves, trees, mountains, organic flowing lines, natural textures
```

### sketch
```
Colors: Pencil gray (#4A5568), paper white (#FAFAFA)
Background: Off-white paper texture (#F7FAFC)
Accents: Single highlight color (blue, red, or yellow)
Elements: Rough sketch lines, arrows, handwritten labels, crossed-out marks
```

### notion
```
Colors: Black (#1A1A1A), dark gray (#4A4A4A)
Background: Pure white (#FFFFFF), off-white (#FAFAFA)
Accents: Pastel blue (#A8D4F0), pastel yellow (#F9E79F), pastel pink (#FADBD8)
Elements: Simple line doodles, hand-drawn wobble effect, geometric shapes, stick figures, maximum whitespace
Typography: Clean hand-drawn lettering, simple sans-serif labels
```

## Notes

- Illustrations serve the content: supplement information, visualize concepts
- Maintain selected style consistency across all illustrations in one article
- Image generation typically takes 10-30 seconds per image
- Sensitive figures should use cartoon alternatives
- Prompt and illustration text language should match article language

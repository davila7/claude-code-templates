---
name: baoyu-comic
description: Knowledge comic creator supporting multiple styles (Logicomix/Ligne Claire, Ohmsha manga guide). Creates original educational comics with detailed panel layouts and sequential image generation. Use when user asks to create "知识漫画", "教育漫画", "biography comic", "tutorial comic", or "Logicomix-style comic".
---

# Knowledge Comic Creator

Create original knowledge comics with multiple visual styles.

## Usage

```bash
/baoyu-comic posts/turing-story/source.md
/baoyu-comic posts/turing-story/source.md --style dramatic --layout cinematic
/baoyu-comic  # then paste content
```

## Options

| Option | Values |
|--------|--------|
| `--style` | classic (default), dramatic, warm, tech, sepia, vibrant, ohmsha, realistic |
| `--layout` | standard (default), cinematic, dense, splash, mixed, webtoon |

Style × Layout can be freely combined.

## Auto Selection

| Content Signals | Style | Layout |
|-----------------|-------|--------|
| Tutorial, how-to, beginner | ohmsha | webtoon |
| Computing, AI, programming | tech | dense |
| Pre-1950, classical, ancient | sepia | cinematic |
| Personal story, mentor | warm | standard |
| Conflict, breakthrough | dramatic | splash |
| Wine, food, business, lifestyle, professional | realistic | cinematic |
| Biography, balanced | classic | mixed |

## File Structure

```
[target]/
├── outline.md
├── characters/
│   ├── characters.md    # Character definitions
│   └── characters.png   # Character reference sheet
├── prompts/
│   ├── 00-cover.md
│   └── XX-page.md
├── 00-cover.png
└── XX-page.png
```

**Target directory**:
- With source path: `[source-dir]/comic/`
- Without source: `comic-outputs/YYYY-MM-DD/[topic-slug]/`

## Workflow

### Step 1: Analyze Content

1. Read source content
2. Select style (from `--style` or auto-detect)
3. Select layout (from `--layout` or auto-detect per page)
4. Determine page count:
   - Short story: 5-8 pages
   - Medium complexity: 9-15 pages
   - Full biography: 16-25 pages

### Step 2: Define Characters

**Purpose**: Establish visual consistency across all pages.

1. Extract all characters from content (protagonist, supporting, antagonist, narrator)
2. Create `characters/characters.md` with visual specs for each character
3. Generate `characters/characters.png` (character reference sheet)

**Reference**: `references/character-template.md` for detailed format and examples.

### Step 3: Generate Outline

Create `outline.md` with:
- Metadata (title, style, layout, page count, character reference path)
- Cover design
- Each page: layout, panel breakdown, visual prompts

**Reference**: `references/outline-template.md` for detailed format.

### Step 4: Generate Images

For each page (cover + pages):

1. Save prompt to `prompts/XX-page.md`
2. Call image generation skill with:
   - Base prompt: `references/base-prompt.md`
   - Character reference (text or image, depending on skill capability)
   - Page prompt
   - Output path

**Image Generation Skill Selection**:
- Check available image generation skills in the environment
- Adapt parameters based on skill capabilities:
  - If supports `--promptfiles`: pass prompt files
  - If supports reference image: pass `characters/characters.png`
  - If text-only: concatenate prompts into single text
- If multiple skills available, ask user preference

**Session Management**:
If the image generation skill supports `--sessionId`:
1. Generate a unique session ID at the start (e.g., `comic-{topic-slug}-{timestamp}`)
2. Use the same session ID for character sheet and all pages
3. This ensures visual consistency (character appearance, style) across all generated images

3. Report progress after each generation

### Step 5: Completion Report

```
Comic Complete!
Title: [title] | Style: [style] | Pages: [count]
Location: [path]
✓ characters.png
✓ 00-cover.png ... XX-page.png
```

## Style-Specific Guidelines

### Ohmsha Style (`--style ohmsha`)

Additional requirements for educational manga:
- Default characters: Student (大雄), Mentor (哆啦A梦), Antagonist (胖虎)
- Custom: `--characters "Student:小明,Mentor:教授"`
- Must use visual metaphors (gadgets, action scenes) - NO talking heads
- Page titles: narrative style, not "Page X: Topic"

**Reference**: `references/ohmsha-guide.md` for detailed guidelines.

## References

Detailed templates and guidelines in `references/` directory:
- `character-template.md` - Character definition format and examples
- `outline-template.md` - Outline structure and panel breakdown
- `ohmsha-guide.md` - Ohmsha manga style specifics
- `styles/` - Detailed style definitions
- `layouts/` - Detailed layout definitions

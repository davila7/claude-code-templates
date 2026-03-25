# Marp Slide Creator

A Claude Code skill for creating professional, visually appealing Marp presentation slides with 7 pre-designed themes and built-in best practices.

## Purpose

This skill automates the creation of high-quality Marp presentations by providing:
- 7 professionally designed themes (default, minimal, colorful, dark, gradient, tech, business)
- Built-in best practices for slide structure and visual hierarchy
- Automatic quality improvements for vague "make it look good" requests
- Image integration with proper Marp syntax
- Theme selection guidance based on content type

## When to Use

Use this skill when you need to:
- Create presentation slides or Marp documents
- Improve slide design aesthetics
- Structure lecture or seminar materials
- Transform bullet-point content into professional presentations
- Generate slides with specific themes (tech, business, creative, etc.)

**Trigger phrases:**
- "create slides"
- "make a presentation"
- "create Marp slides"
- "make it look good"
- "良い感じにして" (make it nice - Japanese)
- "かっこよく" (make it cool - Japanese)

## How It Works

### 1. Theme Selection
The skill intelligently selects themes based on content:
- **Technical/Developer** → tech theme
- **Business/Corporate** → business theme
- **Creative/Event** → colorful or gradient theme
- **Academic/Simple** → minimal theme
- **General** → default theme
- **Dark preference** → dark or tech theme

### 2. Content Structuring
Follows best practices automatically:
- Title slide with lead class styling
- Concise headings (5-7 characters for Japanese)
- 3-5 bullet points per slide
- Adequate whitespace and visual hierarchy
- Consistent formatting throughout

### 3. Template Application
Uses pre-built templates with embedded CSS:
- No external CSS files needed
- Ready-to-use with Marp CLI or VS Code
- Consistent styling across all slides

### 4. Image Integration
Supports official Marp image syntax:
- Side images: `![bg right:40%](image.png)`
- Centered images: `![w:600px](image.png)`
- Full backgrounds: `![bg](image.png)`
- Multiple images and filters

## Available Themes

### 1. Default Theme
**Style**: Clean, sophisticated with decorative lines
**Colors**: Beige background, navy text, blue headings
**Best for**: General seminars, lectures, presentations

### 2. Minimal Theme
**Style**: Minimal decoration, wide margins, light fonts
**Colors**: White background, gray text, black headings
**Best for**: Content-focused presentations, academic talks

### 3. Colorful & Pop Theme
**Style**: Vibrant gradients, bold fonts, rainbow accents
**Colors**: Pink gradient background, multi-color accents
**Best for**: Youth-oriented events, creative projects

### 4. Dark Mode Theme
**Style**: Dark theme with glow effects, eye-friendly
**Colors**: Black background, cyan/purple accents
**Best for**: Tech presentations, evening talks, modern look

### 5. Gradient Background Theme
**Style**: Different gradient per slide, white text, shadows
**Colors**: Purple/pink/blue/green gradients (varies per slide)
**Best for**: Visual-focused, creative presentations

### 6. Tech/Code Theme
**Style**: Code fonts, Markdown-style headers with # symbols
**Colors**: GitHub-style dark background, blue/green accents
**Best for**: Programming tutorials, tech meetups, developer content

### 7. Business Theme
**Style**: Corporate presentation style, top border, table support
**Colors**: White background, navy headings, blue accents
**Best for**: Business presentations, proposals, reports

## Key Features

- **7 Pre-designed Themes**: Professional themes for different contexts
- **Automatic Quality Enhancement**: Applies best practices when users request "make it look good"
- **Theme Selection Guidance**: Intelligent theme selection based on content analysis
- **Image Pattern Library**: Official Marp image syntax with common patterns
- **Embedded CSS**: Templates include all styling - no external files needed
- **Best Practices Built-in**: Follows visual hierarchy and presentation design principles
- **Multi-language Support**: Works with English, Japanese, and other languages
- **Quality Checklist**: Ensures consistent output quality

## Usage Examples

### Example 1: Basic Presentation
```
User: Create slides about cloud computing basics

Agent: I'll create a professional presentation using the default theme.
[Creates slides with title slide, 5-7 content slides, conclusion]
[Saves to the project output directorycloud-computing.md]
```

### Example 2: Tech Meetup
```
User: Make slides for my Python tutorial - make it look cool

Agent: I'll use the tech theme for a programming tutorial.
[Selects tech theme with code-friendly styling]
[Structures content with code examples]
[Applies dark background and syntax-friendly colors]
```

### Example 3: Business Proposal
```
User: Create a business presentation about Q1 results

Agent: I'll use the business theme for your corporate presentation.
[Applies professional business styling]
[Includes table support for data]
[Uses formal tone and structure]
```

### Example 4: Vague Request (Japanese)
```
User: このスライドを良い感じにして

Agent: I'll enhance this presentation's visual appeal.
[Analyzes content to infer appropriate theme]
[Applies best practices: concise titles, 3-5 bullets]
[Improves whitespace and visual hierarchy]
```

## File Structure

```
marp-slide/
├── SKILL.md                    # Main skill instructions
├── README.md                   # This file
├── assets/
│   ├── template-basic.md       # Default theme template
│   ├── template-minimal.md     # Minimal theme template
│   ├── template-colorful.md    # Colorful theme template
│   ├── template-dark.md        # Dark theme template
│   ├── template-gradient.md    # Gradient theme template
│   ├── template-tech.md        # Tech theme template
│   ├── template-business.md    # Business theme template
│   ├── theme-*.css             # Standalone CSS files (reference)
└── references/
    ├── marp-syntax.md          # Basic Marp/Marpit syntax
    ├── image-patterns.md       # Image syntax patterns
    ├── theme-css-guide.md      # Custom theme creation
    ├── advanced-features.md    # Math, emoji, fragmented lists
    ├── official-themes.md      # Default Marp themes docs
    ├── theme-selection.md      # Theme selection guide
    └── best-practices.md       # Quality guidelines
```

## Output

All generated slides are saved to `the project output directory` with `.md` extension:
- Includes embedded CSS (no external files needed)
- Ready to use with Marp CLI or VS Code Marp extension
- Can be exported to PDF, HTML, or PPTX

## Quality Standards

Every presentation created follows:
- Concise titles (5-7 characters for Japanese)
- 3-5 bullet points per slide
- Proper visual hierarchy
- Adequate whitespace
- Consistent formatting
- Professional tone matching content type
- Logical flow (intro → body → conclusion)

## Resources

### Internal Documentation
- `references/marp-syntax.md` - Basic Marp syntax and directives
- `references/image-patterns.md` - Official image syntax guide
- `references/theme-css-guide.md` - Custom theme creation
- `references/best-practices.md` - Quality guidelines

### External Links
- [Marp Official Site](https://marp.app/)
- [Marpit Directives](https://marpit.marp.app/directives)
- [Marpit Image Syntax](https://marpit.marp.app/image-syntax)
- [Marp CLI GitHub](https://github.com/marp-team/marp-cli)

## License

This skill is part of the agent-skills project.

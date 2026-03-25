# 🎯 Skills Dashboard - Modern Flow Visualization

## Overview

The Skills Dashboard provides an elegant, modern interface to view and explore Claude Code Skills with an interactive progressive context loading visualization.

## Features

### 🎨 Modern Flow Diagram

The dashboard features a revolutionary **3-layer progressive context loading visualization** that shows exactly how skills load their context:

#### Layer 1: MAIN CONTEXT (🟠 Coral)
- **Always Loaded** - Badge with solid border
- Contains `SKILL.md` - the core skill definition
- Displayed with file icon and size
- Always expanded by default

#### Layer 2: SKILL DISCOVERY (🟢 Green)
- **Loaded on Demand** - Badge with dashed border
- Contains referenced documentation files (API.md, EXAMPLES.md, etc.)
- Tree view with clickable file nodes
- Shows when context triggers loading

#### Layer 3: SUPPORTING RESOURCES (🟣 Purple)
- **Progressive Loading** - Badge with dashed border
- Contains scripts, templates, and utilities
- Organized by folder (scripts/, templates/)
- Files accessed/executed directly as needed

### 🌊 Animated Flow Arrows

Between each layer, animated flow arrows show:
- Gradient line with pulse animation
- Descriptive labels explaining the trigger
- Bouncing arrow head indicating direction

### 🌲 Interactive File Tree

**Features:**
- Expandable/collapsible layers (click header)
- Folder grouping with file counts
- File type icons (📄, 🐍, 📜, 📁, 📋)
- File sizes displayed
- Click to view file content
- Hover effects with color-coded borders

### 🎭 Visual Design

**Color System:**
- Main Context: Coral (#ff9b7a) - warm, inviting
- Skill Discovery: Green (#56d364) - fresh, dynamic
- Progressive: Purple (#a371f7) - advanced, mysterious

**Typography:**
- Headers: System font stack
- File names: Monospace (SF Mono, Monaco)
- Numbers: Circular badges with borders

**Effects:**
- Smooth transitions (150-350ms)
- Gradient backgrounds
- Shadow elevations
- Pulse animations on arrows
- Hover state transformations

## Usage

### Launch Dashboard

```bash
# From CLI tool directory
npm start -- --skills-manager

# Or globally
npx claude-code-templates --skills-manager

# Opens browser at http://localhost:3337
```

### Navigate Skills

1. **Browse Skills** - Grid or list view of all installed skills
2. **Filter** - By source (Personal/Project/Plugin)
3. **Search** - Find skills by name or description
4. **Click Skill** - Opens detailed modal with flow diagram

### Explore Skill Details

**In the modal:**
- View skill description and allowed tools
- See progressive loading flow diagram
- Expand/collapse layers
- Click files to view content
- Navigate file tree structure

## Technical Implementation

### Backend (`src/skill-dashboard.js`)
- Express server on port 3337
- Scans `~/.claude/skills/` and `.claude/skills/`
- Parses YAML frontmatter
- Categorizes files by loading strategy
- Provides REST API endpoints

### Frontend (`src/skill-dashboard-web/`)
- Vanilla JavaScript (no frameworks)
- Responsive CSS with CSS Grid
- Interactive layer toggles
- File tree with folder grouping
- Real-time file content loading

### API Endpoints

```
GET  /api/skills              - List all skills
GET  /api/skills/:name        - Get skill details
GET  /api/skills/:name/file/* - Get file content
GET  /api/summary             - Statistics
```

## Example Skills

The implementation includes test skills demonstrating all features:

### 1. test-skill
Basic skill with:
- SKILL.md
- reference.md (on demand)
- scripts/helper.py (progressive)

### 2. pdf-processing
Real-world skill with:
- SKILL.md
- FORMS.md (on demand)

### 3. advanced-test
Comprehensive skill with:
- SKILL.md
- API.md, EXAMPLES.md, QUICKSTART.md (on demand)
- scripts/process.py, validate.py, helper.sh (progressive)
- templates/config.json, report.md (progressive)

## Architecture Highlights

### File Categorization Logic

```javascript
// Files are automatically categorized based on:
1. SKILL.md → Always Loaded (main context)
2. Referenced .md files → On Demand (skill discovery)
3. scripts/, templates/ → Progressive (supporting resources)
```

### Progressive Loading Strategy

The visualization mirrors Claude Code's actual loading behavior:
1. **Main Context**: Loaded when skill is invoked
2. **Skill Discovery**: Loaded when referenced in conversation
3. **Progressive**: Accessed/executed directly as needed

### Responsive Design

- Desktop: Full 3-column layout with sidebar
- Tablet: 2-column with collapsible sidebar
- Mobile: Single column, full-width cards

## Best Practices

### Creating Effective Skills

**For optimal visualization:**
1. Put core instructions in SKILL.md
2. Reference documentation with markdown links
3. Organize scripts in `scripts/` folder
4. Place templates in `templates/` folder

**Example SKILL.md:**
```markdown
---
name: my-skill
description: Does amazing things
allowed-tools: Read, Write
---

# My Skill

Instructions here.

For details, see [API.md](API.md).
```

### Folder Structure

```
my-skill/
├── SKILL.md              # Always loaded
├── API.md                # On demand
├── EXAMPLES.md           # On demand
├── scripts/              # Progressive
│   ├── process.py
│   └── validate.py
└── templates/            # Progressive
    ├── config.json
    └── report.md
```

## Performance

- **Fast Loading**: Skills cached in memory
- **Lazy Content**: File content loaded on demand
- **Efficient Rendering**: Virtual scrolling for large lists
- **Minimal Bundle**: No external dependencies

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close modal |
| `Enter` | Expand/collapse focused layer |
| `/` | Focus search |

## Future Enhancements

Potential improvements:
- [ ] Skill dependency graph
- [ ] Live preview of skill execution
- [ ] Skill templates generator
- [ ] Performance metrics per skill
- [ ] Export skill as template
- [ ] Dark/light theme toggle

## Credits

Built with ❤️ for Claude Code Templates
- Modern CSS Grid layout
- Vanilla JavaScript for maximum performance
- Inspired by VSCode file explorer
- Progressive context loading visualization

---

**Version**: 1.0.0  
**Port**: 3337  
**License**: Same as claude-code-templates

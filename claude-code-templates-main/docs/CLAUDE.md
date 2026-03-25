# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This directory contains the static website (aitmpl.com) that serves as the public web interface for browsing and installing Claude Code components. The site is a vanilla JavaScript application that loads component data dynamically and provides an interactive browsing experience for 500+ components including agents, commands, settings, hooks, MCPs, and templates.

## Development Commands

### Local Development
```bash
# Serve locally with any static file server
python -m http.server 8000
# or
npx http-server

# Open browser to http://localhost:8000
```

### Component Data Generation
```bash
# From project root - regenerate components.json
cd ..
python scripts/generate_components_json.py

# This creates/updates docs/components.json with all components
```

### Deployment
- Site is automatically deployed to GitHub Pages when changes are pushed to `docs/` directory
- Deployed at: https://aitmpl.com (davila7.github.io/claude-code-templates)
- Vercel configuration in `vercel.json` for routing

## Architecture

### Data Flow
1. **Component Generation**: Python script (`scripts/generate_components_json.py`) scans `cli-tool/components/` and generates `docs/components.json` (~2MB file with embedded content)
2. **Static Loading**: Website loads `components.json` on page load (with mobile optimization and progress indicators)
3. **Dynamic Rendering**: JavaScript renders component cards based on user filters and search
4. **Download Tracking**: Supabase integration tracks component installations via backend API

### Key Files

#### HTML Pages
- `index.html` - Main page with component browser and search
- `component.html` - Individual component detail pages
- `plugin.html` - Plugin marketplace interface
- `trending.html` - Trending components dashboard
- `download-stats.html` - Analytics and download statistics

#### JavaScript Architecture (`js/`)
- `data-loader.js` - Loads and caches components.json, handles data fetching
- `search-functionality.js` - Real-time search across all components with fuzzy matching
- `cart-manager.js` - Shopping cart for batch component installation
- `stack-router.js` - Client-side routing for company stacks and plugins
- `index-events.js` - Event handlers for filters, modals, and user interactions
- `plugin-page.js` - Plugin marketplace functionality
- `trending.js` - Trending components data visualization

#### CSS (`css/`)
- Modular CSS with separate files for components, modals, responsive design
- Terminal-themed design system with monospace fonts and CLI aesthetics

#### Data Files
- `components.json` - Main component catalog (~2MB, generated file)
- `trending-data.json` - Trending components rankings
- `claude-jobs.json` - Job postings data

### Component System

#### Component Types
Each component type has specific structure:

**Agents** (162 total)
- AI specialists organized by category (Development, Data/AI, Security, Business, etc.)
- Stored in `cli-tool/components/agents/{category}/{name}.md`
- Installation: `--agent <name>`

**Commands** (210 total)
- Custom slash commands organized by category
- Stored in `cli-tool/components/commands/{category}/{name}.md`
- Installation: `--command <name>`

**Settings** (60 total)
- Claude Code configuration files
- Includes statuslines with accompanying Python scripts
- Stored in `cli-tool/components/settings/{category}/{name}.json`
- Installation: `--setting <name>`

**Hooks** (39 total)
- Event-driven automation triggers
- Stored in `cli-tool/components/hooks/{category}/{name}.md`
- Installation: `--hook <name>`

**MCPs** (55 total)
- Model Context Protocol integrations
- Stored in `cli-tool/components/mcps/{name}.json`
- Installation: `--mcp <name>`

**Templates** (14 total)
- Complete project configurations
- Organized by language and framework in `cli-tool/templates/`
- Installation: `--template <language>`

**Plugins** (10 total)
- Component bundles with marketplace metadata
- Defined in `.claude-plugin/marketplace.json`
- Installation: `--plugin <name>`

### Data Loading Strategy

The site implements a multi-stage loading strategy for optimal mobile performance:

1. **Initial Load**: Show loading indicator with progress bar
2. **Lazy Parsing**: Load components.json in chunks to avoid blocking
3. **Progressive Rendering**: Render visible cards first, lazy-load others
4. **Search Indexing**: Build search index in background
5. **Caching**: LocalStorage caching for repeat visits

### Search Functionality

Real-time search across all components:
- **Fuzzy Matching**: Tolerates typos and partial matches
- **Multi-field Search**: Searches name, description, category, type
- **Filter Integration**: Combines with type filters (agents/commands/etc)
- **Category Filtering**: Dynamic category chips based on active filter
- **Sorting**: Alphabetical or by download count

### Shopping Cart System

Batch installation builder:
- Add multiple components across types (agents, commands, settings, hooks, MCPs)
- Generates single NPX command for installation
- Supports sharing cart via URL parameters
- Social sharing to Twitter/Threads

### Plugin Marketplace

Plugin system for component bundles:
- Each plugin contains agents, commands, and MCPs
- Defined in marketplace.json with metadata
- Installation installs all plugin components
- Examples: `supabase-toolkit`, `nextjs-vercel-pro`, `ai-ml-toolkit`

### Download Analytics

Supabase-powered analytics:
- Tracks component installations via API endpoints
- Aggregates download counts by component and type
- Displays trending components and download stats
- Real-time updates with background refresh

## Important Implementation Patterns

### Component Data Structure

```javascript
// components.json structure
{
  "agents": [{
    "name": "agent-name",
    "category": "category-name",
    "content": "Full markdown content...",
    "path": "agents/category/agent-name.md",
    "url": "https://github.com/..."
  }],
  "commands": [...],
  "mcps": [...],
  "settings": [...],
  "hooks": [...],
  "templates": [...],
  "plugins": [...]
}
```

### Dynamic Component Loading

```javascript
// Loading pattern from data-loader.js
async function loadAllComponentsData() {
  const response = await fetch('components.json');
  const data = await response.json();
  componentsData = data;
  collectAvailableCategories();
  generateUnifiedComponentCards();
}
```

### Filter and Category System

```javascript
// Current filter state
let currentFilter = 'agents'; // or 'commands', 'mcps', etc.
let currentCategoryFilter = 'all'; // or specific category

// Update filters
function handleFilterClick(event, filter) {
  currentFilter = filter;
  updateCategorySubFilters();
  generateUnifiedComponentCards();
}
```

### Installation Command Generation

```javascript
// Pattern from cart-manager.js
function generateCartCommand(cart) {
  const flags = [];
  if (cart.agents.length) flags.push(...cart.agents.map(a => `--agent ${a}`));
  if (cart.commands.length) flags.push(...cart.commands.map(c => `--command ${c}`));
  // ... other types
  return `npx claude-code-templates@latest ${flags.join(' ')} --yes`;
}
```

## File Generation Workflow

### Updating Component Catalog

When components are added/modified in `cli-tool/components/`:

1. Run component generation script:
   ```bash
   cd /path/to/project/root
   python scripts/generate_components_json.py
   ```

2. This script:
   - Scans all directories in `cli-tool/components/`
   - Scans all templates in `cli-tool/templates/`
   - Fetches download stats from Supabase
   - Embeds file content inline
   - Excludes Python scripts from public listings (but includes them as dependencies)
   - Generates `docs/components.json`

3. Commit changes:
   ```bash
   git add docs/components.json
   git commit -m "Update component catalog"
   ```

### Testing Locally

Before committing:
1. Serve site locally: `python -m http.server 8000`
2. Test component loading and search
3. Verify filter functionality
4. Check responsive design on mobile
5. Test cart and installation command generation

## SEO and Metadata

### Structured Data
- Schema.org markup for SoftwareApplication
- Open Graph tags for social sharing
- Twitter Card metadata
- Sitemap.xml for search engines

### Performance Optimization
- Cache-busting query parameters for dynamic content
- Progressive loading for large JSON files
- LocalStorage caching for repeat visits
- Lazy loading for images and components below fold

## External Integrations

### GitHub API
- Fetches component files dynamically (legacy, now uses components.json)
- Links to source files on GitHub

### Supabase
- Tracks component downloads
- Aggregates download statistics
- Powers trending components

### Vercel
- Handles routing for SPA-style URLs
- Configured in `vercel.json`

### Analytics
- Hotjar for user behavior tracking
- Counter.dev for page view analytics

## Deployment Checklist

Before deploying to production:

1. **Component Data**: Run `python scripts/generate_components_json.py` to update components.json
2. **Test Locally**: Verify all pages load correctly
3. **Check Links**: Ensure GitHub links point to correct paths
4. **Verify Search**: Test search functionality with various queries
5. **Mobile Testing**: Check responsive design on multiple devices
6. **Cart Testing**: Verify installation commands are generated correctly
7. **Analytics**: Confirm tracking is working

## Common Development Tasks

### Adding New Component Type

1. Update `scripts/generate_components_json.py` to scan new component directory
2. Add new filter button in `index.html`
3. Add icon configuration in `js/script.js` typeConfig
4. Update cart-manager.js to handle new type
5. Regenerate components.json

### Modifying Search Behavior

Edit `js/search-functionality.js`:
- `performSearch()` - Main search logic
- `fuzzyMatch()` - Matching algorithm
- `highlightMatches()` - Result highlighting

### Updating Styles

CSS is modular:
- `css/styles.css` - Main styles and variables
- `css/components.css` - Component cards and grid
- `css/responsive.css` - Mobile breakpoints
- `css/modals.css` - Modal dialogs
- `css/cart.css` - Shopping cart sidebar

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript features (Fetch API, async/await, template literals)
- CSS Grid and Flexbox for layout
- No build step required (vanilla JavaScript)

## Performance Considerations

### Large File Handling
- `components.json` is ~2MB - implement progressive loading
- Use virtual scrolling for large component lists
- Debounce search input to avoid excessive filtering
- Cache parsed JSON in memory after initial load

### Mobile Optimization
- Lazy load images and component content
- Reduce initial bundle size
- Minimize re-renders during search/filter
- Use CSS animations sparingly

## Troubleshooting

### Components Not Loading
- Check browser console for fetch errors
- Verify components.json is accessible
- Ensure CORS is properly configured
- Check GitHub API rate limits (if using legacy loading)

### Search Not Working
- Verify search index is built correctly
- Check fuzzy match threshold in search-functionality.js
- Ensure component data includes searchable fields

### Cart Not Saving
- Check LocalStorage is enabled
- Verify cart data structure matches expected format
- Clear cache and reload if data structure changed

This website serves as the primary user interface for the Claude Code Templates ecosystem, providing an intuitive way to discover and install 500+ components through a terminal-themed, responsive web interface.

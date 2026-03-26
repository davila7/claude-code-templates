# Add Search & Discovery to CLI

## What
Adds search and discovery commands to find and install components from terminal.

## Why
Users currently need to browse the website to find components. This adds in-terminal search to eliminate context switching.

## Changes

### New Commands
```bash
npx cct --search "security"          # Search components
npx cct --discover                   # Auto-detect project & recommend
npx cct --trending                   # Show trending
npx cct --popular                    # Show most popular
npx cct --categories                 # List categories
```

### Features
- Full-text search with fuzzy matching
- Interactive multi-select installation
- Project type detection
- Grouped display by component type
- Category filtering

### Implementation
```
src/search/
├── index.js           # Main orchestrator
├── data-loader.js     # Data loading with caching
├── search-engine.js   # Fuzzy search
├── display.js         # Terminal UI
├── discovery.js       # Project detection
└── trending.js        # Analytics
```

### Performance
- Search: 3-5ms
- Zero new dependencies
- 5-minute cache

### Testing
```bash
node test-search.js  # All tests passing (6/6)
```

## Breaking Changes
None. All new commands are additive.

## Checklist
- [x] Tests passing
- [x] No new dependencies
- [x] Documentation added
- [x] Backward compatible

# CLI Search & Discovery Feature - Implementation Plan

## 🎯 Goal
Add powerful search and discovery capabilities directly in the CLI so developers never need to leave their terminal to find and install components.

## 📋 Feature Overview

### Current Workflow (Problem)
```
Terminal → Browser → aitmpl.com → Search → Copy command → Terminal → Install
⏱️ Takes 2-3 minutes, requires context switching
```

### New Workflow (Solution)
```
Terminal → Search → Install
⏱️ Takes 10 seconds, no context switching
```

## 🏗️ Architecture

### Folder Structure
```
cli-tool/
├── src/
│   ├── search/
│   │   ├── index.js              # Main search orchestrator
│   │   ├── data-loader.js        # Load component data from JSON/API
│   │   ├── search-engine.js      # Search/filter logic
│   │   ├── display.js            # Terminal UI formatting
│   │   ├── discovery.js          # Smart recommendations
│   │   └── trending.js           # Trending/popular analytics
│   ├── index.js                  # Add search command handlers
│   └── ...
├── bin/
│   └── create-claude-config.js   # Add CLI options
└── package.json
```

## 🔧 Implementation Phases

### Phase 1: Data Layer (Foundation)
**File**: `src/search/data-loader.js`

**Responsibilities**:
- Load component data from `.claude-plugin/marketplace.json`
- Parse and normalize component metadata
- Cache data for performance
- Support future API integration

**Data Structure**:
```javascript
{
  agents: [
    {
      id: 'security-auditor',
      name: 'Security Auditor',
      description: 'Enterprise security auditing specialist',
      category: 'security',
      keywords: ['security', 'audit', 'vulnerability'],
      path: './cli-tool/components/agents/security/security-auditor.md',
      downloads: 2345, // From analytics
      trending: 156 // % increase
    }
  ],
  commands: [...],
  mcps: [...],
  skills: [...]
}
```

### Phase 2: Search Engine
**File**: `src/search/search-engine.js`

**Features**:
- Full-text search across name, description, keywords
- Fuzzy matching for typos
- Category filtering
- Multi-field scoring algorithm
- Result ranking by relevance

**Search Algorithm**:
```javascript
function searchComponents(query, options) {
  // 1. Tokenize query
  // 2. Match against: name (weight: 3), description (weight: 2), keywords (weight: 2)
  // 3. Apply fuzzy matching (Levenshtein distance)
  // 4. Filter by category if specified
  // 5. Sort by score + downloads
  // 6. Return top N results
}
```

### Phase 3: Display Layer
**File**: `src/search/display.js`

**Features**:
- Beautiful terminal formatting using chalk
- Component type icons (✨ agents, ⚡ commands, 🔌 MCPs, 🎨 skills)
- Truncated descriptions for readability
- Download counts and trending indicators
- Interactive selection prompts

**Example Output**:
```
🔍 Found 5 components matching "react performance":

AGENTS:
✨ react-performance-optimizer
   Analyzes React apps for performance bottlenecks
   Category: optimization | Downloads: 1,234

⚡ COMMANDS:
⚡ optimize-bundle
   Analyze and optimize webpack bundle size
   Category: performance | Downloads: 567

Install: npx cct --agent react-performance-optimizer
```

### Phase 4: Discovery Engine
**File**: `src/search/discovery.js`

**Features**:
- Auto-detect project type from package.json, requirements.txt, etc.
- Recommend essential components for detected stack
- Show popular components in category
- Display trending components

**Detection Logic**:
```javascript
function detectProjectStack(targetDir) {
  // Check package.json for Next.js, React, Vue, etc.
  // Check requirements.txt for Django, Flask, FastAPI
  // Check go.mod, Cargo.toml, etc.
  // Return: { type: 'nextjs', framework: 'react', language: 'typescript' }
}

function getRecommendations(stack) {
  // Return essential + popular + trending for stack
}
```

### Phase 5: Trending Analytics
**File**: `src/search/trending.js`

**Features**:
- Calculate trending components (7-day growth)
- Show most popular (all-time downloads)
- Category-specific trending
- Integration with existing analytics

**Data Source**:
- Use existing `trackingService` data
- Aggregate download counts
- Calculate growth percentages

## 🎨 CLI Commands

### New CLI Options
```bash
# Text search
npx cct --search "react performance"
npx cct --search "security" --category agents

# Smart discovery
npx cct --discover                    # Auto-detect project
npx cct --discover --project-type nextjs
npx cct --discover --category agents

# Trending & popular
npx cct --trending                    # All categories
npx cct --trending --category agents
npx cct --popular --category commands

# Interactive mode
npx cct --search-interactive          # Full interactive search UI
```

### Integration with Existing Commands
```bash
# Search then install
npx cct --search "nextjs" --install   # Search and prompt to install

# Discover and install all essentials
npx cct --discover --install-essentials
```

## 📊 Data Integration

### Component Metadata Enhancement
Add to each component in marketplace.json:
```json
{
  "name": "security-auditor",
  "description": "...",
  "keywords": ["security", "audit", "vulnerability", "pentesting"],
  "category": "security",
  "projectTypes": ["all"],  // or ["nextjs", "react", "python"]
  "essential": false,       // Is this essential for the project type?
  "popularity": "high"      // high, medium, low
}
```

### Analytics Integration
- Track search queries
- Track discovery usage
- Track install-from-search conversions
- A/B test search algorithms

## 🎯 Success Metrics

### User Experience
- Time to find component: < 10 seconds
- Search accuracy: > 90% relevant results
- Install conversion: > 60% of searches lead to install

### Technical
- Search response time: < 100ms
- Data load time: < 500ms
- Memory usage: < 50MB

## 🚀 Implementation Order

1. **Week 1: Foundation**
   - [ ] Create folder structure
   - [ ] Implement data-loader.js
   - [ ] Add CLI options to bin/create-claude-config.js
   - [ ] Basic search-engine.js (exact match only)

2. **Week 2: Core Search**
   - [ ] Implement fuzzy matching
   - [ ] Add display.js with beautiful formatting
   - [ ] Integrate with existing install functions
   - [ ] Add --search command

3. **Week 3: Discovery**
   - [ ] Implement project detection
   - [ ] Build recommendation engine
   - [ ] Add --discover command
   - [ ] Test with real projects

4. **Week 4: Trending & Polish**
   - [ ] Implement trending.js
   - [ ] Add --trending and --popular commands
   - [ ] Interactive mode
   - [ ] Documentation and examples

## 🧪 Testing Strategy

### Unit Tests
```javascript
// tests/search/search-engine.test.js
describe('Search Engine', () => {
  test('exact match returns correct results', () => {});
  test('fuzzy match handles typos', () => {});
  test('category filter works', () => {});
  test('ranking algorithm prioritizes relevance', () => {});
});
```

### Integration Tests
```javascript
// tests/search/integration.test.js
describe('Search Integration', () => {
  test('search and install workflow', () => {});
  test('discover recommends correct components', () => {});
  test('trending shows recent popular items', () => {});
});
```

### Manual Testing
- Test with various search queries
- Test project detection on real repos
- Test on Windows, Mac, Linux
- Test with slow network connections

## 📝 Documentation

### README Updates
- Add search examples to Quick Start
- Document all new CLI options
- Add search best practices

### New Docs Pages
- Search & Discovery Guide
- Component Discovery Patterns
- Search Query Syntax

## 🔒 Git Strategy

### Branch Rules
- Branch: `feature/cli-search-discovery`
- Only commit files in `cli-tool/` folder
- No changes to root or other folders
- Squash commits before merge

### Commit Messages
```
feat(search): add data loader for component metadata
feat(search): implement fuzzy search engine
feat(search): add beautiful terminal display
feat(discovery): add project type detection
feat(trending): add trending analytics
docs(search): add search documentation
test(search): add search engine tests
```

## 🎨 Code Quality Standards

### Code Style
- Use ESLint with existing config
- Follow existing code patterns
- Add JSDoc comments for all functions
- Use async/await (no callbacks)

### Performance
- Cache component data
- Lazy load when possible
- Optimize search algorithm
- Minimize dependencies

### Error Handling
- Graceful degradation if data unavailable
- Clear error messages
- Fallback to basic search if fuzzy fails

## 🔄 Future Enhancements

### Phase 2 Features
- [ ] Natural language search ("I need help with React performance")
- [ ] AI-powered recommendations
- [ ] Component ratings and reviews
- [ ] Search history and favorites
- [ ] Offline search capability

### API Integration
- [ ] Real-time download counts from API
- [ ] User ratings from community
- [ ] Component compatibility matrix
- [ ] Version compatibility checking

## 📦 Dependencies

### New Dependencies (Minimal)
```json
{
  "fuse.js": "^7.0.0",        // Fuzzy search (optional, can implement manually)
  "cli-table3": "^0.6.3"      // Beautiful tables (optional, can use chalk)
}
```

### Existing Dependencies (Reuse)
- chalk: Terminal colors
- inquirer: Interactive prompts
- ora: Loading spinners
- boxen: Boxes and borders

## 🎯 Definition of Done

- [ ] All CLI commands work as specified
- [ ] Search returns relevant results
- [ ] Discovery detects project types correctly
- [ ] Trending shows accurate data
- [ ] Tests pass with >80% coverage
- [ ] Documentation is complete
- [ ] Code review approved
- [ ] Tested on Windows, Mac, Linux
- [ ] Performance benchmarks met
- [ ] Analytics tracking implemented

---

## 🚀 Let's Build This!

This plan provides a clear roadmap for implementing search and discovery in the CLI. The phased approach allows for incremental development and testing, ensuring each piece works before moving to the next.

**Next Steps**:
1. Review and approve this plan
2. Start with Phase 1: Data Layer
3. Iterate and improve based on feedback

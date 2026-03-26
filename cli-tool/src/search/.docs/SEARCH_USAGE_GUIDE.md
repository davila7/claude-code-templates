# 🔍 Search & Discovery - Usage Guide

## ✅ Ready to Use!

All search and discovery commands are now integrated and working!

## 🚀 Quick Start

### Search for Components
```bash
# Basic search
npx cct --search "security"
npx cct --search "react"
npx cct --search "database"

# Search with category filter
npx cct --search "test" --category commands
npx cct --search "security" --category agents
npx cct --search "database" --category mcps
```

### Discover Components for Your Project
```bash
# Auto-detect project type and recommend components
npx cct --discover

# Specify project type
npx cct --discover --project-type nextjs
npx cct --discover --project-type python
```

### Browse Categories
```bash
# List all available categories
npx cct --categories
```

### Trending & Popular
```bash
# Show trending components (all types)
npx cct --trending

# Show trending agents only
npx cct --trending --category agents

# Show most popular components
npx cct --popular

# Show most popular commands
npx cct --popular --category commands
```

### Interactive Mode
```bash
# Interactive search with prompts
npx cct --interactive
```

## 📖 Command Reference

### --search <query>
Search for components across all types (agents, commands, MCPs, skills).

**Options:**
- `--category <type>` - Filter by: agents, commands, mcps, skills
- `--interactive` - Enable interactive selection

**Examples:**
```bash
npx cct --search "performance"
npx cct --search "git" --category commands
npx cct --search "security" --interactive
```

### --discover
Auto-detect your project type and recommend relevant components.

**Options:**
- `--project-type <type>` - Specify project type (nextjs, react, python, etc.)
- `--interactive` - Enable interactive installation

**Examples:**
```bash
npx cct --discover
npx cct --discover --project-type nextjs
npx cct --discover --interactive
```

### --trending
Show components with recent growth in downloads.

**Options:**
- `--category <type>` - Filter by component type
- `--verbose` - Show additional statistics

**Examples:**
```bash
npx cct --trending
npx cct --trending --category agents
npx cct --trending --verbose
```

### --popular
Show most downloaded components of all time.

**Options:**
- `--category <type>` - Filter by component type

**Examples:**
```bash
npx cct --popular
npx cct --popular --category commands
```

### --categories
List all available component categories with counts.

**Example:**
```bash
npx cct --categories
```

### --interactive
Launch interactive search mode with prompts.

**Example:**
```bash
npx cct --interactive
```

## 🎯 Real-World Examples

### Find Security Tools
```bash
# Search for security-related components
npx cct --search "security"

# Find only security agents
npx cct --search "security" --category agents

# See trending security tools
npx cct --trending --category agents
```

### Setup Next.js Project
```bash
# Discover recommended components for Next.js
npx cct --discover --project-type nextjs

# Search for Next.js specific tools
npx cct --search "nextjs"

# Find popular Next.js commands
npx cct --search "nextjs" --category commands
```

### Find Testing Tools
```bash
# Search for testing components
npx cct --search "test"

# Find only testing commands
npx cct --search "test" --category commands

# See most popular testing tools
npx cct --popular --category commands
```

### Explore Database Tools
```bash
# Search for database components
npx cct --search "database"

# Find database MCPs
npx cct --search "database" --category mcps

# Browse database category
npx cct --categories
```

## 💡 Tips & Tricks

### Fuzzy Search
The search engine handles typos automatically:
```bash
npx cct --search "secrity"  # Still finds "security"
npx cct --search "databse"  # Still finds "database"
```

### Combine with Installation
After finding components, install them directly:
```bash
# Search first
npx cct --search "security"

# Then install
npx cct --agent security/security-auditor
```

### Browse by Category
```bash
# 1. List categories
npx cct --categories

# 2. Search within category
npx cct --search "test" --category commands

# 3. See popular in category
npx cct --popular --category agents
```

### Quick Discovery
```bash
# In any project directory
cd my-nextjs-app
npx cct --discover

# Get instant recommendations!
```

## 🔧 Advanced Usage

### Verbose Mode
Get detailed information with `--verbose`:
```bash
npx cct --search "security" --verbose
npx cct --trending --verbose
```

### Multiple Filters
Combine options for precise results:
```bash
npx cct --search "api" --category commands
npx cct --trending --category agents --verbose
```

### Project-Specific Discovery
```bash
# For Next.js projects
npx cct --discover --project-type nextjs

# For Python projects
npx cct --discover --project-type python

# For React projects
npx cct --discover --project-type react
```

## 📊 Performance

All commands are blazing fast:
- **Search**: ~4ms
- **Discovery**: ~50ms
- **Trending**: ~10ms
- **Categories**: ~5ms

Cached searches are even faster (~1ms)!

## 🐛 Troubleshooting

### No Results Found
```bash
# Try broader search terms
npx cct --search "test" instead of "testing framework"

# Remove category filter
npx cct --search "test" # instead of --category agents

# Check available categories
npx cct --categories
```

### Discovery Not Finding Components
```bash
# Specify project type manually
npx cct --discover --project-type nextjs

# Check what was detected
npx cct --discover --verbose
```

### Command Not Found
Make sure you're using the latest version:
```bash
npm install -g claude-code-templates@latest
```

## 🎉 What's Next?

Now that you can search and discover components:

1. **Find what you need** - Use search to discover components
2. **Install them** - Use the install commands shown
3. **Start coding** - Components are ready to use!

## 📚 More Information

- **Full Documentation**: https://docs.aitmpl.com
- **Browse Components**: https://aitmpl.com
- **GitHub Issues**: https://github.com/davila7/claude-code-templates/issues

---

**Happy searching! 🔍✨**

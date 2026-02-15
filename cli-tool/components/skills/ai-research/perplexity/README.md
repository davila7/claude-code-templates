# Perplexity Skill

A comprehensive guide for using Perplexity AI tools effectively within Claude Code. This skill helps you choose the right search and research tool for your needs while avoiding context bloat and unnecessary API calls.

## Purpose

This skill provides clear guidelines for when and how to use Perplexity's search and conversational AI capabilities, ensuring you select the most appropriate tool for each task while respecting token budgets and avoiding overlaps with other specialized tools.

## When to Use This Skill

Use Perplexity tools ONLY when users explicitly request:
- **Search queries**: "search", "find", "look up", "research"
- **Current information**: "what's the latest", "recent trends"
- **Generic questions**: Broad topics not covered by specialized tools

## When NOT to Use This Skill

Do NOT use Perplexity for:
- **Library/framework documentation** → Use Context7 MCP instead
- **Graphite `gt` CLI commands** → Use Graphite MCP instead
- **Workspace-specific questions** → Use Nx MCP instead
- **Specific URLs** → Use URL Crawler instead
- **Deep research** → Use Researcher agent (`/research`) instead

## Available Tools

### 1. Perplexity Search

**Best for**: Finding resources, URLs, and current best practices

**When to use**:
- Discovering tutorials, blog posts, or articles
- Finding recent information about technologies
- User says "search for...", "find...", "look up..."

**Default usage** (always start with these limits):
```typescript
mcp__perplexity__perplexity_search({
  query: "your search query",
  max_results: 3,           // Default is 10 - too many!
  max_tokens_per_page: 512  // Reduce per-result content
})
```

**When to increase limits**:
Only increase limits if:
- User explicitly needs comprehensive results
- Initial search found nothing useful
- Complex topic requires multiple sources

```typescript
// Increased limits (use sparingly)
mcp__perplexity__perplexity_search({
  query: "complex topic",
  max_results: 5,
  max_tokens_per_page: 1024
})
```

### 2. Perplexity Ask

**Best for**: Getting conversational explanations synthesized from web sources

**When to use**:
- Need explanation, not just search results
- Synthesize information from multiple web sources
- Explain concepts with current context

**Usage**:
```typescript
mcp__perplexity__perplexity_ask({
  messages: [
    {
      role: "user",
      content: "Explain how postgres advisory locks work"
    }
  ]
})
```

**NOT for**:
- Library documentation (use Context7)
- Deep multi-source research (use researcher agent)

### 3. Perplexity Research (PROHIBITED)

**NEVER use**: `mcp__perplexity__perplexity_research`

**Why**: Extremely high token cost (30-50k tokens)

**Use instead**: Researcher agent (`/research <topic>`)
- Provides multi-source synthesis with citations
- Use sparingly for complex questions only

## Tool Selection Chain

When a user asks a question, follow this priority order:

1. **Context7 MCP** - Library/framework documentation
2. **Graphite MCP** - Any `gt` CLI mention
3. **Nx MCP** - Questions about THIS workspace
4. **Perplexity Search** - Generic searches
5. **Perplexity Ask** - Conversational answers
6. **Researcher agent** - Deep multi-source research
7. **WebSearch** - Last resort (after Perplexity exhausted)

## Usage Examples

### Correct Usage

**Use Perplexity Search:**
```
User: "Find postgres migration best practices"
User: "Search for React testing tutorials"
User: "Look up latest trends in microservices"
```

**Use Perplexity Ask:**
```
User: "Explain how postgres advisory locks work"
User: "What are the trade-offs of microservices?"
```

### Incorrect Usage (Use Other Tools)

**Use Context7 instead:**
```
❌ "Search for React hooks documentation"
❌ "Find Next.js routing docs"
❌ "Look up Temporal workflow API"
```

**Use Graphite MCP instead:**
```
❌ "Search for gt stack commands"
❌ "Find gt branch workflow"
```

**Use Nx MCP instead:**
```
❌ "Search for build config" (in THIS workspace)
❌ "Find project dependencies" (in THIS workspace)
```

## Key Features

- **Token budget awareness**: Default to limited results to avoid context bloat
- **Clear tool boundaries**: Know when to use Perplexity vs. specialized tools
- **Fallback chain**: Search → Ask → WebSearch (last resort)
- **Research delegation**: Use researcher agent for deep dives, not raw Perplexity API

## Best Practices

1. **Start conservative**: Always use `max_results: 3` and `max_tokens_per_page: 512`
2. **Check alternatives first**: Try Context7, Graphite MCP, or Nx MCP before Perplexity
3. **Know your trigger words**: "search", "find", "look up", "research", "latest"
4. **Avoid research tool**: Never use `perplexity_research` - use researcher agent instead
5. **Respect the chain**: Follow the tool selection priority order

## Common Pitfalls

- Using Perplexity for library docs (use Context7)
- Using high limits by default (causes context bloat)
- Using `perplexity_research` directly (use researcher agent)
- Skipping the tool selection chain
- Not checking if specialized tools apply first

## Integration with Other Skills

- **Context7**: For library/framework documentation
- **Graphite MCP**: For `gt` CLI operations
- **Nx MCP**: For workspace-specific queries
- **Researcher agent**: For deep research tasks
- **WebSearch**: As absolute last resort fallback

## Quick Decision Matrix

| User Request | Tool to Use |
|--------------|-------------|
| React hooks docs | Context7 MCP |
| gt stack command | Graphite MCP |
| Build config here | Nx MCP |
| Find migration guide | Perplexity Search |
| Explain advisory locks | Perplexity Ask |
| Deep research report | Researcher agent |
| Generic web search | WebSearch (last resort) |

## Summary

The Perplexity skill ensures you use Perplexity AI tools effectively and appropriately:
- Choose the right tool (Search vs. Ask)
- Respect token budgets with conservative limits
- Defer to specialized tools when appropriate
- Avoid the expensive research tool
- Follow the tool selection chain

By following these guidelines, you'll provide better, faster, and more cost-effective responses to users.

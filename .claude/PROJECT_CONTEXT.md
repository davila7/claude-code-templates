# Web Automation & Research Project Context

## Project Overview

This project uses Claude Code's multi-agent system for advanced web automation, research, and site interaction tasks. The system leverages specialized agents to handle complex workflows involving:

- **Web Research & Information Gathering** - Finding and synthesizing information from the internet
- **Web Scraping & Data Extraction** - Extracting structured data from websites
- **Account Management & Authentication** - Logging into sites, creating accounts, managing credentials
- **Website Crawling & Navigation** - Navigating multi-page websites and following links
- **Documentation & Context Management** - Organizing findings and maintaining project context

## Environment

**Platform:** Claude Code Web (Cloud-based)

**Constraints:**
- All automation must work in cloud/serverless environments
- No persistent local storage between sessions
- Limited execution time for operations
- Must use cloud-compatible Python libraries

**Python Libraries Available:**
- `requests` / `httpx` - HTTP client libraries
- `beautifulsoup4` - HTML parsing
- `playwright-python` - Headless browser automation
- `lxml` - XML/HTML processing
- Standard library modules

## Installed Agents

### 🎯 Core Orchestration & Research

1. **multi-agent-orchestrator** - Coordinates multiple specialized agents for complex workflows
2. **web-research-specialist** - Expert at web searches, information gathering, and synthesis
3. **web-automation-engineer** - Python-based web scraping, crawling, and automation

### 🔍 Research Team

4. **research-orchestrator** - Coordinates multi-domain research projects
5. **research-synthesizer** - Synthesizes findings from multiple sources
6. **technical-researcher** - Deep technical documentation and API research
7. **search-specialist** - Optimizes search queries and strategies

### 📝 Documentation & Context

8. **technical-writer** - Creates clear technical documentation
9. **documentation-expert** - Expert at documentation strategy and organization
10. **context-manager** - Manages project context and information flow

### 💻 Development Support

11. **frontend-developer** - Frontend development and UI work
12. **backend-architect** - Backend architecture and API design
13. **fullstack-developer** - Full-stack application development
14. **code-reviewer** - Code quality and best practices review
15. **debugger** - Debugging and troubleshooting expert
16. **error-detective** - Error analysis and resolution

### 🤖 AI & Tooling

17. **prompt-engineer** - AI prompt optimization
18. **task-decomposition-expert** - Breaking down complex tasks
19. **agent-expert** - Creating and managing specialized agents
20. **command-expert** - Creating custom Claude Code commands
21. **mcp-expert** - Model Context Protocol integrations
22. **cli-ui-designer** - Command-line interface design
23. **docusaurus-expert** - Docusaurus documentation sites

## Common Workflows

### 1. Research → Implementation Pipeline

```
User Request
    ↓
multi-agent-orchestrator
    ↓
├─→ web-research-specialist (gather information)
│       ↓
│   research-synthesizer (analyze findings)
│       ↓
└─→ web-automation-engineer (implement solution)
    ↓
documentation-expert (document results)
```

### 2. Web Scraping & Data Extraction

```
User Request
    ↓
web-automation-engineer
    ├─→ Analyze target website
    ├─→ Identify authentication requirements
    ├─→ Write Python scraping code
    ├─→ Extract and structure data
    └─→ Export results (JSON/CSV)
```

### 3. Account Management Automation

```
User Request
    ↓
web-automation-engineer
    ├─→ Navigate to registration page
    ├─→ Fill out forms with provided data
    ├─→ Handle CSRF tokens and validation
    ├─→ Submit and verify account creation
    └─→ Save credentials securely (env vars)
```

### 4. Multi-Source Research

```
User Request
    ↓
research-orchestrator
    ↓
├─→ web-research-specialist (web sources)
├─→ technical-researcher (docs/APIs)
└─→ search-specialist (optimized queries)
    ↓
research-synthesizer
    ↓
technical-writer (create report)
```

## Best Practices

### Web Automation

- **Use headless browsers** (`playwright-python`) for JavaScript-heavy sites
- **Implement rate limiting** - Respect website resources (1-2 sec delays)
- **Check robots.txt** - Follow site crawling guidelines
- **Handle errors gracefully** - Implement retry logic with exponential backoff
- **Save state frequently** - Use checkpoints for resumable operations
- **Use environment variables** - Never hardcode credentials

### Research

- **Validate sources** - Use 4-tier credibility framework
- **Cross-reference** - Verify information across multiple sources
- **Cite properly** - Include URLs and confidence levels
- **Synthesize insights** - Don't just aggregate, analyze
- **Identify gaps** - Note what information is missing

### Context Management

- **Update PROJECT_CONTEXT.md** - Keep this file current with progress
- **Use TodoWrite** - Track multi-step tasks transparently
- **Document findings** - Create markdown summaries of discoveries
- **Save credentials** - Use `.env` files (gitignored) for sensitive data
- **Export data** - Save scraped data in structured formats (JSON/CSV)

## Project Structure

```
/home/user/claude-code-templates/
├── .claude/
│   ├── PROJECT_CONTEXT.md      # This file
│   ├── agents/                 # Installed specialized agents (24)
│   ├── scripts/                # Python automation scripts
│   └── data/                   # Scraped data and exports
├── .env                        # Environment variables (gitignored)
├── research/                   # Research findings and reports
└── automation/                 # Web automation scripts
```

## Security & Ethics

### Allowed Activities
✅ Authorized web scraping (public data, respecting robots.txt)
✅ Account management for personal/authorized accounts
✅ Research and information gathering from public sources
✅ Automation of repetitive manual tasks
✅ Testing and educational purposes

### Prohibited Activities
❌ Scraping sites that explicitly prohibit it (robots.txt)
❌ Creating fake/fraudulent accounts
❌ Bypassing authentication or security measures
❌ Excessive requests that could harm site performance
❌ Scraping personal/private data without authorization
❌ Violating terms of service

## Getting Started

### 1. Simple Web Research Example

```
Hey @multi-agent-orchestrator, I need to research the best Python web
scraping libraries for cloud environments and create a comparison table.
```

### 2. Login Automation Example

```
Hey @web-automation-engineer, I need to automate logging into
example.com with username/password authentication. The credentials
are in my .env file.
```

### 3. Data Extraction Example

```
Hey @web-automation-engineer, scrape the product listings from
catalog.example.com (pages 1-10) and export to CSV with:
product name, price, rating, and URL.
```

## Tips for Success

1. **Start with research** - Use `@web-research-specialist` before implementing
2. **Break down tasks** - Let `@multi-agent-orchestrator` coordinate complex workflows
3. **Test incrementally** - Start with single pages before batch operations
4. **Handle edge cases** - Account for missing data, timeouts, and errors
5. **Document progress** - Keep context updated for future sessions
6. **Use checkpoints** - Save progress for resumable long-running operations

## Session Workflow

For each task:

1. **Planning** - Describe what you want to accomplish
2. **Research** - Gather necessary information (if needed)
3. **Implementation** - Write and run automation code
4. **Validation** - Verify results and handle errors
5. **Documentation** - Save findings and update context
6. **Iteration** - Refine based on results

---

**Last Updated:** 2025-11-28
**Environment:** Claude Code Web (Cloud)
**Primary Use Cases:** Web research, scraping, automation, account management

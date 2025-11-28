# Quick Start Guide - Multi-Agent Web Automation System

## 🚀 Getting Started

You now have **24 specialized agents** installed and ready to help with web research, scraping, automation, and more.

## 📋 How to Use Agents

### Method 1: Direct Agent Mention (Recommended)

Simply mention an agent in your message:

```
Hey @web-research-specialist, find the best Python libraries for web scraping
```

```
@web-automation-engineer, log into example.com and scrape the data
```

### Method 2: Let the Orchestrator Decide

For complex multi-step tasks, use the orchestrator:

```
@multi-agent-orchestrator, I need to research authentication best practices,
then build a login automation script for my project
```

The orchestrator will automatically:
1. Use `@web-research-specialist` to gather info
2. Use `@web-automation-engineer` to implement
3. Use `@technical-writer` to document the solution

## 🎯 Common Use Cases

### 🔍 Web Research

**Simple Research:**
```
@web-research-specialist, what are the best practices for web scraping in 2025?
```

**Competitive Analysis:**
```
@web-research-specialist, compare Playwright vs Selenium for Python automation
```

**Deep Research:**
```
@research-orchestrator, I need a comprehensive analysis of OAuth 2.0
implementation approaches with code examples
```

### 🤖 Web Automation

**Login Automation:**
```
@web-automation-engineer, create a script to log into github.com using
environment variables for credentials
```

**Data Scraping:**
```
@web-automation-engineer, scrape product data from example.com/products
(pages 1-5) and save to CSV
```

**Account Creation:**
```
@web-automation-engineer, automate account creation on signup.example.com
with the details I'll provide
```

**Multi-Page Crawling:**
```
@web-automation-engineer, crawl example.com/blog and extract all article
titles, dates, and URLs
```

### 📝 Documentation

**Create Documentation:**
```
@technical-writer, document the web scraping script I just created
```

**Update Context:**
```
@context-manager, summarize our progress so far and update PROJECT_CONTEXT.md
```

### 🛠️ Development

**Code Review:**
```
@code-reviewer, review this Python scraping script for best practices
```

**Debug Issues:**
```
@debugger, this script is failing with a timeout error. Help me fix it.
```

**Error Analysis:**
```
@error-detective, I'm getting a 403 Forbidden error when scraping. Investigate.
```

## 💡 Example Workflows

### Example 1: Research + Implementation

```
@multi-agent-orchestrator,

I need to:
1. Research the best way to handle JavaScript-heavy websites in Python
2. Create a script to scrape data from a dynamic site
3. Document the solution

Target site: example.com/products (loads data with JavaScript)
Data needed: product names, prices, ratings
```

**What happens:**
- `web-research-specialist` researches JS scraping approaches
- `research-synthesizer` creates comparison of options
- `web-automation-engineer` implements Playwright-based solution
- `technical-writer` documents the code

### Example 2: Login + Scrape Workflow

```
@web-automation-engineer,

Create a script that:
1. Logs into dashboard.example.com with my credentials (in .env)
2. Navigates to /reports section
3. Downloads all reports from the last 30 days
4. Saves them to ./data/ folder

The site uses session cookies and CSRF tokens.
```

### Example 3: Multi-Source Research

```
@research-orchestrator,

Research topic: "Best practices for ethical web scraping"

I need:
- Legal considerations
- Technical best practices (rate limiting, robots.txt)
- Common pitfalls to avoid
- Code examples

Synthesize from multiple authoritative sources.
```

## 🗂️ Project Structure

```
claude-code-templates/
├── .claude/
│   ├── PROJECT_CONTEXT.md    # Overall project context (READ THIS!)
│   ├── USAGE_GUIDE.md        # This file
│   ├── agents/               # 24 installed agents
│   ├── scripts/              # Python automation scripts
│   └── data/                 # Scraped data outputs
├── .env                      # Credentials (create this, gitignored)
├── research/                 # Research findings
└── automation/               # Automation scripts
```

## ⚙️ Environment Setup

### Create .env File

Create a `.env` file in the project root for credentials:

```bash
# .env (this file is gitignored)

# Example credentials
EXAMPLE_USERNAME=myusername
EXAMPLE_PASSWORD=mypassword
EXAMPLE_API_KEY=abc123xyz

# GitHub (if needed)
GITHUB_TOKEN=ghp_xxxxx

# Add your credentials here
```

Access in Python:
```python
import os
from dotenv import load_dotenv

load_dotenv()
username = os.getenv('EXAMPLE_USERNAME')
```

## 📊 Installed Agents Reference

### Core (3)
- `multi-agent-orchestrator` - Coordinates complex multi-agent workflows
- `web-research-specialist` - Web search and information gathering
- `web-automation-engineer` - Python web scraping and automation

### Research (4)
- `research-orchestrator` - Multi-domain research coordination
- `research-synthesizer` - Synthesizes findings from multiple sources
- `technical-researcher` - Technical documentation research
- `search-specialist` - Search query optimization

### Documentation (3)
- `technical-writer` - Technical documentation
- `documentation-expert` - Documentation strategy
- `context-manager` - Context and information management

### Development (6)
- `frontend-developer` - Frontend/UI development
- `backend-architect` - Backend architecture
- `fullstack-developer` - Full-stack development
- `code-reviewer` - Code review and quality
- `debugger` - Debugging assistance
- `error-detective` - Error analysis

### AI & Tooling (5)
- `prompt-engineer` - AI prompt optimization
- `task-decomposition-expert` - Task breakdown
- `agent-expert` - Agent creation and management
- `command-expert` - Custom command creation
- `mcp-expert` - MCP integrations

### Specialized (3)
- `cli-ui-designer` - CLI interface design
- `docusaurus-expert` - Docusaurus sites
- (Agent expert, command expert, MCP expert already listed above)

## 🎓 Best Practices

### 1. **Start Simple, Scale Up**
Test with one page before scraping hundreds

### 2. **Be Polite**
- Add delays between requests (1-2 seconds)
- Respect robots.txt
- Use proper User-Agent headers

### 3. **Handle Errors**
- Implement retry logic
- Save checkpoints for resumable operations
- Log errors for debugging

### 4. **Secure Credentials**
- ALWAYS use .env files
- NEVER hardcode passwords
- Add .env to .gitignore

### 5. **Document Everything**
- Update PROJECT_CONTEXT.md regularly
- Save scraped data with timestamps
- Keep code comments clear

## 🔧 Troubleshooting

### "Module not found" errors
```
# Install required Python packages
pip install requests beautifulsoup4 playwright httpx python-dotenv lxml

# For Playwright, also run:
playwright install
```

### "403 Forbidden" or blocked requests
- Check robots.txt
- Add delays between requests
- Use proper User-Agent header
- Consider using `@web-automation-engineer` for advice

### Timeout errors
- Increase timeout values
- Check internet connection
- Site may be slow, add retries

### Need help?
```
@error-detective, I'm getting this error: [paste error]
```

## 🚦 Quick Command Reference

```bash
# Install Python dependencies
pip install requests beautifulsoup4 playwright httpx python-dotenv lxml

# Install Playwright browsers
playwright install chromium

# Run a Python script
python automation/my_script.py

# Check Python version
python --version
```

## 📚 Next Steps

1. **Read PROJECT_CONTEXT.md** - Understand the project setup
2. **Create .env file** - Add your credentials
3. **Try a simple example** - Start with web research
4. **Build from there** - Gradually add automation

## 💬 Example Conversations

**Quick Research:**
```
@web-research-specialist, what's the difference between BeautifulSoup and lxml?
```

**Build Something:**
```
@web-automation-engineer, create a script to scrape quotes from
quotes.toscrape.com and save to CSV
```

**Complex Workflow:**
```
@multi-agent-orchestrator, research login automation best practices,
then build a script to log into my site and download reports
```

---

**Ready to start?** Just mention an agent and describe what you need!

Example:
```
@web-research-specialist, I need to find documentation on Python
Playwright for web automation
```

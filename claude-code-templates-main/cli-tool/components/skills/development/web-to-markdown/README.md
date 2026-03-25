# web-to-markdown

Convert web pages to clean Markdown using local browser automation with Puppeteer and Readability.

## Purpose

This skill enables Claude Code to convert web pages (including JavaScript-rendered content) into clean, readable Markdown format by leveraging the `web2md` CLI tool. It's particularly useful for extracting article content, documentation, or any web content that needs to be processed, archived, or analyzed in Markdown format.

## When to Use

Use this skill when you need to:

- Extract article content from news sites, blogs, or documentation
- Convert JavaScript-heavy pages that simple HTTP fetching can't handle
- Archive web content in a readable, portable format
- Process web content for analysis or documentation
- Handle pages with login walls or human verification (using interactive mode)
- Batch convert multiple URLs to Markdown files

**Important:** This skill must be explicitly invoked by the user with phrases like:
- "use the skill web-to-markdown ..."
- "use a skill web-to-markdown ..."

This is a hard requirement to prevent accidental usage when simpler tools might suffice.

## How It Works

The skill uses the `web2md` CLI tool which:

1. **Launches a real browser** (Chrome/Chromium/Brave/Edge) via Puppeteer
2. **Renders the page** including all JavaScript and dynamic content
3. **Extracts main content** using Mozilla's Readability library
4. **Converts to Markdown** using Turndown with cleaned links
5. **Outputs** to stdout or saves to file(s) with optional YAML frontmatter

This approach handles modern single-page applications and JavaScript-rendered content that simple HTTP fetchers cannot process.

## Key Features

- **JavaScript Support**: Renders pages with Puppeteer, capturing dynamically loaded content
- **Smart Content Extraction**: Uses Readability to identify and extract main article content
- **Flexible Output**: Print to stdout, save to specific files, or auto-name files in a directory
- **Interactive Mode**: Handle login walls and human verification challenges
- **Batch Processing**: Convert multiple URLs in one operation
- **Wait Strategies**: Multiple options to ensure content is fully loaded before extraction
- **Browser Profiles**: Support for persistent user data directories (sessions, logins)
- **Clean Markdown**: Produces readable, well-formatted Markdown with optional metadata

## Prerequisites

The `web2md` CLI tool must be installed. The skill will check for it and provide installation instructions if needed:

```bash
# If available via npm
npm install -g web2md

# If installing from source
git clone <repository-url>
cd web2md
npm install
npm run build
npm link
```

## Usage Examples

### Basic Conversion

Convert a single URL and save to a file:

```bash
use the skill web-to-markdown to convert https://example.com/article to article.md
```

This will run:
```bash
web2md 'https://example.com/article' --out ./article.md
```

### Auto-Named Output

Convert a URL and let the tool name the file based on page title:

```bash
use the skill web-to-markdown to convert https://example.com/article and save to ./output/
```

This creates a directory and auto-names the file:
```bash
mkdir -p ./output
web2md 'https://example.com/article' --out ./output/
```

### Print to Console

Convert and display the Markdown (useful for quick inspection):

```bash
use the skill web-to-markdown to convert https://example.com/article and print the result
```

This will run:
```bash
web2md 'https://example.com/article' --print
```

### Interactive Mode (Login Walls)

Handle pages requiring login or human verification:

```bash
use the skill web-to-markdown to convert https://example.com/protected-article in interactive mode
```

This will run:
```bash
mkdir -p ./tmp/web2md-profile
web2md 'https://example.com/protected-article' --interactive --user-data-dir ./tmp/web2md-profile --out ./output/
```

The browser window will appear, allowing you to complete login or verification, then press Enter to continue.

### Batch Conversion

Convert multiple URLs:

```bash
use the skill web-to-markdown to convert these URLs:
- https://example.com/article1
- https://example.com/article2
- https://example.com/article3
Save them to ./articles/
```

This will create the directory and run separate commands for each URL:
```bash
mkdir -p ./articles
web2md 'https://example.com/article1' --out ./articles/
web2md 'https://example.com/article2' --out ./articles/
web2md 'https://example.com/article3' --out ./articles/
```

### Advanced Wait Strategies

For heavy JavaScript applications:

```bash
use the skill web-to-markdown to convert https://app.example.com/dashboard
Wait for the main selector to appear
```

This will run:
```bash
web2md 'https://app.example.com/dashboard' --wait-until domcontentloaded --wait-for 'main' --out ./dashboard.md
```

## Advanced Options

The skill supports various options to handle tricky pages:

- `--chrome-path <path>`: Specify Chrome/Chromium location if auto-detection fails
- `--interactive`: Show browser and pause for manual intervention
- `--wait-until <event>`: Wait for `load`, `domcontentloaded`, `networkidle0`, or `networkidle2` (default: `networkidle2`)
- `--wait-for '<selector>'`: Wait for specific CSS selector to appear
- `--wait-ms <milliseconds>`: Additional wait time in milliseconds
- `--headful`: Show browser window (useful for debugging)
- `--no-sandbox`: Disable sandbox (sometimes required in containers/CI)
- `--user-data-dir <dir>`: Use persistent browser profile (for sessions/logins)

## Output Format

The generated Markdown includes:

- **YAML Frontmatter** (optional): Title, author, publication date, URL, excerpt
- **Main Content**: Article text with preserved formatting
- **Clean Links**: Properly formatted Markdown links
- **Images**: Preserved with alt text and captions where available

## Technical Details

- **Browser Automation**: Uses `puppeteer-core` with local Chrome/Chromium
- **Content Extraction**: Mozilla Readability library
- **Markdown Conversion**: Turndown library
- **Supported Browsers**: Chrome, Chromium, Brave, Edge (Chromium-based)

## Troubleshooting

**Chrome not found:**
- Install Chrome/Chromium or specify path with `--chrome-path`

**Page content incomplete:**
- Try `--wait-until networkidle2` (waits for network to settle)
- Use `--wait-for '<selector>'` to wait for specific elements
- Add `--wait-ms 2000` for additional delay

**Login required:**
- Use `--interactive` mode to manually login
- Use `--user-data-dir` to persist session across runs

**Verification/CAPTCHA:**
- Use `--interactive` mode to complete verification manually

## Version

Current version: 0.1.0

## Related Tools

For simpler use cases without JavaScript, consider using Claude Code's built-in `WebFetch` tool instead.

# Growth Kit - Content Marketing Automation Commands

## Overview

This PR adds **Growth Kit** - a comprehensive content marketing automation toolkit that helps developers distribute blog content across social media platforms with a single command.

Built by [Kanaeru Labs](https://www.kanaeru.ai) while building Kanaeru AI, these commands solve the time-consuming problem of manually converting blog posts into platform-specific content.

## What's Included

### Marketing Commands (5 new commands)

**New Category:** `commands/marketing/`

1. **`publisher-x.md`** - X/Twitter Thread Generator
   - Generates copy-pastable X threads from any content source
   - **3 format options**: Thread (5-8 posts), Single Long, Single Short
   - Supports multi-language (EN/JA)
   - Creates interactive HTML preview with copy buttons
   - Auto-opens X.com for posting

2. **`publisher-linkedin.md`** - LinkedIn Post Generator
   - Creates professional LinkedIn posts via API
   - Automatic media attachment (images/PDFs)
   - Handles OAuth flow automatically
   - Works with zero dependencies (bash + curl only)

3. **`publisher-medium.md`** - Medium Article Converter
   - Converts blog posts to Medium-ready HTML
   - Image upload markers with file paths
   - One-click copy from HTML preview
   - Opens Medium editor automatically

4. **`publisher-devto.md`** - Dev.to RSS Generator
   - Generates complete RSS feed from all blog posts
   - One-time setup for automatic syndication
   - All future posts auto-import to Dev.to

5. **`publisher-all.md`** - All-Platform Generator
   - Runs all 4 publishers in one command
   - Saves ~2 hours of manual work per post
   - Opens all previews in browser tabs

### Setup Commands (1 new command)

**Existing Category:** `commands/setup/`

6. **`vercel-analytics.md`** - Vercel Analytics Setup
   - Auto-installs @vercel/analytics and @vercel/speed-insights
   - Configures React/Vite apps
   - Creates vercel.json for SPA routing
   - Fixes 404 errors on Vercel deployment

## Key Features

✅ **Universal Input Support**
- Blog post slugs (e.g., `2025-10-06-my-post`)
- File paths (markdown, PDF, HTML, text)
- URLs (fetches and converts)

✅ **Zero Dependencies**
- Works in ANY repo type (Python, Rust, Go, JavaScript, etc.)
- Uses only Claude's built-in tools (Read, Write, Bash, Glob, WebFetch)
- No Node.js/npm required (except for Vercel Analytics)

✅ **Multi-Language Support**
- English and Japanese (EN/JA)
- Auto-detects language from content/path
- Platform-specific tone and formatting

✅ **Production-Ready**
- Tested at Kanaeru Labs in production
- Handles LinkedIn API authentication
- Proper character counting for X/Twitter
- HTML preview files with copy buttons

## Use Cases

**For Blog Authors:**
```bash
# Distribute a blog post across all platforms
/publisher-all my-latest-post

# Generate just an X thread
/publisher-x my-latest-post

# Create LinkedIn post with custom image
/publisher-linkedin my-latest-post en diagram.png
```

**For Content Marketers:**
```bash
# Convert any URL to X thread
/publisher-x https://competitor.com/article

# Generate Medium article from PDF
/publisher-medium whitepaper.pdf

# Set up Dev.to auto-syndication
/publisher-devto
```

**For Developers:**
```bash
# Add analytics to React app
/vercel-analytics
```

## Testing

All commands have been:
- ✅ Tested in production at Kanaeru Labs
- ✅ Validated across multiple blog structures
- ✅ Verified to work in Python, Rust, Go, and JavaScript repos
- ✅ Tested with both English and Japanese content

## Benefits to the Community

**Time Savings:**
- X thread generation: ~30 minutes → 2 minutes
- All platforms: ~2 hours → 5 minutes
- One-time Dev.to setup enables automatic future syndication

**Developer-Friendly:**
- No configuration required (auto-detects blog structure)
- Works universally (any repo type, any framework)
- Clear error messages and helpful prompts

**Production Quality:**
- Proper API authentication handling
- Character limit validation
- Multi-language support
- HTML previews for easy copying

## Integration Notes

**File Locations:**
- Marketing commands: `cli-tool/components/commands/marketing/`
- Analytics command: `cli-tool/components/commands/setup/`

**Frontmatter Format:**
All commands include proper frontmatter:
```yaml
---
allowed-tools: Read, Write, Bash, Glob, WebFetch
argument-hint: <input> [lang]
description: [Clear description]
---
```

**Auto-Discovery:**
Commands will be automatically discovered by the `scripts/generate_components_json.py` script when scanning the commands directory.

## Screenshots

Available at: https://github.com/kanaerulabs/growth-kit

See the Growth Kit README for visual examples of:
- X thread preview with 3 format tabs
- LinkedIn post with PDF attachment
- Medium article preview
- Dev.to RSS feed structure

## Attribution

**Author:** Kanaeru Labs (https://www.kanaeru.ai)
**Source Repository:** https://github.com/kanaerulabs/growth-kit
**License:** MIT
**Contact:** support@kanaeru.ai

## Related Resources

- Growth Kit Documentation: https://github.com/kanaerulabs/growth-kit
- Example Blog Posts: See Growth Kit repo for real examples
- LinkedIn API Setup: https://www.linkedin.com/developers/apps

---

## Why This Matters

Content distribution is a major bottleneck for developer bloggers and technical content creators. These commands solve real pain points we experienced while building Kanaeru AI:

- **Manual X thread creation** - repetitive and time-consuming
- **Platform-specific formatting** - each platform has different requirements
- **Character counting** - easy to exceed limits
- **Media attachment** - LinkedIn API complexity
- **Syndication setup** - Dev.to RSS configuration

Growth Kit automates all of this with Claude Code's built-in capabilities.

---

**We believe these commands will be valuable to the Claude Code community and help developers share their technical content more effectively.**

---
name: baoyu-post-to-x
description: Post content and articles to X (Twitter). Supports regular posts with images and X Articles (long-form Markdown). Uses real Chrome with CDP to bypass anti-automation.
---

# Post to X (Twitter)

Post content, images, and long-form articles to X using real Chrome browser (bypasses anti-bot detection).

## Script Directory

**Important**: All scripts are located in the `scripts/` subdirectory of this skill.

**Agent Execution Instructions**:
1. Determine this SKILL.md file's directory path as `SKILL_DIR`
2. Script path = `${SKILL_DIR}/scripts/<script-name>.ts`
3. Replace all `${SKILL_DIR}` in this document with the actual path

**Script Reference**:
| Script | Purpose |
|--------|---------|
| `scripts/x-browser.ts` | Regular posts (text + images) |
| `scripts/x-article.ts` | Long-form article publishing (Markdown) |
| `scripts/md-to-html.ts` | Markdown → HTML conversion |
| `scripts/copy-to-clipboard.ts` | Copy content to clipboard |
| `scripts/paste-from-clipboard.ts` | Send real paste keystroke |

## Prerequisites

- Google Chrome or Chromium installed
- `bun` installed (for running scripts)
- First run: log in to X in the opened browser window

## References

- **Regular Posts**: See `references/regular-posts.md` for manual workflow, troubleshooting, and technical details
- **X Articles**: See `references/articles.md` for long-form article publishing guide

---

## Regular Posts

Text + up to 4 images.

```bash
# Preview mode (doesn't post)
npx -y bun ${SKILL_DIR}/scripts/x-browser.ts "Hello from Claude!" --image ./screenshot.png

# Actually post
npx -y bun ${SKILL_DIR}/scripts/x-browser.ts "Hello!" --image ./photo.png --submit
```

> **Note**: `${SKILL_DIR}` represents this skill's installation directory. Agent replaces with actual path at runtime.

**Parameters**:
| Parameter | Description |
|-----------|-------------|
| `<text>` | Post content (positional argument) |
| `--image <path>` | Image file path (can be repeated, max 4) |
| `--submit` | Actually post (default: preview only) |
| `--profile <dir>` | Custom Chrome profile directory |

---

## X Articles

Long-form Markdown articles (requires X Premium).

```bash
# Preview mode
npx -y bun ${SKILL_DIR}/scripts/x-article.ts article.md

# With cover image
npx -y bun ${SKILL_DIR}/scripts/x-article.ts article.md --cover ./cover.jpg

# Publish
npx -y bun ${SKILL_DIR}/scripts/x-article.ts article.md --submit
```

**Parameters**:
| Parameter | Description |
|-----------|-------------|
| `<markdown>` | Markdown file path (positional argument) |
| `--cover <path>` | Cover image path |
| `--title <text>` | Override article title |
| `--submit` | Actually publish (default: preview only) |

**Frontmatter** (optional):
```yaml
---
title: My Article Title
cover_image: /path/to/cover.jpg
---
```

---

## Notes

- First run requires manual login (session is saved)
- Always preview before using `--submit`
- Browser closes automatically after operation
- Supports macOS, Linux, and Windows

---
name: baoyu-post-to-wechat
description: Post content to WeChat Official Account (微信公众号). Supports both article posting (文章) and image-text posting (图文).
---

# Post to WeChat Official Account (微信公众号)

Post content to WeChat Official Account using Chrome CDP automation.

## Script Directory

**Important**: All scripts are located in the `scripts/` subdirectory of this skill.

**Agent Execution Instructions**:
1. Determine this SKILL.md file's directory path as `SKILL_DIR`
2. Script path = `${SKILL_DIR}/scripts/<script-name>.ts`
3. Replace all `${SKILL_DIR}` in this document with the actual path

**Script Reference**:
| Script | Purpose |
|--------|---------|
| `scripts/wechat-browser.ts` | Image-text posts (图文) |
| `scripts/wechat-article.ts` | Full article posting (文章) |
| `scripts/md-to-wechat.ts` | Markdown → WeChat HTML conversion |
| `scripts/copy-to-clipboard.ts` | Copy content to clipboard |
| `scripts/paste-from-clipboard.ts` | Send real paste keystroke |

## Quick Usage

### Image-Text (图文) - Multiple images with title/content

```bash
# From markdown file and image directory
npx -y bun ${SKILL_DIR}/scripts/wechat-browser.ts --markdown article.md --images ./images/

# With explicit parameters
npx -y bun ${SKILL_DIR}/scripts/wechat-browser.ts --title "标题" --content "内容" --image img1.png --image img2.png --submit
```

### Article (文章) - Full markdown with formatting

```bash
# Post markdown article
npx -y bun ${SKILL_DIR}/scripts/wechat-article.ts --markdown article.md --theme grace
```

> **Note**: `${SKILL_DIR}` represents this skill's installation directory. Agent replaces with actual path at runtime.

## References

- **Image-Text Posting**: See `references/image-text-posting.md` for detailed image-text posting guide
- **Article Posting**: See `references/article-posting.md` for detailed article posting guide

## Prerequisites

- Google Chrome installed
- `bun` runtime (via `npx -y bun`)
- First run: log in to WeChat Official Account in the opened browser window

## Features

| Feature | Image-Text | Article |
|---------|------------|---------|
| Multiple images | ✓ (up to 9) | ✓ (inline) |
| Markdown support | Title/content extraction | Full formatting |
| Auto title compression | ✓ (to 20 chars) | ✗ |
| Content compression | ✓ (to 1000 chars) | ✗ |
| Themes | ✗ | ✓ (default, grace, simple) |

## Troubleshooting

- **Not logged in**: First run opens browser - scan QR code to log in, session is preserved
- **Chrome not found**: Set `WECHAT_BROWSER_CHROME_PATH` environment variable
- **Paste fails**: Check system clipboard permissions

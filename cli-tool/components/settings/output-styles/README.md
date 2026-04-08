# Output Styles

Response formatting styles that control how Claude Code structures its output.
Place one of these files in `.claude/settings/` or reference it from your
CLAUDE.md to change how Claude responds.

## Installation

Copy the style you want to your project's `.claude/` directory:

```bash
# Copy to your project
mkdir -p .claude
cp genui.md .claude/output-style.md

# Reference it in CLAUDE.md
echo "See .claude/output-style.md for response formatting rules." >> CLAUDE.md
```

## Available Styles

| File | Style | Best For |
|------|-------|----------|
| `genui.md` | Self-contained HTML with embedded CSS, opened in browser | Rich visual output, shareable reports |
| `ultra-concise.md` | Minimum words, direct actions only | Fast iteration, experienced users |
| `observable-tools-diffs.md` | Tool calls listed + git diff summaries | Transparency, code review |
| `tts-summary.md` | Audio announcements of task completion via TTS | Hands-free workflows |
| `bullet-points.md` | Hierarchical bullets for quick scanning | Structured information |
| `table-based.md` | Markdown tables for comparisons and data | Organized data presentation |
| `yaml-structured.md` | Hierarchical key-value YAML format | Structured, parseable output |
| `html-structured.md` | Semantic HTML5 output | Web content generation |
| `markdown-focused.md` | Full markdown with headers, lists, code | Documentation, README writing |

## Highlights

**GenUI** is the most distinctive style. It generates complete, self-contained HTML
documents with embedded modern CSS styling, saves them to /tmp/, and opens them in
your browser. Great for architecture diagrams, code explanations, and analysis reports.

**Ultra Concise** is ideal for power users who want maximum speed with zero filler.

**Observable Tools + Diffs** provides full transparency into what tools were used
and what code changed, formatted as TypeScript interface calls + git diffs.

Source: https://github.com/CodeWithBehnam/cc-docs

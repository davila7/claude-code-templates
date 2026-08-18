---
title: "Publish Blog Article"
summary: "How to produce a component blog article with a generated cover, copied HTML template, catalog entry, verification, and recovery steps."
topics: [guides, catalog]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: blog-command
    type: file
    path: .claude/commands/create-blog-article.md
  - id: blog-writing-guide
    type: file
    path: cli-tool/docs_to_claude/BLOG_WRITING_GUIDE.md
  - id: blog-readme
    type: file
    path: docs/blog/README.md
  - id: image-generator
    type: file
    path: scripts/generate_blog_images.py
  - id: image-generator-v2
    type: file
    path: scripts/generate_blog_images_v2.py
  - id: article-index
    type: file
    path: docs/blog/blog-articles.json
  - id: article-template
    type: file
    path: docs/blog/code-reviewer-agent/index.html
---

# Publish Blog Article

This guide is the durable path for adding a blog article to the static blog. The coverage map assigns this page to blog article production, cover images, HTML output, and blog index updates, with the blog command, writing guide, blog README, image scripts, and blog assets as evidence [@coverage-entry].

## Successful outcome

A successful article has a generated cover image under `docs/blog/assets/`, an article page under `docs/blog/<blog-id>/index.html`, a complete `docs/blog/blog-articles.json` entry, unchanged shared template structure, and working relative links. The component-blog command explicitly treats those files as the expected output and says the article should be ready to commit and deploy after verification [@blog-command].

## Preconditions

Start from a real component path, not only a title. The blog command expects a component argument such as an agent, MCP, skill, command, or hook path, then locates the actual file and extracts the name, description, tools, capabilities, and folder/name structure [@blog-command].

Use the stricter component-blog command as the current process. The older blog writing guide is useful for general SEO and HTML structure, but the command now requires copying `docs/blog/code-reviewer-agent/index.html` exactly and replacing only the content-specific sections [@blog-command] [@blog-writing-guide].

## Ordered work

1. Identify the component type and source file. The command maps agents to `cli-tool/components/agents/<path>.md`, MCPs to `cli-tool/components/mcps/<path>.json`, skills to `cli-tool/components/skills/<path>/SKILL.md`, commands to `cli-tool/components/commands/<path>.md`, and hooks to `cli-tool/components/hooks/<path>.md` [@blog-command].

2. Derive the blog id and display names. The command uses blog ids such as `frontend-developer-agent`, `supabase-mcp`, and `nowait-skill`, plus an uppercase component type such as `AGENT`, `MCP`, `SKILL`, `COMMAND`, or `HOOK` [@blog-command].

3. Generate the cover image before writing the final HTML. The command says to temporarily add the article to `docs/blog/blog-articles.json`, run `python3 scripts/generate_blog_images.py`, and let the script create `docs/blog/assets/<blog-id>-cover.png` [@blog-command]. The generator reads the blog index, looks for article images hosted under `aitmpl.com/blog/assets/`, skips existing cover files, and requires `GOOGLE_API_KEY` from the environment or `.env` [@image-generator].

4. Copy the template before editing content. The command says to read `docs/blog/code-reviewer-agent/index.html`, copy the whole file to `docs/blog/<blog-id>/index.html`, and replace only SEO metadata, title and subtitle, tags, main article content, cover image source, and alt text [@blog-command]. The template already contains the shared header, favicon links, analytics tags, structured data, article layout, and navigation pattern [@article-template].

5. Preserve required scripts and page structure. The command says not to remove or duplicate the CodeCopy script, MarkdownCopier script, or Mermaid script, and it requires the article structure `article-header` to `article-body` to `article-content-full` [@blog-command].

6. Add a Mermaid diagram and component-specific usage examples. The command places a short Mermaid diagram after the "What is..." section and requires installation commands that use the full folder/name structure for agents, MCPs, commands, skills, and hooks [@blog-command].

7. Update `docs/blog/blog-articles.json`. The current article index is an `articles` array with fields such as `id`, `title`, `description`, `url`, `image`, `category`, `readTime`, `tags`, `difficulty`, `featured`, and `order` [@article-index]. The README also documents field meanings, difficulty levels, ordering, dynamic loading, local testing, and JSON troubleshooting [@blog-readme].

## Verification

Verify the file layout first: cover image in `docs/blog/assets/`, article HTML in `docs/blog/<blog-id>/index.html`, and the blog index updated with the same id and image path [@blog-command]. Then confirm the copied article still has `class="header"`, the `copy-markdown-btn`, the full footer, and all three required scripts [@blog-command].

Verify SEO and article content next. The command requires "Claude Code" in the title tag, meta description, H1, first paragraph, keywords, tags, and structured data; it also requires all Claude documentation URLs to include `?utm_source=aitmpl&utm_medium=referral&utm_campaign=blog` [@blog-command].

Test locally from `docs/blog` when the JSON or article routing changed. The blog README suggests `python -m http.server 8000` or `npx http-server`, then opening `http://localhost:8000` [@blog-readme].

## Recovery notes

If image generation fails, check `GOOGLE_API_KEY`, the temporary `blog-articles.json` entry, and whether `scripts/generate_blog_images.py` exists, because those are the command's named failure points [@blog-command]. `generate_blog_images_v2.py` is a separate experimental Gemini image script with a fixed `BLOGS` list and a test output path, so it is not a drop-in replacement for the indexed article workflow [@image-generator-v2].

If articles disappear from the blog page, validate `docs/blog/blog-articles.json` first. The README notes that invalid JSON, missing commas, bad image URLs, or missing `/docs/blog/assets/` files are common causes of broken blog loading [@blog-readme].

---
name: blog-writer
description: >
  Use this agent to create blog articles for aitmpl.com. 
  Reads the component, asks for confirmation, generates SVG cover, 
  HTML article, and updates blog-articles.json.
examples:
  - context: User wants a blog for a component.
    user: Create a blog article for cli-tool/components/hooks/security/secret-scanner.json
    assistant: I'll use the blog-writer agent to create the full blog article.
    commentary: The user wants a blog article from a component; use blog-writer for the full pipeline.
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Blog Writer Agent

## Agent Self-Validation
Before finalizing the article, perform a quick check:
1. Are all file paths (CSS, Assets) relative to `docs/blog/{article-id}/`?
2. Did you use `../assets/` for the image path?
3. Does the "Installation" section appear immediately after the header?
4. Are you using standard `<table>` tags for component parameters?

## Workflow
1. **Analyze Component**: Read the provided component file and summarize its core functionality and benefits.
2. **Setup**: Create a new folder in `docs/blog/{article-id}`.
3. **Asset Generation**: Generate the SVG cover image based on the component's theme.
4. **Content Generation**: Create the HTML article. Follow the established site template strictly.
5. **Update Catalog**: Append the new article metadata to `blog-articles.json`.
6. **Review**: Validate the links and ensure all paths are correct.

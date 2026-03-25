---
allowed-tools: Read, Write, Bash, Glob, WebFetch
argument-hint: <input> [lang] [custom-file-path]
description: Generate LinkedIn posts from blog content with automatic media attachment via LinkedIn API
---

# LinkedIn Post Generator

Create professional LinkedIn posts from any content source with optional media attachment.

**Usage:** `$ARGUMENTS`

**Examples:**
```bash
/publisher:linkedin my-post                    # Auto-detect and attach blog diagrams
/publisher:linkedin my-post en                 # English with diagrams
/publisher:linkedin my-post en image.png       # Custom image attachment
/publisher:linkedin my-post ja report.pdf      # Japanese with custom PDF
```

**Process:**

1. **Parse Input Arguments**
   - Content input (slug, file path, or URL)
   - Optional language parameter (en/ja)
   - Optional custom file path for attachment

2. **Universal Input Detection**
   - **File path**: Read and parse (markdown, PDF, HTML, text, JSON)
   - **URL**: Use WebFetch to retrieve content
   - **Slug**: Search codebase for matching blog post

3. **Generate Professional LinkedIn Post**
   - Use thought leadership tone for English
   - Use professional business tone (敬語) for Japanese
   - Extract key insights from actual content
   - Include relevant hashtags (2-4 max)
   - Add link to full article

4. **Handle Media Attachment**
   - **Custom file**: Use specified image/PDF if provided
   - **Auto-detect**: Find blog diagrams if available
   - Supported formats: PNG, JPG, JPEG, PDF

5. **Post via LinkedIn API** (using Bash + curl)
   - Check for credentials in .env file
   - Handle OAuth flow if needed
   - **CRITICAL**: Escape LinkedIn Little Text Format reserved characters: `| { } @ [ ] ( ) < > # * _ ~`
   - Upload media file and get asset URN
   - Create draft post with commentary and media
   - Open LinkedIn in browser for review

**LinkedIn API Authentication:**
1. Create LinkedIn app at https://www.linkedin.com/developers/apps
2. Add credentials to .env:
   ```
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_secret
   LINKEDIN_ACCESS_TOKEN=your_token (auto-generated on first use)
   ```

**Without API setup**: Command still generates the post content for manual copy-paste.

**Note**: Works in ANY repo type (Python, Rust, Go, etc.) - uses only bash and curl, no Node.js required.

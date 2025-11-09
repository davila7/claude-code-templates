---
allowed-tools: Read, Write, Bash, Glob, WebFetch
argument-hint: <input> [lang]
description: Generate copy-pastable X/Twitter threads from blog posts, articles, PDFs, or URLs with 3 format options
---

# X/Twitter Thread Generator

Generate a copy-pastable X thread from any content source - blog posts, articles, PDFs, URLs, or plain text.

**Usage:** `$ARGUMENTS`

**Process:**

1. **Parse Input Arguments**
   - Extract content input and optional language parameter
   - Examples:
     - `2025-10-06-my-post` (slug only, default English)
     - `2025-10-06-my-post ja` (slug with Japanese)
     - `path/to/article.md` (file path)
     - `https://myblog.com/post` (URL)
     - `docs/whitepaper.pdf en` (PDF with language)

2. **Universal Input Detection**

   **If input looks like a file path** (contains `/` or file extension):
   - Use Read tool to check if file exists
   - Detect format by extension:
     - `.md` / `.mdx` → Parse markdown with frontmatter (extract title, description, body, metadata)
     - `.pdf` → Inform user PDF parsing is limited, suggest converting to markdown first
     - `.docx` → Inform user DOCX parsing is limited, suggest converting to markdown first
     - `.html` → Read and extract main content, strip HTML tags
     - `.txt` → Read as plain text
     - `.json` → Parse JSON and extract relevant fields
   - Extract: title, description, body content, metadata

   **If input looks like a URL** (starts with `http://` or `https://`):
   - Use WebFetch tool to retrieve the page
   - Prompt: "Extract the main article content, title, and description from this page"
   - Parse and clean the text

   **If input is a slug** (no `/` and no protocol):
   - Search codebase using Glob: `**/*${input}*.md`
   - Common patterns to check:
     - `src/content/blog/posts/{en,ja}/*${input}*.md`
     - `content/blog/*${input}*.md`
     - `posts/*${input}*.md`
     - `blog/*${input}*.md`
   - If language specified, prioritize matching language folder
   - Use Read tool to parse markdown file with frontmatter

3. **Determine Language** (default: English):
   - If user explicitly specifies "ja" → Japanese
   - If user explicitly specifies "en" → English
   - If file path contains `/ja/` → Japanese
   - If content appears to be in Japanese → Japanese
   - Otherwise → English

4. **Generate THREE versions** in the target language:

   **Version 1: Thread (5-8 posts)**
   - Professional and engaging tone
   - Break into digestible posts (max 280 chars each)

   **Version 2: Single Long (Premium)**
   - Structured format with clear sections
   - **For Japanese**: Use 【brackets】: 【とは】【誰のため】【主な特徴】【次にすべきこと】
   - **For English**: Use headers: **What it is:** **Who it's for:** **Key features:** **What to do next:**

   **Version 3: Single Short (~280 chars)**
   - Concise announcement
   - 2-3 key benefits with emojis
   - Links and hashtags

5. **Display all versions** to the user in terminal:
   - Show thread posts with character counts
   - Show single long version
   - Show single short version
   - Format for easy copy-pasting

6. **Create tri-format HTML preview file** using Write tool:
   - **IMPORTANT**: Check if file exists first: `ls -la x-thread-[LANG].html 2>&1`
   - If file exists, use Read tool first (even just 1 line): `Read('x-thread-[LANG].html', limit=1)`
   - Then use Write tool to create/update: `x-thread-[LANG].html` in user's current directory
   - **Include THREE tabs with tab switcher UI**:
     - **Tab 1: Thread** - 5-8 posts with individual "Copy Post" buttons
     - **Tab 2: Single Long** - Structured format with sections, one "Copy" button
     - **Tab 3: Single Short** - Concise version (~280 chars), one "Copy" button
   - Use X branding (black theme)
   - Tab switcher at top for easy navigation
   - Use Bash tool to open: `open x-thread-[LANG].html && open https://x.com/compose/post`

---

## X Thread Guidelines

### Thread Structure (5-8 tweets):

1. **Hook Tweet** (Tweet 1/X)
   - Grab attention with a contrarian statement, stat, or bold claim
   - Don't give away everything - create curiosity
   - NO hashtags or links in first tweet (better algorithm reach)
   - Max 280 chars including thread indicator

2. **Problem/Context Tweets** (Tweets 2-3/X)
   - Set up the problem or context
   - Use specific data points from the blog
   - Keep each tweet to ONE idea
   - Max 280 chars each

3. **Insight Tweets** (Tweets 4-6/X)
   - Share 3-5 key insights from the blog
   - Use bullet points (•) or numbered lists
   - Include specific examples or stats
   - Make each tweet self-contained
   - Max 280 chars each

4. **CTA Tweet** (Final tweet)
   - Link to the full article
   - Simple CTA: "Read the full guide:" or "Full breakdown:"
   - Can include 2-3 relevant hashtags here
   - Encourage engagement: "What's your take?"

**Thread Numbering:**
- Include "(1/6)" style numbering in EVERY tweet
- Count MUST be accurate
- Place at the end of each tweet

**Character Limits:**
- Each post: MAX 280 characters (including thread number)
- Account for URL shortening: URLs = 23 chars on X
- Leave buffer of 10-15 chars for safety

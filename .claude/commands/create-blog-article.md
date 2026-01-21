---
allowed-tools: Read, Write, Edit, Bash(python3:*), Bash(mkdir:*), Bash(rm:*)
argument-hint: <component-path>
description: Create an SEO-optimized blog article for a Claude Code component with AI-generated cover image
---

# Create Blog Article for Claude Code Component

You will create a complete, SEO-optimized blog article for a Claude Code component.

## Component Path Argument

Component path provided: **$ARGUMENTS**

Expected format examples:
- `development-team/frontend-developer` (for agents)
- `supabase` (for MCPs)
- `productivity/nowait` (for skills)

## Step 1: Identify Component Type and Read Component File

Based on the path structure, determine the component type:
- If path has `/`, could be an agent, MCP, command, skill, or hook in a folder
- Single word could be MCP, command, or skill

Read the component file:
- Agents: `cli-tool/components/agents/$ARGUMENTS.md` (e.g., `development-team/frontend-developer.md`)
- MCPs: `cli-tool/components/mcps/$ARGUMENTS.json` (e.g., `devtools/context7.json`)
- Skills: `cli-tool/components/skills/$ARGUMENTS/SKILL.md`
- Commands: `cli-tool/components/commands/$ARGUMENTS.md` (e.g., `setup/ci-cd-pipeline.md`)
- Hooks: `cli-tool/components/hooks/$ARGUMENTS.md`

**CRITICAL:** Use `find` or `grep` to locate the actual file path first, then extract folder/name structure.

Extract from the component file:
- `name`: Component name
- `description`: Component description
- `tools`: Available tools (for agents)
- Key capabilities and focus areas from the content

## Step 2: Generate Component-Specific Blog ID and Names

From the component path, create:
- **Blog ID**: Convert path to blog-friendly ID
  - Example: `development-team/frontend-developer` → `frontend-developer-agent`
  - Example: `supabase` → `supabase-mcp`
  - Example: `productivity/nowait` → `nowait-skill`

- **Component Name**: Human-readable name
  - Example: `frontend-developer` → `Frontend Developer`
  - Example: `supabase` → `Supabase`

- **Component Type**: Uppercase type
  - AGENT, MCP, SKILL, COMMAND, HOOK

## Step 3: Generate Cover Image FIRST

**CRITICAL**: Generate the cover image BEFORE creating the HTML file.

Use the Python script to generate the image:

```bash
python3 scripts/generate_blog_images.py
```

But first, temporarily add a new entry to `docs/blog/blog-articles.json` with:
```json
{
  "id": "[blog-id]",
  "title": "Temporary",
  "description": "Temporary",
  "url": "[blog-id]/",
  "image": "https://www.aitmpl.com/blog/assets/[blog-id]-cover.png",
  "category": "[Component Type]",
  "publishDate": "2025-01-15",
  "readTime": "4 min read",
  "tags": ["Claude Code"],
  "difficulty": "basic",
  "featured": true,
  "order": 999
}
```

Then run the script, which will:
1. Detect the new entry
2. Find the component path
3. Generate the image at `docs/blog/assets/[blog-id]-cover.png`

After image generation, update the entry with correct information.

## Step 4: Create Blog Article HTML

Create directory:
```bash
mkdir -p docs/blog/[blog-id]
```

**CRITICAL PROCESS:**

1. **First, READ the template file completely:**
   ```bash
   Read docs/blog/code-reviewer-agent/index.html
   ```

2. **Copy the ENTIRE content** to the new file location:
   ```bash
   Write docs/blog/[blog-id]/index.html
   ```

3. **Then, ONLY replace the specific content sections** (listed below)

**DO NOT:**
- ❌ Create HTML from scratch
- ❌ Use a different template
- ❌ Simplify or remove any scripts
- ❌ Change the header/footer structure
- ❌ Modify CSS paths or class names

Create `docs/blog/[blog-id]/index.html` using this process:

### HTML Template Structure

**CRITICAL**: Use `docs/blog/code-reviewer-agent/index.html` as the EXACT base template.

This template includes ALL required components:
- ✅ Header with `class="header"` (NOT "blog-header")
- ✅ ASCII art logo in terminal-header
- ✅ Copy as Markdown button (`id="copy-markdown-btn"`)
- ✅ Proper article structure: `article-header` → `article-body` → `article-content-full`
- ✅ "Explore Components" banner at the end of content
- ✅ Footer with ASCII art and links
- ✅ CodeCopy script (adds copy buttons to code blocks)
- ✅ MarkdownCopier script (copy entire article as markdown)
- ✅ Mermaid diagram support script

**DO NOT create custom HTML structure** - copy the template EXACTLY and only replace the content-specific parts.

#### How to Use the Template:

1. **Copy the entire file** from `code-reviewer-agent/index.html`
2. **Only replace these specific content areas**:
   - SEO meta tags (title, description, keywords, Open Graph)
   - Article title and subtitle in `<h1>` and `<p class="article-subtitle">`
   - Tags in `<div class="article-tags">`
   - Main content inside `<div class="article-content-full">` (everything between the opening and closing div)
   - Cover image src and alt text
3. **Keep EVERYTHING else unchanged**:
   - Header structure and navigation
   - Copy Markdown button
   - Footer with ASCII art
   - All three scripts at the end (CodeCopy, MarkdownCopier, Mermaid)
   - CSS links and paths

#### Key SEO Elements to Customize:

**Title Tag** (Line 6):
```html
<title>[Component Name] for Claude Code: [Key Technologies] Expert AI Assistant</title>
```

**Meta Description** (Line 26):
```html
<meta name="description" content="Install the [Component Name] for Claude Code to [main benefit]. AI-powered [component type] for [key features].">
```

**Open Graph Tags** (Lines 28-32):
```html
<meta property="og:title" content="[Component Name] for Claude Code: [Key Technologies]">
<meta property="og:description" content="Install the [Component Name] for Claude Code...">
```

**Keywords** (Line 58):
Focus on: Claude Code, Component Type, Main Technologies
```html
<meta name="keywords" content="Claude Code [type], [Component Name], Claude Code [tech1], [tech2], AI [domain] development, ...">
```

**Structured Data** (Lines 81-136):
```json
{
  "@type": "BlogPosting",
  "headline": "[Component Name] for Claude Code: [Technologies]",
  "keywords": "Claude Code [type], [Component Name], ...",
  "articleSection": "Claude Code [Type]s",
  "about": [
    {"@type": "Thing", "name": "Claude Code"},
    {"@type": "Thing", "name": "[Component Type]"},
    ...
  ]
}
```

**Article Header** (Lines 189-201):
```html
<h1 class="article-title">[Component Name] for Claude Code: [Technologies]</h1>
<p class="article-subtitle">Learn how to install and use the [Component Name] for Claude Code to [benefits].</p>
<div class="article-tags">
  <span class="tag">Claude Code</span>
  <span class="tag">[Type]</span>
  <span class="tag">[Tech1]</span>
  <span class="tag">[Tech2]</span>
</div>
```

#### Content Sections:

**What is the [Component Name]?** (Lines 210-212):
- Brief 2-3 sentence overview
- Focus on what it does and key benefits
- Mention Claude Code and component type

**Mermaid Diagram** (After "What is..." section):
Add a simple Mermaid flow diagram (3-4 nodes max):

```html
<!-- Mermaid Diagram -->
<div class="mermaid-diagram" style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 2rem; margin: 2rem 0; text-align: center;">
    <pre class="mermaid">
graph LR
    A[Input/Trigger] --> B[Component Name]
    B --> C[Process/Output]
    C --> D[Result]

    style B fill:#F97316,stroke:#fff,color:#000
    </pre>
</div>
```

**Diagram examples by type:**
- **Agents**: `[👤 User Prompt] --> [🤖 Agent Name] --> [⚛️ Code Output] --> [📦 Your Project]`
- **MCPs**: `[💻 Claude Code] --> [🔌 MCP Name] --> [📚 Data/Docs] --> [✨ Result]`
- **Skills**: `[👤 User Request] --> [🔍 Skill Auto-Triggered] --> [📚 Progressive Loading] --> [✅ Task Complete]`
- **Commands**: `[⚙️ Command Call] --> [🔧 Command Logic] --> [📝 Action] --> [✓ Complete]`
- **Hooks**: `[📝 Event] --> [🪝 Hook Name] --> [⚡ Automation] --> [✅ Done]`

**IMPORTANT**:
- Avoid using special characters like `/` or `\` inside Mermaid node labels as they cause syntax errors
- **Skills are NOT slash commands** - they activate automatically when relevant to the user's request

**Key Capabilities** (Lines 214-223):
- Bullet list of 5-7 main capabilities
- Each capability with brief explanation in parentheses

**Installation** (Lines 225-241):
```html
<h2>Installation</h2>
<p>Install the [Component Name] using the Claude Code Templates CLI:</p>
<pre><code class="language-bash">npx claude-code-templates@latest --[type] [folder/name]</code></pre>

<p><strong>Where is the [type] installed?</strong></p>
<p>The [type] is saved in <code>.claude/[type]s/[name].[extension]</code> in your project directory:</p>

<pre><code class="language-bash">your-project/
├── .claude/
│   └── [type]s/
│       └── [name].[md|json]    # ← [Type] installed here
├── src/
│   └── components/
├── package.json
└── README.md</code></pre>
```

**CRITICAL INSTALLATION COMMAND FORMAT:**
- Agents: `--agent folder/name` (e.g., `--agent development-team/frontend-developer`)
- MCPs: `--mcp folder/name` (e.g., `--mcp devtools/context7`)
- Commands: `--command folder/name` (e.g., `--command setup/ci-cd`)
- Skills: `--skill name` (e.g., `--skill pdf-processing`)
- Hooks: `--hook folder/name` (e.g., `--hook git/auto-commit`)

**ALWAYS use the FULL path with folder/** - Use `find` command to verify the correct path first!

**How to Use** (Lines 243-251):
```html
<h2>How to Use the [Type]</h2>
<p>Start Claude Code and explicitly request the [type] in your prompt:</p>

<pre><code class="language-bash"># Start Claude Code
claude

# Then write your prompt requesting the [type]
> Use the [name] [type] to [example task]</code></pre>
```

**Usage Examples** (Lines 253-277):
Create 3 practical examples:
```html
<h3>Example 1: [Specific Use Case]</h3>
<pre><code class="language-bash">claude

> Use the [name] [type] to [specific task with details]</code></pre>

<p><strong>Result:</strong> [Expected outcome]</p>
```

**Official Documentation** (Lines 276-277):
```html
<h2>Official Documentation</h2>
<p>For more information about [type]s in Claude Code, see the <a href="https://code.claude.com/docs/en/[appropriate-doc-page]?utm_source=aitmpl&utm_medium=referral&utm_campaign=blog" target="_blank">official documentation</a>.</p>
```

**CRITICAL:** All URLs to claude.com documentation MUST include UTM parameters: `?utm_source=aitmpl&utm_medium=referral&utm_campaign=blog`

#### Critical Path Requirements:

1. **Image path** (Line 207): `../assets/[blog-id]-cover.png`
2. **CSS paths** (Lines 62-63): `../../css/styles.css`, `../../css/blog.css`
3. **Navigation links**: `../index.html` for blog home, `../../index.html` for main site

## Step 5: Update blog-articles.json

Update the temporary entry in `docs/blog/blog-articles.json` with complete information:

```json
{
  "id": "[blog-id]",
  "title": "[Component Name] for Claude Code: [Subtitle with Technologies]",
  "description": "Complete guide to the [Component Name] - [what it does]. [Key benefits]. [Installation count if available]+ installations.",
  "url": "[blog-id]/",
  "image": "assets/[blog-id]-cover.png",
  "category": "[Component Type Category]",
  "publishDate": "[Current Date YYYY-MM-DD]",
  "readTime": "4 min read",
  "tags": ["Claude Code", "[Type]", "[Tech1]", "[Tech2]", "[Tech3]"],
  "difficulty": "basic|intermediate|advanced",
  "featured": true,
  "order": [next available order number]
}
```

**Category Guidelines**:
- Agents → "Agents"
- MCPs → "MCP"
- Skills → "Skills"
- Commands → "Development" or specific category
- Hooks → "Automation"

**Difficulty Guidelines**:
- basic: Simple to use, no configuration needed
- intermediate: Requires some setup or understanding
- advanced: Complex workflows or configuration

**Scripts at End of HTML**:

The template already includes ALL required scripts before `</body>`:

1. **CodeCopy script** (~180 lines) - Adds copy buttons to code blocks
2. **MarkdownCopier script** (~160 lines) - Copy article as Markdown functionality
3. **Mermaid script** (~15 lines) - Diagram rendering support

**CRITICAL**: These scripts are ALREADY in the template. DO NOT:
- ❌ Remove them
- ❌ Modify them
- ❌ Duplicate them
- ❌ Create simplified versions

If you copy the template correctly, these scripts will already be present and working.

## Step 6: Final Checklist

Verify before completion:

**Files & Structure:**
- [ ] Cover image exists at `docs/blog/assets/[blog-id]-cover.png`
- [ ] Blog article exists at `docs/blog/[blog-id]/index.html`
- [ ] HTML file copied from `code-reviewer-agent/index.html` template
- [ ] Header has `class="header"` (NOT "blog-header")
- [ ] Copy Markdown button present with `id="copy-markdown-btn"`
- [ ] Article structure: `article-header` → `article-body` → `article-content-full`
- [ ] "Explore Components" banner present at end of content
- [ ] Footer with ASCII art and links present

**Scripts (verify all 3 are present):**
- [ ] CodeCopy script present (~180 lines before Mermaid)
- [ ] MarkdownCopier script present (~160 lines before Mermaid)
- [ ] Mermaid script present (last script before `</body>`)

**Content:**
- [ ] Mermaid diagram added after "What is..." section
- [ ] All paths are relative (images, CSS, links)
- [ ] Installation command shows correct folder/name structure
- [ ] File tree shows correct installation path
- [ ] SEO meta tags include "Claude Code" prominently
- [ ] Keywords focus on: Claude Code > Component Type > Technologies
- [ ] Structured data includes all required fields
- [ ] blog-articles.json updated with new entry
- [ ] All tags include "Claude Code" as first tag
- [ ] Examples are specific to the component's capabilities
- [ ] All claude.com URLs include UTM parameters

## SEO Optimization Requirements

Every blog article MUST:

1. **Title Tag**: Include "Claude Code", component name, and 1-2 key technologies
2. **Meta Description**: Start with action verb, mention Claude Code, include key benefit
3. **Keywords**: First 3 keywords should be "Claude Code [type]", "[Component Name]", "Claude Code [main-tech]"
4. **H1**: Match title tag structure
5. **First Paragraph**: Mention "Claude Code" in first sentence
6. **Tags**: Always start with "Claude Code" tag
7. **Structured Data**: Include Claude Code as both Thing and SoftwareApplication

## Error Handling

If component file not found:
- Try alternative paths (with/without folders)
- Check component type variations
- Ask user to verify component path

If image generation fails:
- Check if GOOGLE_API_KEY is set
- Verify blog-articles.json entry
- Check scripts/generate_blog_images.py exists

## Success Message

When complete, show:
```
✅ Blog article created successfully!

📁 Files created:
   - docs/blog/[blog-id]/index.html
   - docs/blog/assets/[blog-id]-cover.png

📝 Updated:
   - docs/blog/blog-articles.json

🔗 View locally:
   http://localhost:8000/blog/[blog-id]/

🚀 Ready to commit and deploy!
```

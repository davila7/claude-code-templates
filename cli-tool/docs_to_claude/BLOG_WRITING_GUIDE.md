# Blog Writing Guide - Claude Code Templates

This guide provides a comprehensive template for creating consistent, SEO-optimized blog articles for Claude Code Templates. Use this structure for articles about technologies, companies, or trends related to Claude Code integration.

## 📁 File Structure

```
docs/blog/
├── index.html                              # Blog homepage
├── assets/                                 # Shared blog assets
│   ├── [technology]-claude-code-templates-cover.png
│   └── aitmpl-[technology]-search.png
├── [technology-name]-claude-code-integration/
│   ├── index.html                          # Article page
│   └── cover.jpg                          # Article cover image (1200x630)
└── code-copy.js                           # Copy functionality script
```

## 🏗️ HTML Structure Template

### Basic HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Technology] and Claude Code Integration</title>
    <meta name="description" content="Learn how to integrate [Technology] with Claude Code using MCP servers, specialized agents, and automated commands for lightning-fast [domain] development.">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://davila7.github.io/claude-code-templates/blog/[slug]/">
    <meta property="og:title" content="[Technology] and Claude Code Integration">
    <meta property="og:description" content="Learn how to integrate [Technology] with Claude Code...">
    <meta property="og:image" content="https://davila7.github.io/claude-code-templates/blog/[slug]/cover.jpg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="article:published_time" content="[ISO_DATE]">
    <meta property="article:author" content="Claude Code Templates">
    <meta property="article:section" content="[Category]">
    <meta property="article:tag" content="[Technology]">
    <meta property="article:tag" content="Claude Code">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://davila7.github.io/claude-code-templates/blog/[slug]/">
    <meta property="twitter:title" content="[Technology] and Claude Code Integration">
    <meta property="twitter:description" content="Learn how to integrate [Technology] with Claude Code...">
    <meta property="twitter:image" content="https://davila7.github.io/claude-code-templates/blog/[slug]/cover.jpg">
    
    <!-- Additional SEO -->
    <meta name="keywords" content="[Technology], Claude Code, MCP, [Domain], AI Development, Anthropic">
    <meta name="author" content="Claude Code Templates">
    <link rel="canonical" href="https://davila7.github.io/claude-code-templates/blog/[slug]/">
    
    <!-- Stylesheets -->
    <link rel="stylesheet" href="../../css/styles.css">
    <link rel="stylesheet" href="../../css/blog.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": "[Technology] and Claude Code Integration",
        "description": "Learn how to integrate [Technology] with Claude Code...",
        "image": "https://davila7.github.io/claude-code-templates/blog/[slug]/cover.jpg",
        "author": {
            "@type": "Organization",
            "name": "Claude Code Templates"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Claude Code Templates",
            "logo": {
                "@type": "ImageObject",
                "url": "https://davila7.github.io/claude-code-templates/static/img/logo.svg"
            }
        },
        "datePublished": "[ISO_DATE]",
        "dateModified": "[ISO_DATE]",
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": "https://davila7.github.io/claude-code-templates/blog/[slug]/"
        }
    }
    </script>
</head>
```

### Header Section

```html
<header class="header">
    <div class="container">
        <div class="header-content">
            <div class="terminal-header">
                <div class="ascii-title">
                    <pre class="ascii-art"> 
██████╗ ██╗      ██████╗  ██████╗ 
██╔══██╗██║     ██╔═══██╗██╔════╝ 
██████╔╝██║     ██║   ██║██║  ███╗
██╔══██╗██║     ██║   ██║██║   ██║
██████╔╝███████╗╚██████╔╝╚██████╔╝
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝</pre>
                </div>
            </div>
            <div class="header-actions">
                <a href="../index.html" class="header-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/>
                    </svg>
                    Home
                </a>
                <a href="../index.html" class="header-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    Blog
                </a>
                <a href="https://github.com/davila7/claude-code-templates" target="_blank" class="header-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12..."/>
                    </svg>
                    GitHub
                </a>
            </div>
        </div>
    </div>
</header>
```

### Article Header

```html
<header class="article-header">
    <div class="container">
        <h1 class="article-title">How to use Claude Code with [Technology]</h1>
        <p class="article-subtitle">Learn how to integrate [Technology] with Claude Code using MCP, Agents, and Commands for faster [domain] development.</p>
        <div class="article-meta-full">
            <time datetime="[YYYY-MM-DD]">[Month DD, YYYY]</time>
            <span class="read-time">[X] min read</span>
            <div class="article-tags">
                <span class="tag">[Technology]</span>
                <span class="tag">[Category]</span>
                <span class="tag">MCP</span>
                <span class="tag">Agents</span>
            </div>
        </div>
    </div>
</header>
```

## 📝 Content Structure

### 1. Hero Image
```html
<img src="../assets/[technology]-claude-code-templates-cover.png" alt="[Technology] and Claude Code Integration" class="article-cover">
```

### 2. Technology Stack Overview
```html
<h2>[Technology] Stack for Claude Code</h2>
<p>Claude Code Templates offers [X] pre-built components for [Technology] integration:</p>
```

### 3. Component Tables

#### Agents Table
```html
<h3>🤖 Agents</h3>
<table class="components-table">
    <thead>
        <tr>
            <th>Component</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>[Agent Name]</strong></td>
            <td>[Detailed description of agent capabilities and use cases]</td>
        </tr>
    </tbody>
</table>
```

#### Commands Table
```html
<h3>⚡ Commands</h3>
<table class="components-table">
    <thead>
        <tr>
            <th>Command</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>[command-name]</strong></td>
            <td>[Command description and functionality]</td>
        </tr>
    </tbody>
</table>
```

#### MCP Table
```html
<h3>🔌 MCP</h3>
<table class="components-table">
    <thead>
        <tr>
            <th>Component</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>🔌 <strong>[Technology] MCP Server</strong></td>
            <td>Direct integration with [Technology] API through Model Context Protocol for seamless Claude Code interaction.</td>
        </tr>
    </tbody>
</table>
```

### 4. AITMPL.com Browse Section
```html
<h2>Browse all components on AITMPL.com</h2>
<p>Before installing, you can explore all available [Technology] components on the official Claude Code Templates website:</p>
<p>Visit <strong><a href="https://aitmpl.com" target="_blank" rel="noopener">aitmpl.com</a></strong> and search for "[technology]" to see:</p>
<img src="../assets/aitmpl-[technology]-search.png" alt="Searching for [Technology] components on AITMPL.com" loading="lazy">
```

### 5. Installation Options

#### Individual Components
```html
<h3>Install Individual Components</h3>
<pre><code class="language-bash">
# Install specific agent
npx claude-code-templates@latest --agent [agent-name]

# Install specific command
npx claude-code-templates@latest --command [command-name]

# Install MCP server
npx claude-code-templates@latest --mcp [technology]</code></pre>

<p><strong>Components will be installed to:</strong></p>
<ul>
    <li>📁 <code>.claude/commands/</code></li>
    <li>📁 <code>.claude/agents/</code></li>
    <li>📁 <code>.mcp.json</code></li>
</ul>
```

#### Global Agents
```html
<h3>Create Global Agents (Available Anywhere)</h3>
<pre><code class="language-bash"># Create global agents accessible from any project
npx claude-code-templates@latest --create-agent [agent-name]

# List all global agents
npx claude-code-templates@latest --list-agents

# Update global agents
npx claude-code-templates@latest --update-agent [agent-name]

# Remove global agents  
npx claude-code-templates@latest --remove-agent [agent-name]</code></pre>
```

#### Multiple Components
```html
<h3>Install Multiple Components at Once</h3>
<pre><code class="language-bash">
# Install specific commands (comma-separated for multiple)
npx claude-code-templates@latest --command [command1],[command2],[command3]
</code></pre>

<pre><code class="language-bash">
# Install all [Technology] components in one command
npx claude-code-templates@latest \
  --command [all-commands-comma-separated] \
  --agent [all-agents-comma-separated] \
  --mcp [technology]</code></pre>

<p><strong>This will install:</strong></p>
<ul>
    <li>✓ [X] [domain] commands</li>
    <li>✓ [X] specialized AI agents</li>
    <li>✓ 1 MCP server integration</li>
    <li>✓ Complete documentation</li>
</ul>
```

#### Execute Prompt After Installation
```html
<h3>Execute Prompt After Installation</h3>
<pre><code class="language-bash"># Install components and run a prompt immediately
npx claude-code-templates@latest \
  --command [primary-command] \
  --prompt "[Sample prompt for the technology]"</code></pre>
```

### 6. File Structure
```html
<h2>Where Components Are Installed</h2>
<p>The installation creates a standard Claude Code structure with components organized as follows:</p>

<pre><code class="language-bash">your-project/
├── .claude/
│   ├── commands/
│   │   ├── [command-1].md
│   │   ├── [command-2].md
│   │   └── ...
│   └── agents/
│       ├── [agent-1].md
│       └── [agent-2].md
└── .mcp.json
└── src/ # Your application code</code></pre>

<p>That's it! Claude Code will automatically detect all components and you can start using them immediately.</p>
```

### 7. Navigation Footer
```html
<div class="article-nav">
    <a href="../index.html" class="back-to-blog">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
        </svg>
        Back to Blog
    </a>
</div>
```

## 📋 Content Guidelines

### Writing Style
- Use clear, technical language suitable for developers
- Include practical examples and code snippets
- Focus on actionable content and real-world use cases
- Keep sentences concise and scannable
- Use bullet points and numbered lists for clarity

### Technical Content
- Always include installation commands with proper syntax
- Provide multiple installation methods (individual, global, bulk)
- Show file structure after installation
- Include component descriptions that highlight practical benefits
- Use consistent command naming patterns

### SEO Optimization
- **Title**: "How to use Claude Code with [Technology]"
- **Meta Description**: Max 160 characters, include key terms
- **Keywords**: Technology name, Claude Code, MCP, Agents, Commands, AI Development
- **Headers**: Use proper H2, H3 hierarchy
- **Alt Text**: Descriptive alt text for all images
- **Internal Links**: Link to main site and other relevant articles
- **Structured Data**: Include JSON-LD schema for articles

### Visual Assets Required
1. **Cover Image**: 1200x630 pixels for social sharing
2. **Hero Image**: Technology + Claude Code branded image
3. **AITMPL Search Screenshot**: Show search results for the technology
4. **Component Icons**: Use appropriate emojis (🤖 for agents, ⚡ for commands, 🔌 for MCP)

## 🔧 Technical Requirements

### File Naming Convention
- **Slug**: `[technology-name]-claude-code-integration`
- **Directory**: `docs/blog/[slug]/`
- **Main File**: `index.html`
- **Assets**: Use descriptive names with technology prefix

### Code Block Standards
- Use `language-bash` for terminal commands
- Include copy functionality (automatic via code-copy.js)
- Clean terminal output (remove success messages and prompts)
- Use proper syntax highlighting

### Responsive Design
- All tables must be responsive
- Images should have loading="lazy" attribute
- Use relative paths for internal assets
- Test on mobile and desktop viewports

## 📊 Component Data Requirements

Before writing an article, gather:

1. **Available Components**
   - List all commands for the technology
   - List all agents for the technology  
   - Identify MCP server if available

2. **Installation Information**
   - Component file names
   - Installation directory structure
   - Example prompts for testing

3. **Category Information**
   - Primary category (Database, Frontend, Backend, etc.)
   - Secondary tags
   - Related technologies

## ✅ Pre-Publication Checklist

- [ ] All placeholders replaced with actual content
- [ ] SEO meta tags completed
- [ ] Images optimized and properly sized
- [ ] Links tested (internal and external)
- [ ] Code blocks tested for copy functionality
- [ ] Mobile responsiveness verified
- [ ] Structured data validated
- [ ] Article added to blog index page
- [ ] Social media preview tested

## 📈 Analytics & Performance

### Tracking
- Article views and engagement will be tracked via existing analytics
- Monitor social media sharing performance
- Track component installation after article publication

### Success Metrics
- Time on page > 3 minutes
- Low bounce rate < 40%
- High component installation conversion
- Social media shares and engagement

This template ensures consistency across all technology integration articles while maintaining high SEO standards and user experience.
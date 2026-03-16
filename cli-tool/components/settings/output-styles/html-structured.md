---
name: HTML Structured
description: Clean semantic HTML with proper structure
---

Format all responses as clean, semantic HTML using modern HTML5 standards:

## Document Structure
- Wrap the entire response in `<article>` tags
- Use `<header>` for introductory content
- Use `<main>` for primary content
- Use `<section>` to group related content
- Use `<aside>` for supplementary information
- Use `<nav>` for navigation elements when relevant

## Headings and Text
- Use `<h2>` for main sections
- Use `<h3>` for subsections
- Use `<h4>` and below for further nesting as needed
- Use `<strong>` for emphasis and important text
- Use `<em>` for italics and stress emphasis
- Use `<p>` for paragraphs

## Code Formatting
- Format code blocks with `<pre><code class="language-{lang}">` structure
- Use appropriate language identifiers (javascript, python, html, css, etc.)
- For inline code, use `<code>` tags
- Add `data-file` attributes to code blocks when referencing specific files
- Add `data-line` attributes when referencing specific line numbers

## Lists and Tables
- Use `<ul>` for unordered lists, `<ol>` for ordered lists
- Always use `<li>` for list items
- Structure tables with `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
- Add `scope` attributes to table headers for accessibility
- Use `<caption>` for table descriptions when helpful

## Data Attributes
- Add `data-file="filename"` to elements referencing files
- Add `data-line="number"` when referencing specific lines
- Add `data-type="info|warning|error|success"` for status messages
- Add `data-action="create|edit|delete"` for file operations

## Inline Styles (Minimal)
Include basic inline styles for readability:
- `style="font-family: monospace; background: #f5f5f5; padding: 2px 4px;"` for inline code
- `style="margin: 1em 0; padding: 1em; background: #f8f9fa; border-left: 3px solid #007acc;"` for code blocks
- `style="margin: 1em 0;"` for sections

## Example Structure
```html
<article>
  <header>
    <h2>Task Completion Summary</h2>
  </header>
  <main>
    <section data-type="success">
      <h3>Files Modified</h3>
      <ul>
        <li data-file="example.js" data-action="edit">Updated function logic</li>
      </ul>
    </section>
    <section>
      <h3>Code Changes</h3>
      <pre><code class="language-javascript" data-file="example.js" data-line="15-20">
function example() {
  return "Hello World";
}
      </code></pre>
    </section>
  </main>
</article>
```

Keep HTML clean, readable, and semantically meaningful. Avoid unnecessary nesting and maintain consistent indentation.
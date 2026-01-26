# Obsidian Web Clipper JSON Schema

The Obsidian Web Clipper imports templates via JSON files.

## Root Structure

```json
{
	"schemaVersion": "0.1.0",
	"name": "Template Name",
	"behavior": "create",
	"noteContentFormat": "Markdown content here...",
	"properties": [],
	"triggers": [],
	"noteNameFormat": "{{title}}",
	"path": "Inbox/"
}
```

### Fields

*   **`schemaVersion`**: Always "0.1.0".
*   **`name`**: The display name of the template in the Clipper.
*   **`behavior`**: How the note is created.
    *   `create`: Create a new note.
    *   `append-specific`: Append to a specific note (requires `path` to be a full file path).
    *   `append-daily`: Append to the daily note.
*   **`noteContentFormat`**: The body of the note.
    *   Use `\n` for newlines.
    *   Can use all variables (e.g., `{{content}}`, `{{selection}}`).
*   **`noteNameFormat`**: The filename pattern (e.g., `{{date}} - {{title}}`).
*   **`path`**: The location to save the note.
    *   For `create` behavior: The *folder* to save the note in (e.g., `Clippings/` or `Recipes/`).
    *   For `append-specific` behavior: The *full file path* of the note to append to (e.g., `Databases/Recipes.md`).
*   **`triggers`**: Array of strings to automatically select this template.
    *   **URL Patterns**: `["https://www.youtube.com/watch"]` (Simple string or Regex).
    *   **Schema Types**: `["schema:Recipe"]` (Triggers if the page contains this Schema.org type).

## Properties

The `properties` array defines the YAML frontmatter of the note.

```json
"properties": [
    {
        "name": "category",
        "value": "Recipes",
        "type": "text"
    },
    {
        "name": "published",
        "value": "{{published}}",
        "type": "datetime"
    }
]
```

### Property Types

*   **`text`**: Simple text string.
*   **`multitext`**: List of text strings (for tags/aliases).
*   **`number`**: Numeric value.
*   **`checkbox`**: Boolean true/false.
*   **`date`**: Date string (YYYY-MM-DD).
*   **`datetime`**: Date and time string.

### Property Object Structure

*   **`name`**: The key in the YAML frontmatter.
*   **`value`**: The value to populate. Can contain variables.
*   **`type`**: One of the types listed above.

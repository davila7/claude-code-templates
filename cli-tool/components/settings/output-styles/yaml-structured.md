---
name: YAML Structured
description: Structured YAML with hierarchical key value pairs
---

Structure all responses in valid YAML format with the following guidelines:

# Response Organization
- Use clear hierarchical structure with proper indentation (2 spaces)
- Organize content into logical sections using YAML objects
- Include descriptive comments using # for context and explanations
- Use key-value pairs for structured information
- Employ YAML lists with hyphens (-) for enumerated items
- Follow YAML syntax conventions strictly

# Output Structure
Format responses like configuration files with sections such as:
- `task`: Brief description of what was accomplished
- `details`: Structured breakdown of implementation
- `files`: List of files modified/created with descriptions
- `commands`: Any commands that should be run
- `status`: Current state or completion status
- `next_steps`: Recommended follow-up actions (if applicable)
- `notes`: Additional context or important considerations

# Example Format
```yaml
task: "File modification completed"
status: "success"
details:
  action: "updated configuration"
  target: "/path/to/file"
  changes: 3
files:
  - path: "/absolute/path/to/file.js"
    action: "modified"
    description: "Added new function implementation"
  - path: "/absolute/path/to/config.json"
    action: "updated" 
    description: "Changed timeout settings"
commands:
  - "npm test"
  - "npm run lint"
notes:
  - "All changes follow existing code patterns"
  - "No breaking changes introduced"
```

# Key Principles
- Maintain parseable YAML syntax at all times
- Use consistent indentation and structure
- Include relevant file paths as absolute paths
- Add explanatory comments where helpful
- Keep nesting logical and not overly deep
- Use appropriate YAML data types (strings, numbers, booleans, lists, objects)
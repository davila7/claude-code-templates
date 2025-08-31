---
allowed-tools: Bash, WebFetch
argument-hint: [data-source] | --xatu | --custom-url | --validate
description: Load and process external documentation context from llms.txt files or custom sources
model: sonnet
---

# External Documentation Context Loader

Load external documentation context: $ARGUMENTS

## Current Context Status

- Network access: !`curl -s --connect-timeout 5 https://httpbin.org/status/200 >/dev/null && echo "✅ Available" || echo "❌ Limited"`
- Existing context: Check for local llms.txt or documentation cache
- Project type: @package.json or @README.md (detect project context needs)

## Task

Load and process external documentation context from specified source.

### Default Action (Xatu Data)
Load the llms.txt file from Xatu data repository:
```bash
curl -s https://raw.githubusercontent.com/ethpandaops/xatu-data/refs/heads/master/llms.txt
```

### Custom Source Loading
For custom URLs or alternative documentation sources:
- Validate URL accessibility
- Download and cache content
- Process and structure information
- Integration with project context

### Processing Options
- **Raw loading**: Direct content retrieval
- **Validation**: Check content format and structure  
- **Integration**: Merge with existing project documentation
- **Caching**: Store locally for offline access
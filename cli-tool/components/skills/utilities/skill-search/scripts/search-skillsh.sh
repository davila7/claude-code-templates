#!/bin/bash
# Search Skills.sh (Vercel) marketplace
# Usage: bash search-skillsh.sh "search query"

QUERY="$1"

if [ -z "$QUERY" ]; then
  echo '{"error": "No search query provided"}'
  exit 1
fi

# Check if npx is available
if ! command -v npx &> /dev/null; then
  echo '{"error": "npx is not installed. Please install Node.js to search Skills.sh", "suggestion": "Install Node.js from https://nodejs.org"}'
  exit 1
fi

# Use npx skills find with the query
# Capture output and parse it
echo '{"source": "skills.sh", "query": "'"$QUERY"'", "searching": true}'

# Run npx skills find and capture output
OUTPUT=$(npx -y skills find "$QUERY" --json 2>/dev/null)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ] && [ -n "$OUTPUT" ]; then
  # If JSON output is available, pass it through
  echo "$OUTPUT"
else
  # Fallback: run without --json flag and capture text output
  OUTPUT=$(npx -y skills find "$QUERY" 2>/dev/null)
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ] && [ -n "$OUTPUT" ]; then
    # Parse text output into JSON format
    node -e "
    const output = \`$OUTPUT\`;
    const lines = output.split('\n').filter(l => l.trim());
    const results = [];

    for (const line of lines) {
      // Try to extract skill info from various output formats
      const match = line.match(/^[\s]*(?:[-*]\s+)?(.+?)(?:\s+[-–]\s+(.+))?$/);
      if (match && match[1]) {
        results.push({
          name: match[1].trim(),
          description: (match[2] || '').trim(),
          source: 'skills.sh'
        });
      }
    }

    console.log(JSON.stringify({
      source: 'skills.sh',
      query: '$QUERY',
      total: results.length,
      results: results.slice(0, 15),
      raw_output: output.substring(0, 2000)
    }, null, 2));
    " 2>/dev/null || echo '{"source": "skills.sh", "query": "'"$QUERY"'", "total": 0, "results": [], "raw_output": "'"$(echo "$OUTPUT" | head -20 | sed 's/"/\\"/g')"'"}'
  else
    echo '{"source": "skills.sh", "query": "'"$QUERY"'", "total": 0, "results": [], "note": "No results found or skills CLI not available. Browse manually at https://skills.sh"}'
  fi
fi

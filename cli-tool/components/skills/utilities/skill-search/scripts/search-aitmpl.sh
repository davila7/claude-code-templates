#!/bin/bash
# Search Claude Code Templates (aitmpl.com)
# Usage: bash search-aitmpl.sh "search query" [type]
# Uses the /api/search endpoint for lightweight queries.
# Falls back to downloading components.json if the API is unavailable.

QUERY="$1"
TYPE="$2"

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: search-aitmpl.sh \"search query\" [type]"
  echo "  query: Search term (required)"
  echo "  type:  Filter by type: agents, commands, settings, hooks, mcps, skills, templates"
  exit 0
fi

if [ -z "$QUERY" ]; then
  echo '{"error": "No search query provided"}'
  exit 1
fi

# URL-encode the query
ENCODED_QUERY=$(node -e "console.log(encodeURIComponent('$QUERY'))" 2>/dev/null || python3 -c "import urllib.parse; print(urllib.parse.quote('$QUERY'))" 2>/dev/null || echo "$QUERY")

# Build API URL
API_URL="https://aitmpl.com/api/search?q=${ENCODED_QUERY}&limit=15"
if [ -n "$TYPE" ]; then
  API_URL="${API_URL}&type=${TYPE}"
fi

# Try the API endpoint first (lightweight, ~1-5KB response)
API_RESPONSE=$(curl -s -L --max-time 10 -w "\n%{http_code}" "$API_URL" 2>/dev/null)
HTTP_CODE=$(echo "$API_RESPONSE" | tail -1)
BODY=$(echo "$API_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && [ -n "$BODY" ]; then
  echo "$BODY"
  exit 0
fi

# Fallback: download full components.json and search locally
QUERY_LOWER=$(echo "$QUERY" | tr '[:upper:]' '[:lower:]')

CACHE_DIR="${HOME}/.cache/skill-search"
CACHE_FILE="${CACHE_DIR}/components.json"
CACHE_MAX_AGE=300 # 5 minutes

mkdir -p "$CACHE_DIR"

# Check cache
NEED_FETCH=true
if [ -f "$CACHE_FILE" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    FILE_AGE=$(( $(date +%s) - $(stat -f %m "$CACHE_FILE") ))
  else
    FILE_AGE=$(( $(date +%s) - $(stat -c %Y "$CACHE_FILE") ))
  fi
  if [ "$FILE_AGE" -lt "$CACHE_MAX_AGE" ]; then
    NEED_FETCH=false
  fi
fi

if [ "$NEED_FETCH" = true ]; then
  HTTP_CODE=$(curl -s -L -w "%{http_code}" -o "$CACHE_FILE" --max-time 15 "https://aitmpl.com/components.json")
  if [ "$HTTP_CODE" != "200" ]; then
    echo '{"error": "Failed to fetch components catalog from aitmpl.com (HTTP '"$HTTP_CODE"')"}'
    rm -f "$CACHE_FILE"
    exit 1
  fi
fi

# Determine type filter for local search
TYPE_FILTER=""
if [ -n "$TYPE" ]; then
  TYPE_FILTER="$TYPE"
fi

# Search using node for JSON parsing (more reliable than jq which may not be installed)
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$CACHE_FILE', 'utf8'));
const query = '${QUERY_LOWER}'.replace(/'/g, '');
const typeFilter = '${TYPE_FILTER}';
const results = [];

const types = typeFilter ? [typeFilter] : ['agents', 'commands', 'settings', 'hooks', 'mcps', 'skills', 'templates'];

for (const type of types) {
  if (!data[type]) continue;
  for (const item of data[type]) {
    const name = (item.name || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const category = (item.category || '').toLowerCase();
    const path = (item.path || '').toLowerCase();

    let score = 0;
    if (name === query) score += 100;
    else if (name.startsWith(query)) score += 80;
    else if (name.includes(query)) score += 60;
    if (category === query) score += 50;
    else if (category.includes(query)) score += 40;
    if (desc.includes(query)) score += 30;
    if (path.includes(query)) score += 15;

    // Multi-word search: check each word
    const words = query.split(/\s+/);
    if (words.length > 1) {
      const matchedWords = words.filter(w => name.includes(w) || desc.includes(w) || category.includes(w));
      score += matchedWords.length * 20;
    }

    if (score > 0) {
      const singularType = type.replace(/s$/, '');
      results.push({
        name: item.name,
        type: singularType,
        category: item.category || '',
        description: (item.description || '').substring(0, 150),
        path: item.path || '',
        downloads: item.downloads || 0,
        score: score,
        install_cmd: 'npx claude-code-templates@latest --' + singularType + '=' + (item.path || item.name) + ' --yes'
      });
    }
  }
}

results.sort((a, b) => b.score - a.score || b.downloads - a.downloads);
const top = results.slice(0, 15);
console.log(JSON.stringify({ query: query, type: typeFilter || 'all', total: results.length, results: top }, null, 2));
" 2>/dev/null

if [ $? -ne 0 ]; then
  # Fallback: try with python3
  python3 -c "
import json, sys

with open('$CACHE_FILE') as f:
    data = json.load(f)

query = '${QUERY_LOWER}'.replace(\"'\", '')
type_filter = '${TYPE_FILTER}'
results = []

types_to_search = [type_filter] if type_filter else ['agents', 'commands', 'settings', 'hooks', 'mcps', 'skills', 'templates']

for comp_type in types_to_search:
    items = data.get(comp_type, [])
    for item in items:
        name = (item.get('name', '') or '').lower()
        desc = (item.get('description', '') or '').lower()
        category = (item.get('category', '') or '').lower()
        path = (item.get('path', '') or '').lower()

        score = 0
        if name == query: score += 100
        elif name.startswith(query): score += 80
        elif query in name: score += 60
        if category == query: score += 50
        elif query in category: score += 40
        if query in desc: score += 30
        if query in path: score += 15

        words = query.split()
        if len(words) > 1:
            matched = sum(1 for w in words if w in name or w in desc or w in category)
            score += matched * 20

        if score > 0:
            singular = comp_type.rstrip('s')
            results.append({
                'name': item.get('name', ''),
                'type': singular,
                'category': item.get('category', ''),
                'description': (item.get('description', '') or '')[:150],
                'path': item.get('path', ''),
                'downloads': item.get('downloads', 0),
                'score': score,
                'install_cmd': f'npx claude-code-templates@latest --{singular}={item.get(\"path\", item.get(\"name\", \"\"))} --yes'
            })

results.sort(key=lambda x: (-x['score'], -x['downloads']))
print(json.dumps({'query': query, 'type': type_filter or 'all', 'total': len(results), 'results': results[:15]}, indent=2))
" 2>/dev/null
fi

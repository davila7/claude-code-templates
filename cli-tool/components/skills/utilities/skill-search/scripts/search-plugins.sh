#!/bin/bash
# Search GitHub Plugin Marketplaces (Anthropic official)
# Usage: bash search-plugins.sh "search query"

QUERY="$1"

if [ -z "$QUERY" ]; then
  echo '{"error": "No search query provided"}'
  exit 1
fi

QUERY_LOWER=$(echo "$QUERY" | tr '[:upper:]' '[:lower:]')

CACHE_DIR="${HOME}/.cache/skill-search"
mkdir -p "$CACHE_DIR"

# Define marketplace repositories to search
MARKETPLACES=(
  "anthropics/claude-plugins-official"
  "anthropics/claude-code"
)

ALL_RESULTS="[]"

for MARKETPLACE in "${MARKETPLACES[@]}"; do
  MARKETPLACE_SLUG=$(echo "$MARKETPLACE" | tr '/' '-')
  CACHE_FILE="${CACHE_DIR}/${MARKETPLACE_SLUG}-marketplace.json"
  CACHE_MAX_AGE=600 # 10 minutes

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
    # Fetch marketplace.json from the repository
    MARKETPLACE_URL="https://raw.githubusercontent.com/${MARKETPLACE}/main/.claude-plugin/marketplace.json"
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$CACHE_FILE" --max-time 10 "$MARKETPLACE_URL")

    if [ "$HTTP_CODE" != "200" ]; then
      # Try refs/heads/main
      MARKETPLACE_URL="https://raw.githubusercontent.com/${MARKETPLACE}/refs/heads/main/.claude-plugin/marketplace.json"
      HTTP_CODE=$(curl -s -w "%{http_code}" -o "$CACHE_FILE" --max-time 10 "$MARKETPLACE_URL")
    fi

    if [ "$HTTP_CODE" != "200" ]; then
      rm -f "$CACHE_FILE"
      continue
    fi
  fi

  # Skip if cache file doesn't exist or is empty
  if [ ! -s "$CACHE_FILE" ]; then
    continue
  fi
done

# Search across all cached marketplace files
node -e "
const fs = require('fs');
const path = require('path');
const query = '${QUERY_LOWER}'.replace(/'/g, '');
const cacheDir = '${CACHE_DIR}';
const results = [];

const marketplaces = [
  { repo: 'anthropics/claude-plugins-official', slug: 'anthropics-claude-plugins-official' },
  { repo: 'anthropics/claude-code', slug: 'anthropics-claude-code' }
];

for (const mp of marketplaces) {
  const cachePath = path.join(cacheDir, mp.slug + '-marketplace.json');
  if (!fs.existsSync(cachePath)) continue;

  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const plugins = data.plugins || [];

    for (const plugin of plugins) {
      const name = (plugin.name || '').toLowerCase();
      const desc = (plugin.description || '').toLowerCase();
      const tags = (plugin.tags || []).join(' ').toLowerCase();

      let score = 0;
      if (name === query) score += 100;
      else if (name.startsWith(query)) score += 80;
      else if (name.includes(query)) score += 60;
      if (desc.includes(query)) score += 30;
      if (tags.includes(query)) score += 40;

      const words = query.split(/\s+/);
      if (words.length > 1) {
        const matched = words.filter(w => name.includes(w) || desc.includes(w) || tags.includes(w));
        score += matched.length * 20;
      }

      if (score > 0) {
        const mpName = mp.slug;
        results.push({
          name: plugin.name,
          description: (plugin.description || '').substring(0, 120),
          marketplace: mp.repo,
          marketplace_slug: mpName,
          tags: plugin.tags || [],
          homepage: plugin.homepage || '',
          score: score,
          install_cmd: '/plugin install ' + plugin.name + '@' + mpName
        });
      }
    }
  } catch (e) {
    // Skip unparseable files
  }
}

results.sort((a, b) => b.score - a.score);
console.log(JSON.stringify({
  source: 'github-plugins',
  query: query,
  total: results.length,
  results: results.slice(0, 15)
}, null, 2));
" 2>/dev/null

if [ $? -ne 0 ]; then
  # Fallback with python3
  python3 -c "
import json, os, glob

query = '${QUERY_LOWER}'.replace(\"'\", '')
cache_dir = '${CACHE_DIR}'
results = []

marketplaces = [
    {'repo': 'anthropics/claude-plugins-official', 'slug': 'anthropics-claude-plugins-official'},
    {'repo': 'anthropics/claude-code', 'slug': 'anthropics-claude-code'}
]

for mp in marketplaces:
    cache_path = os.path.join(cache_dir, mp['slug'] + '-marketplace.json')
    if not os.path.exists(cache_path):
        continue
    try:
        with open(cache_path) as f:
            data = json.load(f)
        for plugin in data.get('plugins', []):
            name = (plugin.get('name', '') or '').lower()
            desc = (plugin.get('description', '') or '').lower()
            tags = ' '.join(plugin.get('tags', [])).lower()
            score = 0
            if name == query: score += 100
            elif name.startswith(query): score += 80
            elif query in name: score += 60
            if query in desc: score += 30
            if query in tags: score += 40
            words = query.split()
            if len(words) > 1:
                matched = sum(1 for w in words if w in name or w in desc or w in tags)
                score += matched * 20
            if score > 0:
                results.append({
                    'name': plugin.get('name', ''),
                    'description': (plugin.get('description', '') or '')[:120],
                    'marketplace': mp['repo'],
                    'marketplace_slug': mp['slug'],
                    'tags': plugin.get('tags', []),
                    'homepage': plugin.get('homepage', ''),
                    'score': score,
                    'install_cmd': '/plugin install ' + plugin.get('name', '') + '@' + mp['slug']
                })
    except Exception:
        pass

results.sort(key=lambda x: -x['score'])
print(json.dumps({'source': 'github-plugins', 'query': query, 'total': len(results), 'results': results[:15]}, indent=2))
" 2>/dev/null
fi

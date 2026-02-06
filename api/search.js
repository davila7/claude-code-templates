// Component search API endpoint
// GET /api/search?q=frontend&type=agents&limit=15
import axios from 'axios';

const COMPONENTS_URL = 'https://www.aitmpl.com/components.json';
const VALID_TYPES = ['agents', 'commands', 'settings', 'hooks', 'mcps', 'skills', 'templates'];
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 15;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_QUERY_LENGTH = 200;

let cachedComponents = null;
let cacheTimestamp = null;

async function getComponents() {
  const now = Date.now();
  if (cachedComponents && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedComponents;
  }
  const response = await axios.get(COMPONENTS_URL, { timeout: 15000 });
  cachedComponents = response.data;
  cacheTimestamp = now;
  return cachedComponents;
}

function searchComponents(components, query, type = null, limit = DEFAULT_LIMIT) {
  const results = [];
  const lowerQuery = query.toLowerCase().trim();
  const words = lowerQuery.split(/\s+/).filter(w => w.length > 0);
  const typesToSearch = type ? [type] : VALID_TYPES;

  for (const componentType of typesToSearch) {
    const componentList = components[componentType] || [];
    for (const component of componentList) {
      const name = (component.name || '').toLowerCase();
      const desc = (component.description || '').toLowerCase();
      const category = (component.category || '').toLowerCase();
      const path = (component.path || '').toLowerCase();

      let score = 0;

      // Name matching (highest priority)
      if (name === lowerQuery) score += 100;
      else if (name.startsWith(lowerQuery)) score += 80;
      else if (name.includes(lowerQuery)) score += 60;

      // Category matching
      if (category === lowerQuery) score += 50;
      else if (category.includes(lowerQuery)) score += 40;

      // Description matching
      if (desc.includes(lowerQuery)) score += 30;

      // Path matching
      if (path.includes(lowerQuery)) score += 15;

      // Multi-word search: check each word individually
      if (words.length > 1) {
        const matchedWords = words.filter(w =>
          name.includes(w) || desc.includes(w) || category.includes(w)
        );
        score += matchedWords.length * 20;
      }

      if (score > 0) {
        const singularType = componentType.replace(/s$/, '');
        results.push({
          name: component.name,
          type: singularType,
          category: component.category || '',
          description: (component.description || '').substring(0, 150),
          path: component.path || '',
          downloads: component.downloads || 0,
          score,
          install_cmd: `npx claude-code-templates@latest --${singularType}=${component.path || component.name} --yes`
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score || b.downloads - a.downloads);
  return results.slice(0, Math.min(limit, MAX_LIMIT));
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['GET']
    });
  }

  const { q, type, limit: limitParam } = req.query;

  // Validate query
  if (!q || q.trim().length === 0) {
    return res.status(400).json({
      error: 'Missing required parameter: q',
      usage: 'GET /api/search?q=frontend&type=agents&limit=15'
    });
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      error: `Query too long (max ${MAX_QUERY_LENGTH} characters)`
    });
  }

  // Validate type
  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid type: ${type}`,
      valid_types: VALID_TYPES
    });
  }

  // Validate limit
  const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
  if (isNaN(limit) || limit < 1 || limit > MAX_LIMIT) {
    return res.status(400).json({
      error: `Invalid limit (must be 1-${MAX_LIMIT})`
    });
  }

  try {
    const components = await getComponents();
    const results = searchComponents(components, q, type || null, limit);

    res.status(200).json({
      query: q.trim(),
      type: type || 'all',
      total: results.length,
      results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to search components'
    });
  }
}

/**
 * IndexNow API Endpoint
 *
 * Submits URLs to IndexNow for instant indexing on Bing (which feeds LLMs).
 * This is critical for GEO (Generative Engine Optimization) as Bing indexes
 * content that ChatGPT, Perplexity, and other LLMs use for citations.
 *
 * Usage:
 *   POST /api/indexnow
 *   Body: { "urls": ["https://aitmpl.com/page1", "https://aitmpl.com/page2"] }
 *
 *   GET /api/indexnow?url=https://aitmpl.com/page1
 *
 * Environment Variables:
 *   INDEXNOW_KEY - Your IndexNow API key (also placed at /indexnow-key.txt)
 */

const SITE_HOST = 'aitmpl.com';
const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = process.env.INDEXNOW_KEY;

  if (!key) {
    return res.status(500).json({
      error: 'INDEXNOW_KEY environment variable not configured'
    });
  }

  let urls = [];

  // Handle GET request (single URL)
  if (req.method === 'GET') {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({
        error: 'Missing url parameter',
        usage: 'GET /api/indexnow?url=https://aitmpl.com/page'
      });
    }
    urls = [url];
  }

  // Handle POST request (multiple URLs)
  else if (req.method === 'POST') {
    const body = req.body || {};
    urls = body.urls || body.urlList || [];

    if (typeof body.url === 'string') {
      urls = [body.url];
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        error: 'Missing urls array in request body',
        usage: 'POST /api/indexnow with body: { "urls": ["url1", "url2"] }'
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate URLs
  const validUrls = urls.filter(url => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === SITE_HOST ||
             parsed.hostname === `www.${SITE_HOST}`;
    } catch {
      return false;
    }
  });

  if (validUrls.length === 0) {
    return res.status(400).json({
      error: `No valid URLs for ${SITE_HOST}`,
      provided: urls
    });
  }

  // Limit to 10,000 URLs per request (IndexNow limit)
  const urlsToSubmit = validUrls.slice(0, 10000);

  // Build IndexNow payload
  const payload = {
    host: SITE_HOST,
    key: key,
    keyLocation: `https://${SITE_HOST}/${key}.txt`,
    urlList: urlsToSubmit
  };

  const results = [];

  // Submit to all IndexNow endpoints
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      results.push({
        endpoint,
        status: response.status,
        success: response.status === 200 || response.status === 202,
        message: response.status === 200 ? 'URLs submitted successfully' :
                 response.status === 202 ? 'URLs accepted for processing' :
                 `Error: ${response.statusText}`
      });
    } catch (error) {
      results.push({
        endpoint,
        status: 0,
        success: false,
        message: `Network error: ${error.message}`
      });
    }
  }

  const anySuccess = results.some(r => r.success);

  return res.status(anySuccess ? 200 : 500).json({
    success: anySuccess,
    submitted: urlsToSubmit.length,
    urls: urlsToSubmit,
    results,
    timestamp: new Date().toISOString()
  });
}

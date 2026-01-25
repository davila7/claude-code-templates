#!/usr/bin/env node

/**
 * Roier SEO - PageSpeed Insights API Audit
 *
 * Uses Google's PageSpeed Insights API (no local Chrome needed).
 * Works for any publicly accessible URL.
 *
 * Usage:
 *   node audit-api.js <URL> [--key=API_KEY]
 *
 * Note: Without an API key, you're limited to ~5 requests/minute.
 * Get a free API key at: https://developers.google.com/speed/docs/insights/v5/get-started
 *
 * Requirements: Node.js 18+ (uses native fetch)
 */

// Check Node.js version - native fetch requires Node 18+
const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
if (nodeVersion < 18) {
  console.error('Error: This script requires Node.js 18 or higher (for native fetch support).');
  console.error(`Current version: ${process.versions.node}`);
  process.exit(1);
}

const API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

async function runAudit(url, apiKey = null) {
  console.error(`${colors.cyan}🔍 Running PageSpeed Insights audit for: ${url}${colors.reset}\n`);

  const categories = ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'];
  const params = new URLSearchParams({
    url,
    strategy: 'mobile',
    ...Object.fromEntries(categories.map(c => [`category`, c]))
  });

  // Add all categories
  const categoryParams = categories.map(c => `category=${c}`).join('&');
  let apiUrl = `${API_URL}?url=${encodeURIComponent(url)}&strategy=mobile&${categoryParams}`;

  if (apiKey) {
    apiUrl += `&key=${apiKey}`;
  }

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const lhr = data.lighthouseResult;

    // Extract scores
    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100),
      pwa: Math.round((lhr.categories.pwa?.score || 0) * 100)
    };

    // Extract failed audits
    const issues = {
      critical: [],
      serious: [],
      moderate: [],
      minor: []
    };

    for (const [auditId, audit] of Object.entries(lhr.audits)) {
      if (audit.score !== null && audit.score < 1) {
        const issue = {
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          displayValue: audit.displayValue || null
        };

        if (audit.details?.items) {
          issue.items = audit.details.items.slice(0, 3);
        }

        if (audit.score === 0) {
          issues.critical.push(issue);
        } else if (audit.score < 0.5) {
          issues.serious.push(issue);
        } else if (audit.score < 0.9) {
          issues.moderate.push(issue);
        } else {
          issues.minor.push(issue);
        }
      }
    }

    // Core Web Vitals
    const webVitals = {
      FCP: lhr.audits['first-contentful-paint']?.numericValue,
      LCP: lhr.audits['largest-contentful-paint']?.numericValue,
      TBT: lhr.audits['total-blocking-time']?.numericValue,
      CLS: lhr.audits['cumulative-layout-shift']?.numericValue,
      SI: lhr.audits['speed-index']?.numericValue
    };

    const result = {
      url,
      fetchTime: lhr.fetchTime,
      scores,
      webVitals,
      issues,
      summary: {
        totalIssues: issues.critical.length + issues.serious.length + issues.moderate.length + issues.minor.length,
        critical: issues.critical.length,
        serious: issues.serious.length,
        moderate: issues.moderate.length,
        minor: issues.minor.length
      }
    };

    // Output JSON to stdout
    console.log(JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    console.error(`${colors.red}❌ Audit failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Parse arguments
const args = process.argv.slice(2);
const url = args.find(arg => !arg.startsWith('--'));
const keyFlag = args.find(arg => arg.startsWith('--key='));
const apiKey = keyFlag ? keyFlag.split('=')[1] : null;

if (!url) {
  console.log(`
${colors.cyan}Roier SEO - PageSpeed Insights API Audit${colors.reset}

${colors.bold}Usage:${colors.reset}
  node audit-api.js <URL> [--key=API_KEY]

${colors.bold}Examples:${colors.reset}
  node audit-api.js https://example.com
  node audit-api.js https://example.com --key=YOUR_API_KEY

${colors.bold}Note:${colors.reset}
  - Only works for publicly accessible URLs
  - Without an API key, limited to ~5 requests/minute
  - Get a free API key at: https://developers.google.com/speed/docs/insights/v5/get-started
`);
  process.exit(0);
}

if (url.includes('localhost') || url.includes('127.0.0.1')) {
  console.error(`${colors.yellow}⚠️  Warning: PageSpeed Insights API cannot audit localhost URLs.`);
  console.error(`   Use 'node audit.js' (with local Chrome) for localhost audits.${colors.reset}\n`);
  process.exit(1);
}

runAudit(url, apiKey);

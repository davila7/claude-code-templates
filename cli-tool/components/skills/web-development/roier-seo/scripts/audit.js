#!/usr/bin/env node

/**
 * Roier SEO - Lighthouse Audit Script
 *
 * Runs a Lighthouse audit on a given URL and outputs structured results.
 *
 * Usage:
 *   node audit.js <URL> [--output=json|summary] [--save=filename]
 *
 * Examples:
 *   node audit.js https://example.com
 *   node audit.js http://localhost:3000 --output=summary
 *   node audit.js https://example.com --save=audit-results.json
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

function getScoreColor(score) {
  if (score >= 90) return colors.green;
  if (score >= 50) return colors.yellow;
  return colors.red;
}

function formatScore(score) {
  const numScore = Math.round(score * 100);
  const color = getScoreColor(numScore);
  return `${color}${numScore}${colors.reset}`;
}

async function runAudit(url, options = {}) {
  const { output = 'json', save } = options;

  // Use stderr for status messages to avoid polluting JSON output on stdout
  console.error(`${colors.cyan}🔍 Starting Lighthouse audit for: ${url}${colors.reset}\n`);

  let chrome;
  let exitCode = 0;

  try {
    // Launch Chrome
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
    });

    // Run Lighthouse
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa']
    });

    const { lhr } = result;

    // Extract scores (with safe access for optional categories)
    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100),
      pwa: Math.round((lhr.categories.pwa?.score || 0) * 100)
    };

    // Extract failed audits with details
    const issues = {
      critical: [],
      serious: [],
      moderate: [],
      minor: []
    };

    // Process all audits
    for (const [auditId, audit] of Object.entries(lhr.audits)) {
      if (audit.score !== null && audit.score < 1) {
        const issue = {
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          displayValue: audit.displayValue || null,
          category: getAuditCategory(auditId, lhr.categories)
        };

        // Add details if available
        if (audit.details) {
          if (audit.details.items && audit.details.items.length > 0) {
            issue.items = audit.details.items.slice(0, 5).map(item => ({
              ...item,
              // Simplify large objects
              node: item.node ? { selector: item.node.selector, snippet: item.node.snippet } : undefined
            }));
          }
        }

        // Categorize by severity
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

    // Extract Core Web Vitals
    const webVitals = {
      FCP: lhr.audits['first-contentful-paint']?.numericValue,
      LCP: lhr.audits['largest-contentful-paint']?.numericValue,
      TBT: lhr.audits['total-blocking-time']?.numericValue,
      CLS: lhr.audits['cumulative-layout-shift']?.numericValue,
      SI: lhr.audits['speed-index']?.numericValue
    };

    // Build result object
    const auditResult = {
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

    // Output based on format
    if (output === 'summary') {
      printSummary(auditResult);
    } else {
      // JSON output - print to stdout for Claude to parse
      console.log(JSON.stringify(auditResult, null, 2));
    }

    // Save to file if requested
    if (save) {
      const savePath = path.resolve(save);
      fs.writeFileSync(savePath, JSON.stringify(auditResult, null, 2));
      console.error(`\n${colors.green}✅ Results saved to: ${savePath}${colors.reset}`);
    }

    return auditResult;

  } catch (error) {
    console.error(`${colors.red}❌ Audit failed: ${error.message}${colors.reset}`);
    exitCode = 1;
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

function getAuditCategory(auditId, categories) {
  for (const [catId, category] of Object.entries(categories)) {
    if (category.auditRefs?.some(ref => ref.id === auditId)) {
      return catId;
    }
  }
  return 'other';
}

function printSummary(result) {
  console.log(`${colors.bold}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}  LIGHTHOUSE AUDIT RESULTS${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.dim}URL: ${result.url}${colors.reset}`);
  console.log(`${colors.dim}Time: ${result.fetchTime}${colors.reset}\n`);

  // Scores
  console.log(`${colors.bold}SCORES${colors.reset}`);
  console.log(`  Performance:    ${formatScore(result.scores.performance / 100)}`);
  console.log(`  Accessibility:  ${formatScore(result.scores.accessibility / 100)}`);
  console.log(`  Best Practices: ${formatScore(result.scores.bestPractices / 100)}`);
  console.log(`  SEO:            ${formatScore(result.scores.seo / 100)}`);
  console.log(`  PWA:            ${formatScore(result.scores.pwa / 100)}`);

  // Web Vitals
  console.log(`\n${colors.bold}CORE WEB VITALS${colors.reset}`);
  if (result.webVitals.FCP) console.log(`  FCP: ${(result.webVitals.FCP / 1000).toFixed(2)}s`);
  if (result.webVitals.LCP) console.log(`  LCP: ${(result.webVitals.LCP / 1000).toFixed(2)}s`);
  if (result.webVitals.TBT) console.log(`  TBT: ${result.webVitals.TBT.toFixed(0)}ms`);
  if (result.webVitals.CLS) console.log(`  CLS: ${result.webVitals.CLS.toFixed(3)}`);

  // Issues summary
  console.log(`\n${colors.bold}ISSUES FOUND${colors.reset}`);
  console.log(`  ${colors.red}Critical: ${result.summary.critical}${colors.reset}`);
  console.log(`  ${colors.yellow}Serious:  ${result.summary.serious}${colors.reset}`);
  console.log(`  ${colors.blue}Moderate: ${result.summary.moderate}${colors.reset}`);
  console.log(`  ${colors.dim}Minor:    ${result.summary.minor}${colors.reset}`);

  // List critical and serious issues
  if (result.issues.critical.length > 0) {
    console.log(`\n${colors.red}${colors.bold}CRITICAL ISSUES${colors.reset}`);
    result.issues.critical.forEach(issue => {
      console.log(`  • ${issue.title}`);
      if (issue.displayValue) console.log(`    ${colors.dim}${issue.displayValue}${colors.reset}`);
    });
  }

  if (result.issues.serious.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}SERIOUS ISSUES${colors.reset}`);
    result.issues.serious.forEach(issue => {
      console.log(`  • ${issue.title}`);
      if (issue.displayValue) console.log(`    ${colors.dim}${issue.displayValue}${colors.reset}`);
    });
  }

  console.log(`\n${colors.bold}═══════════════════════════════════════════════════${colors.reset}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const url = args.find(arg => !arg.startsWith('--'));
const outputFlag = args.find(arg => arg.startsWith('--output='));
const saveFlag = args.find(arg => arg.startsWith('--save='));

if (!url) {
  console.log(`
${colors.cyan}Roier SEO - Lighthouse Audit Tool${colors.reset}

${colors.bold}Usage:${colors.reset}
  node audit.js <URL> [options]

${colors.bold}Options:${colors.reset}
  --output=json|summary   Output format (default: json)
  --save=<filename>       Save results to file

${colors.bold}Examples:${colors.reset}
  node audit.js https://example.com
  node audit.js http://localhost:3000 --output=summary
  node audit.js https://example.com --save=results.json
`);
  process.exit(0);
}

const options = {
  output: outputFlag ? outputFlag.split('=')[1] : 'json',
  save: saveFlag ? saveFlag.split('=')[1] : null
};

runAudit(url, options);

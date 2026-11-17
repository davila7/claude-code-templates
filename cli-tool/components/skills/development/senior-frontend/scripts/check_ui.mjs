#!/usr/bin/env node
// check_ui.mjs: open a page in Chromium and report what a reviewer would catch.
//
// Usage:
//   node check_ui.mjs <url> [--out DIR] [--widths 375,1280] [--tabs 40] [--wait 1500]
//
// For each width it saves a full-page screenshot and reports console errors,
// horizontal overflow, controls without an accessible name, inputs without a
// label, images without alt or size, and clickable non-interactive elements.
// At the widest width it presses Tab repeatedly and lists each focus stop and
// whether it shows a visible focus indicator. If axe-core can be resolved from
// the project, its WCAG 2.2 AA violations are added.
//
// Needs Playwright (the project's, or a global install). Exits 2 if missing.
// Writes only inside --out (default: ./.ui-check). Prints a JSON report.

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { auditDom, focusStop } from './page-audit.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
if (!url || !/^https?:\/\//.test(url)) {
  console.error('Usage: node check_ui.mjs <http(s) url> [--out DIR] [--widths 375,1280] [--tabs 40] [--wait 1500]');
  process.exit(1);
}
const outDir = path.resolve(opt('out', '.ui-check'));
const widths = opt('widths', '375,1280').split(',').map(Number).filter((n) => n > 0);
const maxTabs = Number(opt('tabs', '40'));
const wait = Number(opt('wait', '1500'));

function load(name) {
  for (const base of [path.join(process.cwd(), 'noop.js'), import.meta.url]) {
    try {
      return createRequire(base)(name);
    } catch {}
  }
  return null;
}
const playwright = load('playwright') || load('@playwright/test');
if (!playwright) {
  console.error('Playwright not found. Add it to the project as a dev dependency (and download its Chromium build), or install it globally.');
  process.exit(2);
}
let axeSource = null;
try {
  const axePath = createRequire(path.join(process.cwd(), 'noop.js')).resolve('axe-core/axe.min.js');
  axeSource = readFileSync(axePath, 'utf8');
} catch {}

mkdirSync(outDir, { recursive: true });
const browser = await playwright.chromium.launch();
const report = { url, outDir, widths: {}, focusWalk: null, axe: axeSource ? [] : 'axe-core not installed (optional)' };

const widest = Math.max(...widths);

async function runAxe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
    const r = await window.axe.run(document, { runOnly: tags });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));
  });
}

async function walkFocus(page) {
  const stops = [];
  await page.mouse.click(1, 1);
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(focusStop);
    if (!stop) break;
    if (stops.length && stops[0].key === stop.key) break; // wrapped around
    stops.push(stop);
  }
  return {
    stops: stops.map(({ key, ...s }) => s),
    withoutVisibleFocus: stops.filter((s) => !s.visibleFocus).map((s) => s.el + ' "' + s.name + '"'),
  };
}

async function checkWidth(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 300)));
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(wait);
    const shot = path.join(outDir, `page-${width}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const dom = await page.evaluate(auditDom);
    report.widths[width] = { screenshot: shot, consoleErrors, ...dom };
    if (width === widest) {
      if (axeSource) report.axe = await runAxe(page);
      report.focusWalk = await walkFocus(page);
    }
  } catch (e) {
    report.widths[width] = { error: String(e).slice(0, 300), consoleErrors };
  } finally {
    await ctx.close();
  }
}

for (const width of widths) await checkWidth(width);
await browser.close();

writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

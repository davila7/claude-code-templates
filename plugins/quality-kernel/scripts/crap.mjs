#!/usr/bin/env node
/**
 * Quality-Kernel CRAP calculator.
 *
 * CRAP (Change Risk Anti-Patterns) for a function:
 *
 *     CRAP(m) = comp(m)^2 * (1 - cov(m))^3 + comp(m)
 *
 * where comp = cyclomatic complexity and cov = code coverage in [0, 1].
 * A function with high complexity and low coverage scores badly; full coverage
 * collapses the risky term to just its complexity. The cleaner's gate is CRAP <= 6.
 *
 * There is no single `crap4ts`: this composes the two signals your stack already
 * produces. Feed it a JSON array combining coverage and complexity per function:
 *
 *   [ { "name": "chargeCard", "file": "src/billing.ts", "complexity": 9,
 *       "coverage": 0.62 }, ... ]
 *
 * Generate that array from:
 *   - coverage: nyc / c8 (istanbul `coverage-final.json`) or `coverage.py`
 *   - complexity: eslint `complexity` rule, typhonjs-escomplex, or `radon cc` (Python)
 * (A small adapter per stack is the recommended way; see the plugin README.)
 *
 * Usage:
 *   node crap.mjs --input crap-input.json [--threshold 6] [--json]
 * Exit code: 0 if all functions are within the threshold, 1 if any exceed it.
 */
import { readFileSync } from "node:fs";

function parseArgs(argv) {
  const args = { input: null, threshold: 6, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") args.input = argv[++i];
    else if (a === "--threshold") args.threshold = Number(argv[++i]);
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function crap(complexity, coverage) {
  const c = Number(complexity);
  const cov = Math.max(0, Math.min(1, Number(coverage)));
  return c * c * Math.pow(1 - cov, 3) + c;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    console.error(
      "Usage: node crap.mjs --input <crap-input.json> [--threshold 6] [--json]"
    );
    process.exit(args.help ? 0 : 2);
  }

  let rows;
  try {
    rows = JSON.parse(readFileSync(args.input, "utf8"));
  } catch (err) {
    console.error(`[crap] cannot read ${args.input}: ${err.message}`);
    process.exit(2);
  }
  if (!Array.isArray(rows)) {
    console.error("[crap] input must be a JSON array of { name, file, complexity, coverage }");
    process.exit(2);
  }

  const scored = rows.map((r) => ({
    name: r.name ?? "<anon>",
    file: r.file ?? "",
    complexity: Number(r.complexity),
    coverage: Number(r.coverage),
    crap: Number(crap(r.complexity, r.coverage).toFixed(2)),
  }));
  scored.sort((a, b) => b.crap - a.crap);

  const violations = scored.filter((r) => r.crap > args.threshold);

  if (args.json) {
    console.log(JSON.stringify({ threshold: args.threshold, violations, all: scored }, null, 2));
  } else {
    for (const r of violations) {
      console.log(`CRAP ${r.crap}\t(c=${r.complexity}, cov=${r.coverage})\t${r.file} :: ${r.name}`);
    }
    console.log(
      `\n${violations.length} function(s) over CRAP ${args.threshold} of ${scored.length} scored.`
    );
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

main();

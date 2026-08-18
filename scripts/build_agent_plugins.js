#!/usr/bin/env node
/**
 * Build Agent Plugins (open standard) bundles from cli-tool/components/.
 *
 * Reads the curated bundle definitions in cli-tool/agent-plugins/bundles.yaml,
 * emits one spec-conformant plugin directory per bundle, and validates each
 * emitted bundle. This is the ONLY entry point for bundle generation — it
 * uses the single-source packer in cli-tool/src/plugin/.
 *
 * Usage:
 *   node scripts/build_agent_plugins.js [--out DIR] [--check]
 *
 *   --out DIR   Output directory (default: build/agent-plugins)
 *   --check     Build into a temp dir, validate, and discard (CI mode)
 */

const path = require('path');
const os = require('os');
const { createRequire } = require('module');

const REPO_ROOT = path.resolve(__dirname, '..');
// Resolve deps (fs-extra, js-yaml) from the CLI package, where they are
// declared — this script has no package.json of its own.
const cliRequire = createRequire(path.join(REPO_ROOT, 'cli-tool', 'package.json'));
const fs = cliRequire('fs-extra');
const yaml = cliRequire('js-yaml');
const { buildPlugin, validateBundle } = cliRequire('./src/plugin');

const COMPONENTS_DIR = path.join(REPO_ROOT, 'cli-tool', 'components');
const CONFIG_PATH = path.join(REPO_ROOT, 'cli-tool', 'agent-plugins', 'bundles.yaml');

function parseArgs(argv) {
  const args = { out: path.join(REPO_ROOT, 'build', 'agent-plugins'), check: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) args.out = path.resolve(argv[++i]);
    else if (argv[i] === '--check') args.check = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.check
    ? await fs.mkdtemp(path.join(os.tmpdir(), 'agent-plugins-check-'))
    : args.out;

  const config = yaml.load(await fs.readFile(CONFIG_PATH, 'utf8'));
  const defaults = config.defaults || {};
  const bundles = config.bundles || [];
  if (bundles.length === 0) {
    console.error('No bundles defined in', CONFIG_PATH);
    process.exit(1);
  }

  let failed = 0;
  for (const entry of bundles) {
    const spec = { ...defaults, ...entry };
    try {
      const result = await buildPlugin(spec, { componentsDir: COMPONENTS_DIR, outDir });
      const validation = await validateBundle(result.dir);
      const counts = [
        result.summary.skills.length && `${result.summary.skills.length} skills`,
        result.summary.mcpServers.length && `${result.summary.mcpServers.length} mcp servers`,
        ...Object.entries(result.summary.extensions)
          .filter(([, items]) => items.length)
          .map(([type, items]) => `${items.length} ${type}`),
      ].filter(Boolean).join(', ');

      const status = validation.valid ? 'OK ' : 'FAIL';
      console.log(`[${status}] ${result.name} — ${counts}`);
      for (const w of [...result.warnings, ...validation.warnings]) {
        console.log(`       warn: ${w}`);
      }
      for (const e of validation.errors) {
        console.log(`       ERROR: ${e}`);
      }
      if (!validation.valid) failed++;
    } catch (err) {
      console.log(`[FAIL] ${entry.name} — ${err.message}`);
      failed++;
    }
  }

  if (args.check) {
    await fs.remove(outDir);
  } else {
    console.log(`\nBundles written to ${outDir}`);
  }
  if (failed > 0) {
    console.error(`\n${failed} bundle(s) failed validation`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

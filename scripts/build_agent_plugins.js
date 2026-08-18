#!/usr/bin/env node
/**
 * Build Agent Plugins (open standard) bundles from cli-tool/components/.
 *
 * Reads the curated bundle definitions in cli-tool/agent-plugins/bundles.yaml,
 * emits one spec-conformant plugin directory per bundle, validates each
 * emitted bundle, and produces the distribution artifacts served from
 * www.aitmpl.com/agent-plugins/:
 *
 *   {out}/index.json               registry index (aitmpl format — the spec
 *                                  defines no registry; versioned from day one)
 *   {out}/{name}/                  exploded spec-conformant plugin tree
 *   {out}/{name}/files.json        per-file sha256 manifest for the CLI installer
 *   {out}/zips/{name}-{ver}.zip    with --zips (CI/deploy only, never committed)
 *
 * This is the ONLY entry point for bundle generation — it uses the
 * single-source packer in cli-tool/src/plugin/.
 *
 * Usage:
 *   node scripts/build_agent_plugins.js [--out DIR] [--publish] [--zips] [--check]
 *
 *   --out DIR   Output directory (default: build/agent-plugins, gitignored)
 *   --publish   Shortcut for --out dashboard/public/agent-plugins (committed)
 *   --zips      Also produce zips/{name}-{version}.zip (requires `zip`)
 *   --check     Build into a temp dir, validate, and discard (CI mode)
 */

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');

const REPO_ROOT = path.resolve(__dirname, '..');
// Resolve deps (fs-extra, js-yaml) from the CLI package, where they are
// declared — this script has no package.json of its own.
const cliRequire = createRequire(path.join(REPO_ROOT, 'cli-tool', 'package.json'));
const fs = cliRequire('fs-extra');
const yaml = cliRequire('js-yaml');
const { buildPlugin, validateBundle, SPEC_VERSION } = cliRequire('./src/plugin');

const COMPONENTS_DIR = path.join(REPO_ROOT, 'cli-tool', 'components');
const CONFIG_PATH = path.join(REPO_ROOT, 'cli-tool', 'agent-plugins', 'bundles.yaml');
const REGISTRY_VERSION = 1;

function parseArgs(argv) {
  const args = {
    out: path.join(REPO_ROOT, 'build', 'agent-plugins'),
    check: false,
    zips: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) args.out = path.resolve(argv[++i]);
    else if (argv[i] === '--publish') args.out = path.join(REPO_ROOT, 'dashboard', 'public', 'agent-plugins');
    else if (argv[i] === '--zips') args.zips = true;
    else if (argv[i] === '--check') args.check = true;
  }
  return args;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function walkFiles(dir, base = dir) {
  const out = [];
  for (const entry of (await fs.readdir(dir)).sort()) {
    const p = path.join(dir, entry);
    const stat = await fs.stat(p);
    if (stat.isDirectory()) {
      out.push(...(await walkFiles(p, base)));
    } else {
      out.push(path.relative(base, p).split(path.sep).join('/'));
    }
  }
  return out;
}

/** Per-file sha256 manifest so a dependency-free installer can fetch and
 * verify every file of the exploded tree. */
async function writeFilesManifest(bundleDir) {
  const files = [];
  for (const rel of await walkFiles(bundleDir)) {
    if (rel === 'files.json') continue;
    const buffer = await fs.readFile(path.join(bundleDir, rel));
    files.push({ path: rel, sha256: sha256(buffer), size: buffer.length });
  }
  const manifest = { registryVersion: REGISTRY_VERSION, files };
  await fs.writeJson(path.join(bundleDir, 'files.json'), manifest, { spaces: 2 });
  return manifest;
}

function buildZip(bundleDir, zipsDir, name, version) {
  fs.ensureDirSync(zipsDir);
  const zipPath = path.join(zipsDir, `${name}-${version}.zip`);
  fs.removeSync(zipPath);
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: bundleDir });
  const buffer = fs.readFileSync(zipPath);
  return { path: `zips/${name}-${version}.zip`, sha256: sha256(buffer), size: buffer.length };
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
  const registryEntries = [];

  for (const entry of bundles) {
    const spec = { ...defaults, ...entry };
    try {
      const result = await buildPlugin(spec, { componentsDir: COMPONENTS_DIR, outDir });
      const validation = await validateBundle(result.dir);
      const filesManifest = await writeFilesManifest(result.dir);

      const contents = {};
      if (result.summary.skills.length) contents.skills = result.summary.skills.length;
      if (result.summary.mcpServers.length) contents.mcpServers = result.summary.mcpServers.length;
      for (const [type, items] of Object.entries(result.summary.extensions)) {
        if (items.length) contents[type] = items.length;
      }

      const registryEntry = {
        name: result.name,
        version: spec.version || '1.0.0',
        description: spec.description || '',
        keywords: (spec.keywords || []).map(String),
        contents,
        components: (spec.components || []).map(String),
        path: `${result.name}/`,
        filesUrl: `${result.name}/files.json`,
        fileCount: filesManifest.files.length,
        totalSize: filesManifest.files.reduce((acc, f) => acc + f.size, 0),
      };
      if (args.zips) {
        const zip = buildZip(result.dir, path.join(outDir, 'zips'), result.name, registryEntry.version);
        registryEntry.zip = zip;
      }
      registryEntries.push(registryEntry);

      const counts = Object.entries(contents).map(([t, n]) => `${n} ${t}`).join(', ');
      const status = validation.valid ? 'OK ' : 'FAIL';
      console.log(`[${status}] ${result.name} — ${counts} (${registryEntry.fileCount} files)`);
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

  const registry = {
    registryVersion: REGISTRY_VERSION,
    specVersion: SPEC_VERSION,
    generated: new Date().toISOString(),
    homepage: 'https://www.aitmpl.com',
    note: 'Agent Plugins v1.0.0 defines no registry format; this index is the aitmpl.com registry format, versioned via registryVersion.',
    bundles: registryEntries.sort((a, b) => a.name.localeCompare(b.name)),
  };
  await fs.writeJson(path.join(outDir, 'index.json'), registry, { spaces: 2 });

  if (args.check) {
    await fs.remove(outDir);
    console.log('\nCheck mode: artifacts validated and discarded');
  } else {
    console.log(`\nRegistry + bundles written to ${outDir}`);
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

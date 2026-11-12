#!/usr/bin/env node
// Runs from prepublishOnly before every `npm publish`: packs the package exactly
// as npm will publish it and runs the prod smoke test's CLI checks against that
// tarball (a batch install of every component type into a temp folder, tracking
// off). 1.33.0 went out with every --skill install failing; this blocks that.
//
// Needs network (GitHub and www.aitmpl.com). Skip only knowingly:
//   CCT_SKIP_PREPUBLISH_SMOKE=1 npm publish ...

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.CCT_SKIP_PREPUBLISH_SMOKE === '1') {
  console.warn('prepublish-check: skipped (CCT_SKIP_PREPUBLISH_SMOKE=1)');
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(join(tmpdir(), 'cct-prepublish-'));
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });

try {
  const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', out, '--json'], { cwd: root, encoding: 'utf8' });
  if (pack.status !== 0) {
    console.error(pack.stderr);
    throw new Error('npm pack failed');
  }
  const tarball = join(out, JSON.parse(pack.stdout)[0].filename);
  console.log(`prepublish-check: smoke-testing ${tarball}`);

  const smoke = run(process.execPath, ['scripts/prod-smoke-test.mjs', '--only', 'cli', '--cli-tarball', tarball]);
  if (smoke.status !== 0) throw new Error('the CLI smoke test failed against the packed tarball: not publishing');
  console.log('prepublish-check: ok');
} catch (error) {
  console.error(`prepublish-check: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}

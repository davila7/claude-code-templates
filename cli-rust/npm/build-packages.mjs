#!/usr/bin/env node
// Assemble per-platform npm packages from prebuilt Rust binaries.
//
// Usage:
//   node build-packages.mjs <version> <dist-dir>
//
// <dist-dir> may contain EITHER the release tarballs `cct-<target>.tgz` (what
// build-rust-cli.yml uploads — each holds a single `cct`/`cct.exe`) OR the
// already-unpacked binaries `cct-<target>` / `cct-<target>.exe`. Produces
// `cli-rust/npm/platforms/<pkg>/` directories ready to `npm publish`, and
// rewrites the version in the main wrapper package + its optionalDependencies.

import {
  mkdirSync,
  mkdtempSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  chmodSync,
  existsSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the source binary for a target: prefer the release tarball
// (`cct-<target>.tgz`), extracting it to a temp dir; otherwise fall back to an
// unpacked `cct-<target>` binary in the dist dir.
function resolveSourceBinary(distDir, rustTarget, binName) {
  const tgz = join(distDir, `cct-${rustTarget}.tgz`);
  if (existsSync(tgz)) {
    const tmp = mkdtempSync(join(tmpdir(), 'cct-pkg-'));
    execFileSync('tar', ['-xzf', tgz, '-C', tmp]);
    return join(tmp, binName);
  }
  const isWin = binName.endsWith('.exe');
  return join(distDir, `cct-${rustTarget}${isWin ? '.exe' : ''}`);
}

// Rust target triple -> { pkg, os, cpu, rustTarget }
const TARGETS = [
  { pkg: '@davila7/cct-darwin-arm64', os: 'darwin', cpu: 'arm64', rustTarget: 'aarch64-apple-darwin' },
  { pkg: '@davila7/cct-darwin-x64',   os: 'darwin', cpu: 'x64',   rustTarget: 'x86_64-apple-darwin' },
  { pkg: '@davila7/cct-linux-x64',    os: 'linux',  cpu: 'x64',   rustTarget: 'x86_64-unknown-linux-gnu' },
  { pkg: '@davila7/cct-linux-arm64',  os: 'linux',  cpu: 'arm64', rustTarget: 'aarch64-unknown-linux-gnu' },
  { pkg: '@davila7/cct-win32-x64',    os: 'win32',  cpu: 'x64',   rustTarget: 'x86_64-pc-windows-msvc' },
];

const version = process.argv[2];
const distDir = process.argv[3];
if (!version || !distDir) {
  console.error('Usage: node build-packages.mjs <version> <dist-dir>');
  process.exit(1);
}

const platformsRoot = join(__dirname, 'platforms');

for (const t of TARGETS) {
  const isWin = t.os === 'win32';
  const binName = isWin ? 'cct.exe' : 'cct';
  const srcBin = resolveSourceBinary(distDir, t.rustTarget, binName);
  const pkgDir = join(platformsRoot, t.pkg.replace('/', '__'));
  const binDir = join(pkgDir, 'bin');
  mkdirSync(binDir, { recursive: true });

  const destBin = join(binDir, binName);
  copyFileSync(srcBin, destBin);
  if (!isWin) chmodSync(destBin, 0o755);

  const pkgJson = {
    name: t.pkg,
    version,
    description: `Prebuilt cct binary for ${t.os}/${t.cpu}`,
    os: [t.os],
    cpu: [t.cpu],
    files: [`bin/${binName}`],
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/davila7/claude-code-templates.git',
    },
  };
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n');
  console.log(`✓ assembled ${t.pkg} (${t.rustTarget})`);
}

// Sync version into the main wrapper package + optionalDependencies.
const mainPkgPath = join(__dirname, 'cct', 'package.json');
const mainPkg = JSON.parse(readFileSync(mainPkgPath, 'utf8'));
mainPkg.version = version;
for (const t of TARGETS) mainPkg.optionalDependencies[t.pkg] = version;
writeFileSync(mainPkgPath, JSON.stringify(mainPkg, null, 2) + '\n');
console.log(`✓ synced version ${version} into wrapper package`);

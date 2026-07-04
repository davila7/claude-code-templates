#!/usr/bin/env node
'use strict';

// Thin launcher shim (esbuild/Biome pattern). Resolves the prebuilt Rust
// binary for the current platform from an optional dependency package and
// execs it, forwarding all args and stdio. The user keeps running
// `npx claude-code-templates@latest ...` exactly as before.

const { spawnSync } = require('child_process');

const PKG_BY_KEY = {
  'darwin-arm64': '@davila7/cct-darwin-arm64',
  'darwin-x64': '@davila7/cct-darwin-x64',
  'linux-x64': '@davila7/cct-linux-x64',
  'linux-arm64': '@davila7/cct-linux-arm64',
  'win32-x64': '@davila7/cct-win32-x64',
};

function resolveBinary() {
  const key = `${process.platform}-${process.arch}`;
  const pkg = PKG_BY_KEY[key];
  if (!pkg) {
    throw new Error(
      `Unsupported platform "${key}". Supported: ${Object.keys(PKG_BY_KEY).join(', ')}`
    );
  }
  const binName = process.platform === 'win32' ? 'cct.exe' : 'cct';
  try {
    return require.resolve(`${pkg}/bin/${binName}`);
  } catch (_) {
    throw new Error(
      `The platform package "${pkg}" is not installed.\n` +
        `Try reinstalling: npm install -g claude-code-templates\n` +
        `or download a binary from https://github.com/davila7/claude-code-templates/releases`
    );
  }
}

try {
  const bin = resolveBinary();
  const result = spawnSync(bin, process.argv.slice(2), { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status === null ? 1 : result.status);
} catch (err) {
  console.error(`cct: ${err.message}`);
  process.exit(1);
}

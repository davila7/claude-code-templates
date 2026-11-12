import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPONENT_TYPES,
  VALID_COMMANDS,
  validateCommandData,
  validateOutcomeData,
} from '../src/lib/api/usage-tracking.ts';

const CLI_SRC = fileURLToPath(new URL('../../cli-tool/src', import.meta.url));

function cliSources(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...cliSources(full));
    else if (name.endsWith('.js')) files.push(full);
  }
  return files;
}

// First string argument of every call to `method` in the CLI sources.
function sentByCli(method: string): Set<string> {
  const pattern = new RegExp(`${method}\\(\\s*'([^']+)'`, 'g');
  const names = new Set<string>();
  for (const file of cliSources(CLI_SRC)) {
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) names.add(match[1]);
  }
  return names;
}

test('every command name the CLI reports is accepted by /api/track-command-usage', () => {
  const sent = sentByCli('trackCommandExecution');
  assert.ok(sent.size >= 5, `expected the CLI to report several commands, found ${[...sent]}`);
  for (const command of sent) {
    assert.ok((VALID_COMMANDS as readonly string[]).includes(command), `CLI sends "${command}", endpoint rejects it`);
  }
});

test('every component type the CLI reports is accepted by the download and outcome endpoints', () => {
  const sent = new Set([...sentByCli('trackDownload'), ...sentByCli('trackInstallationOutcome')]);
  assert.ok(sent.has('mod') && sent.has('loop'), `expected mod and loop among ${[...sent]}`);
  for (const type of sent) {
    assert.ok((COMPONENT_TYPES as readonly string[]).includes(type), `CLI sends type "${type}", endpoints reject it`);
  }
});

test('names sent by older CLI versions stay valid', () => {
  for (const command of ['plugins', 'sandbox', 'studio', 'skills-manager', 'teams', '2025-year-in-review']) {
    assert.deepEqual(validateCommandData({ command }), { valid: true, error: null });
  }
});

test('validateCommandData rejects missing, unknown and non-string names', () => {
  assert.equal(validateCommandData({}).valid, false);
  assert.equal(validateCommandData({ command: 'rm -rf' }).valid, false);
  assert.equal(validateCommandData({ command: ['chats'] }).valid, false);
});

test('validateOutcomeData accepts mods and loops and checks every field', () => {
  assert.equal(validateOutcomeData({ componentType: 'mod', componentName: 'ui/stack-viewer', outcome: 'success' }).valid, true);
  assert.equal(validateOutcomeData({ componentType: 'loop', componentName: 'engineering/docs-sweep-loop', outcome: 'failure' }).valid, true);
  assert.equal(validateOutcomeData({ componentType: 'analytics', componentName: 'x', outcome: 'success' }).valid, false);
  assert.equal(validateOutcomeData({ componentType: 'agent', componentName: 'x', outcome: 'maybe' }).valid, false);
  assert.equal(validateOutcomeData({ componentType: 'agent', componentName: 'x'.repeat(256), outcome: 'success' }).valid, false);
  assert.equal(validateOutcomeData({ componentType: 'agent', outcome: 'success' }).valid, false);
});

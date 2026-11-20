import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isGatewayLayout, loadConfig } from '../lib/config.mjs';

const JEV_KEYS = ['endpoint', 'model', 'timeoutMs'];

// Convert only retired keys: the 0.8 gateway settings and the 1.1 `jev` section, which becomes `classifiers.jev`.
// All routing, pricing, cache and policy overrides survive unchanged.
export function migrateConfig(file) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) throw new Error('router.json must be an object');
  const next = structuredClone(file);
  if (Object.hasOwn(next, 'gateway')) {
    const gateway = next.gateway;
    if (!gateway || typeof gateway !== 'object' || Array.isArray(gateway)) throw new Error('gateway must be an object');
    const keys = ['port', 'alias', 'baselineTier', 'auxiliaryTier', 'idleShutdownMs'];
    for (const key of Object.keys(gateway))
      if (!keys.includes(key)) throw new Error(`gateway.${key} is not a known key`);
    if (gateway.baselineTier !== undefined) {
      if (next.baselineTier !== undefined && next.baselineTier !== gateway.baselineTier)
        throw new Error('baselineTier conflicts with gateway.baselineTier');
      next.baselineTier = gateway.baselineTier;
    }
    delete next.gateway;
  }
  delete next.log;
  if (Object.hasOwn(next, 'jev')) {
    const jev = next.jev;
    if (!jev || typeof jev !== 'object' || Array.isArray(jev)) throw new Error('jev must be an object');
    for (const key of Object.keys(jev)) if (!JEV_KEYS.includes(key)) throw new Error(`jev.${key} is not a known key`);
    if (Object.keys(jev).length) next.classifiers = { ...next.classifiers, jev: { ...next.classifiers?.jev, ...jev } };
    delete next.jev;
  }
  if (next.models && typeof next.models === 'object' && !Array.isArray(next.models)) {
    for (const model of Object.values(next.models)) {
      if (model && typeof model === 'object' && !Array.isArray(model)) {
        delete model.features;
        delete model.maxOutput;
      }
    }
  }
  loadConfig({ userFile: next });
  return next;
}

export async function migrateFile(path) {
  const original = await readFile(path, 'utf8');
  const file = JSON.parse(original);
  const next = migrateConfig(file);
  if (JSON.stringify(file) === JSON.stringify(next)) return null;
  // Named for the layout it keeps, so a 1.1 migration never collides with a 0.8 backup already on disk.
  const backup = `${path}.${isGatewayLayout(file) ? 'v0.8' : 'v1.1'}.backup`;
  await writeFile(backup, original, { flag: 'wx', mode: 0o600 });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
  return backup;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('usage: node scripts/migrate-config.mjs /path/to/router.json');
    const path = resolve(process.argv[2]);
    const backup = await migrateFile(path);
    console.log(backup ? `Migrated ${path}; backup: ${backup}` : `Already native: ${path}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

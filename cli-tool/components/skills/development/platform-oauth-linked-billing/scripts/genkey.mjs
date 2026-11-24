#!/usr/bin/env node
// Generates the ES256 key pair a backend uses to sign Claude Platform OAuth assertions.
//
//   node genkey.mjs --prefix myapp-backend --out ../secrets/priv.pem
//
// Writes the private key (PKCS#8 PEM, mode 0600) to --out and prints only public data:
// the kid and the JWKS array to paste in Console (Workload identity > Issuers > Inline keys).
// The private key is never printed. Load it into your secret store, then delete the file.
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const prefix = opt('prefix', 'backend').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'backend';
const outArg = opt('out');
if (!outArg) {
  console.error('Usage: node genkey.mjs --out <path outside the repository>/priv.pem [--prefix myapp-backend]');
  process.exit(1);
}
const out = resolve(outArg);

// Refuse a path git would track: exit 0 = ignored, 1 = inside a work tree and not ignored, 128 = not a repo.
const check = spawnSync('git', ['check-ignore', '-q', out], { cwd: resolve(out, '..') });
if (check.status === 1) {
  console.error('Refusing to write the private key inside a git work tree where it is not ignored: ' + out);
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const kid = prefix + '-' + randomUUID().slice(0, 8);
const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' };

try {
  writeFileSync(out, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
} catch (err) {
  console.error(err.code === 'EEXIST' ? 'Refusing to overwrite ' + out + '. Choose another --out path.' : 'Cannot write ' + out + ': ' + err.message);
  process.exit(1);
}

console.log('kid: ' + kid);
console.log('JWKS array (paste exactly this in Console, not {"keys": ...}):');
console.log(JSON.stringify([jwk]));
console.error('Private key written to ' + out + ' (mode 600). Do not commit it; load it into your secret store and delete the file.');

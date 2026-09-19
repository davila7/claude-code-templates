'use strict';

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

function readJson(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  return {
    absolutePath,
    data: JSON.parse(fs.readFileSync(absolutePath, 'utf8')),
    relativePath,
  };
}

const rootPackage = readJson('package.json');
const expectedVersion = rootPackage.data.version;
const versionFiles = [
  readJson('package-lock.json'),
  readJson('cli-tool/package.json'),
  readJson('cli-tool/package-lock.json'),
];

const mismatches = [];

for (const file of versionFiles) {
  const fields = [['version', file.data]];

  if (file.relativePath.endsWith('package-lock.json')) {
    const lockRoot = file.data.packages && file.data.packages[''];
    if (!lockRoot) {
      throw new Error(`${file.relativePath} does not contain packages[""]`);
    }
    fields.push(['packages[""].version', lockRoot]);
  }

  let changed = false;
  for (const [field, owner] of fields) {
    if (owner.version !== expectedVersion) {
      mismatches.push(
        `${file.relativePath} ${field}: ${owner.version} (expected ${expectedVersion})`
      );
      owner.version = expectedVersion;
      changed = true;
    }
  }

  if (changed && !checkOnly) {
    fs.writeFileSync(file.absolutePath, `${JSON.stringify(file.data, null, 2)}\n`);
  }
}

if (mismatches.length > 0 && checkOnly) {
  console.error('Package versions are out of sync:');
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  console.error('Run `node scripts/sync-package-versions.js` to synchronize them.');
  process.exit(1);
}

if (mismatches.length > 0) {
  console.log(`Synchronized package versions to ${expectedVersion}.`);
} else {
  console.log(`Package versions are synchronized at ${expectedVersion}.`);
}

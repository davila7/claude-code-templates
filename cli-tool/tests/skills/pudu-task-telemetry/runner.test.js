const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');

// Keep dependency-free ESM behavior tests runnable directly and discoverable by upstream Jest.
test('Pudu task telemetry contract and installation tests', async () => {
  const result = await promisify(execFile)(process.execPath, [
    '--test', '--test-reporter=tap', path.join(__dirname, 'core.test.mjs')
  ], { timeout: 20000, maxBuffer: 1024 * 1024 });
  expect(result.stdout).toMatch(/# fail 0/);
}, 25000);

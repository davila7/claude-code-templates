import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  KNOWN_AGENTS,
  clientSignals,
  insertWithClientSignals,
} from '../src/lib/api/download-client-signals.ts';

const require = createRequire(import.meta.url);
const cli = require('../../cli-tool/src/agent-detection.js');

test('endpoint and CLI share the same agent list', () => {
  assert.deepEqual([...KNOWN_AGENTS].sort(), [...cli.KNOWN_AGENTS].sort());
});

test('old CLI payloads store three nulls', () => {
  assert.deepEqual(clientSignals({}), { client_agent: null, client_entrypoint: null, client_is_tty: null });
});

test('values outside the contract are clamped', () => {
  assert.deepEqual(clientSignals({ agent: 'someone@example.com', entrypoint: 'a b/c', isTty: 'yes' }), {
    client_agent: 'other',
    client_entrypoint: null,
    client_is_tty: null,
  });
  assert.equal(clientSignals({ entrypoint: 'x'.repeat(33) }).client_entrypoint, null);
  assert.deepEqual(clientSignals({ agent: 'claude', entrypoint: 'sdk-ts', isTty: false }), {
    client_agent: 'claude',
    client_entrypoint: 'sdk-ts',
    client_is_tty: false,
  });
});

const row = { component_type: 'agents', component_name: 'x' };

test('missing columns (PGRST204, 42703) retry without the client signals', async () => {
  for (const code of ['PGRST204', '42703']) {
    const calls: Record<string, unknown>[] = [];
    const result = await insertWithClientSignals(
      async (values) => {
        calls.push(values);
        return calls.length === 1 ? { error: { code, message: 'missing column' } } : { error: null };
      },
      row,
      { agent: 'claude', isTty: false }
    );
    assert.equal(result.error, null);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].client_agent, 'claude');
    assert.deepEqual(calls[1], row);
  }
});

test('other insert errors are not retried', async () => {
  let calls = 0;
  const result = await insertWithClientSignals(
    async () => {
      calls++;
      return { error: { code: '23514', message: 'check violation' } };
    },
    row,
    {}
  );
  assert.equal(calls, 1);
  assert.equal(result.error?.code, '23514');
});

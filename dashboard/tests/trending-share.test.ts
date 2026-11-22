import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgeMarkdown, findShareEntry, isRising, pctChange, safePath, shareEntries, shareText, xShareUrl,
} from '../src/lib/trending-share.ts';
import { badgeSvg, compact } from '../scripts/generate-badges.mjs';

const item = (over: Record<string, unknown>) => ({
  id: 'agent-x', name: 'x', category: 'c', downloadsToday: 0, downloadsWeek: 0, downloadsMonth: 0, downloadsTotal: 0, ...over,
});

const data = {
  trending: {
    all: [item({ id: 'agent-database-architect', name: 'database-architect', path: 'database/database-architect' })],
    agents: [
      item({ id: 'agent-frontend-developer', name: 'frontend-developer', category: 'development-team', path: 'development-team/frontend-developer', installersWeek: 300, installersPrevWeek: 280, downloadsTotal: 42000 }),
      item({ id: 'agent-database-architect', name: 'database-architect', category: 'database', path: 'database/database-architect', installersWeek: 349, installersPrevWeek: 58 }),
      item({ id: 'agent-no-path', name: 'no-path' }),
    ],
    widgets: [item({ id: 'widget-a', name: 'a', path: 'x/a' })],
  },
  rising: [
    { type: 'agents', name: 'database-architect', category: 'database', path: 'database/database-architect', installersWeek: 349, installersPrevWeek: 58, downloadsTotal: 12900 },
  ],
};

test('pctChange rounds and has no base for zero', () => {
  assert.equal(pctChange(349, 58), 502);
  assert.equal(pctChange(90, 100), -10);
  assert.equal(pctChange(10, 0), null);
});

test('isRising needs enough installers and a real gain', () => {
  assert.equal(isRising({ installersWeek: 24, installersPrevWeek: 0 }), false);
  assert.equal(isRising({ installersWeek: 25, installersPrevWeek: 0 }), true);
  assert.equal(isRising({ installersWeek: 300, installersPrevWeek: 280 }), false);
  assert.equal(isRising({ installersWeek: 350, installersPrevWeek: 280 }), true);
  assert.equal(isRising({}), false);
});

test('safePath accepts catalog paths only', () => {
  assert.equal(safePath('database/database-architect'), 'database/database-architect');
  assert.equal(safePath('../etc/passwd'), null);
  assert.equal(safePath('a/<script>'), null);
  assert.equal(safePath('a//b'), null);
  assert.equal(safePath(undefined), null);
});

test('shareEntries: rising rank wins, per-type rank otherwise, no path or unknown type is skipped', () => {
  const entries = shareEntries(data);
  assert.deepEqual(entries.map((e) => `${e.type}/${e.path} ${e.headline}`), [
    'agents/database/database-architect #1 rising this week',
    'agents/development-team/frontend-developer #1 agent this week',
  ]);
  assert.equal(findShareEntry(data, 'agents', 'nope/x'), null);
  assert.equal(findShareEntry(data, 'agents', 'development-team/frontend-developer')?.downloadsTotal, 42000);
});

test('share text says installers, not developers', () => {
  const e = findShareEntry(data, 'agents', 'database/database-architect')!;
  assert.equal(shareText(e), 'Database Architect is #1 rising this week on Claude Code Templates. 349 unique installers in the last 7 days.');
  assert.match(xShareUrl('a b', 'https://www.aitmpl.com/trending'), /^https:\/\/x\.com\/intent\/post\?text=a%20b&url=https%3A%2F%2F/);
});

test('badge markdown links the badge to the component page', () => {
  assert.equal(
    badgeMarkdown('https://www.aitmpl.com', 'agents', 'database/database-architect'),
    '[![aitmpl](https://www.aitmpl.com/badge/agents/database/database-architect.svg)](https://www.aitmpl.com/component/agents/database/database-architect)',
  );
  assert.equal(compact(12900), '12.9k');
  assert.equal(compact(999), '999');
  assert.match(badgeSvg('12.9k'), /aria-label="aitmpl installs: 12\.9k"/);
});

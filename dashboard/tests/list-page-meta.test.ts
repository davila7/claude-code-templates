import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { skillsPageMeta } from '../src/lib/list-page-meta.ts';

test('skills meta uses the count in title, description and H1', () => {
  const meta = skillsPageMeta(918);
  assert.equal(meta.title, 'Claude Skills: 918 Open-Source Skills for Claude Code');
  assert.match(meta.description, /^Browse 918 open-source Claude skills/);
  assert.equal(meta.h1, '918 Claude Skills');
});

test('skills meta formats thousands', () => {
  assert.equal(skillsPageMeta(1204).h1, '1,204 Claude Skills');
});

test('skills meta drops the figure when the count is missing', () => {
  for (const c of [undefined, 0, Number.NaN]) {
    const meta = skillsPageMeta(c);
    assert.doesNotMatch(meta.title, /\d/);
    assert.equal(meta.h1, 'Claude Skills');
  }
});

test('skills title stays within what Google shows, with the current count', () => {
  const counts = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'counts.json'), 'utf-8'));
  const meta = skillsPageMeta(counts.skills);
  assert.ok(meta.title.length <= 60, meta.title);
  assert.ok(meta.description.length <= 220, String(meta.description.length));
});

import { homePageMeta } from '../src/lib/list-page-meta.ts';
import { totalComponents } from '../src/lib/agent-readiness.ts';

test('home meta rounds the total down to the ten', () => {
  const meta = homePageMeta(1987);
  assert.equal(meta.title, 'Claude Code Templates: 1,980+ Agents, Commands, Skills & MCP Integrations');
  assert.match(meta.description, /^Browse and install 1,980\+ pre-built components/);
  assert.match(meta.schemaDescription, /Over 1,980 agents/);
});

test('home meta drops the figure when the total is missing', () => {
  for (const c of [undefined, 0, Number.NaN]) {
    assert.doesNotMatch(homePageMeta(c).title, /\d/);
  }
});

test('home meta with the current counts', () => {
  const counts = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'counts.json'), 'utf-8'));
  const meta = homePageMeta(totalComponents(counts));
  assert.match(meta.title, /\d,\d{3}\+/);
  assert.ok(meta.description.length <= 220, String(meta.description.length));
});

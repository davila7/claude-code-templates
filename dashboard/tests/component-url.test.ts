import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentPath, pluralType } from '../src/lib/component-url.ts';

test('pluralType keeps plurals and pluralizes singulars', () => {
  assert.equal(pluralType('agent'), 'agents');
  assert.equal(pluralType('skills'), 'skills');
  assert.equal(pluralType('mcp'), 'mcps');
});

test('componentPath builds the sitemap form', () => {
  assert.equal(componentPath('agent', 'development-team/frontend-developer.md'), '/component/agents/development-team/frontend-developer');
  assert.equal(componentPath('mcps', 'audio/elevenlabs.json'), '/component/mcps/audio/elevenlabs');
  assert.equal(componentPath('skill', 'development/brainstorming'), '/component/skills/development/brainstorming');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionInstallCommand, collectionItemType } from '../src/lib/collection-command.ts';

// Rows as the collections API stores them: the catalog's own type and path.
const item = (component_type: string, component_path: string) => ({ component_type, component_path });

test('Install All covers mods, loops and plugins, with paths as the CLI takes them', () => {
  const items = [
    item('agent', 'development-team/frontend-developer.md'),
    item('mod', 'security/secret-redactor'),
    item('loop', 'engineering/docs-sweep-loop.md'),
    item('plugin', 'productivity/champion-kit'),
    item('hook', 'automation/simple-notifications.json'),
    item('agent', 'development-team/backend-developer.md'),
  ];
  assert.equal(
    collectionInstallCommand(items),
    'npx claude-code-templates@latest'
      + ' --agent development-team/frontend-developer,development-team/backend-developer'
      + ' --mod security/secret-redactor'
      + ' --loop engineering/docs-sweep-loop'
      + ' --plugin productivity/champion-kit'
      + ' --hook automation/simple-notifications',
  );
});

test('a mod saved as a function hook before the rename installs as a mod', () => {
  assert.equal(collectionItemType('function-hook'), 'mods');
  assert.equal(
    collectionInstallCommand([item('function-hook', 'security/secret-redactor')]),
    'npx claude-code-templates@latest --mod security/secret-redactor',
  );
});

test('a repository path loses its cli-tool/components/<type>/ prefix', () => {
  assert.equal(
    collectionInstallCommand([item('agents', 'cli-tool/components/agents/development-team/frontend-developer.md')]),
    'npx claude-code-templates@latest --agent development-team/frontend-developer',
  );
});

test('a type the CLI cannot install is left out', () => {
  assert.equal(collectionInstallCommand([item('sandbox', 'e2b/claude-code-sandbox')]), 'npx claude-code-templates@latest');
});

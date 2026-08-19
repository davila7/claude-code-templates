/**
 * Tests for the Agent Plugins (open standard) packer.
 *
 * Uses hermetic fixtures in a temp dir — never depends on the real
 * cli-tool/components/ catalog, so catalog churn cannot break the suite.
 */

const os = require('os');
const path = require('path');
const fs = require('fs-extra');

const { buildPlugin, validateBundle, EXTENSION_NAMESPACE, PLUGIN_SCHEMA, MCP_SCHEMA } = require('../../src/plugin');
const { normalizePluginName, normalizeSkillName } = require('../../src/plugin/normalize');

describe('Agent Plugins packer', () => {
  let tmpDir;
  let componentsDir;
  let outDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ap-packer-test-'));
    componentsDir = path.join(tmpDir, 'components');
    outDir = path.join(tmpDir, 'out');

    // Skill with name != dir, non-standard keys, and a script file
    await fs.outputFile(
      path.join(componentsDir, 'skills', 'testing', 'pdf-tools', 'SKILL.md'),
      [
        '---',
        'name: PDF Tools Pro',
        'description: Extract and merge PDFs.',
        'license: MIT',
        'version: 2.0.0',
        'tags: [pdf, documents]',
        '---',
        '',
        '# PDF Tools',
        'Run scripts/extract.py',
      ].join('\n')
    );
    await fs.outputFile(
      path.join(componentsDir, 'skills', 'testing', 'pdf-tools', 'scripts', 'extract.py'),
      '#!/usr/bin/env python3\nprint("ok")\n'
    );

    // MCP with non-standard description and placeholder env
    await fs.outputJson(path.join(componentsDir, 'mcps', 'testing', 'fake-db.json'), {
      mcpServers: {
        'fake-db': {
          description: 'A fake database server',
          command: 'npx',
          args: ['-y', 'fake-db-server'],
          env: { FAKE_TOKEN: '<personal-access-token>' },
        },
      },
    });

    // Agent (byte-exact carry)
    await fs.outputFile(
      path.join(componentsDir, 'agents', 'testing', 'db-expert.md'),
      '---\nname: db-expert\ndescription: DB expert\n---\n\nYou are a DB expert.\n'
    );

    // Command referenced only by the loop (tests auto-inlining)
    await fs.outputFile(
      path.join(componentsDir, 'commands', 'testing', 'run-checks.md'),
      '---\ndescription: Run checks\n---\n\nRun the checks.\n'
    );

    // Hook with a sibling script
    await fs.outputJson(path.join(componentsDir, 'hooks', 'testing', 'notify.json'), {
      description: 'Notify on stop',
      hooks: { Stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo done' }] }] },
    });
    await fs.outputFile(path.join(componentsDir, 'hooks', 'testing', 'notify.sh'), '#!/bin/sh\necho done\n');

    // Loop referencing the agent and the command
    await fs.outputFile(
      path.join(componentsDir, 'loops', 'testing', 'check-loop.md'),
      [
        '---',
        'name: check-loop',
        'description: Keep checks green.',
        'components: [agent:testing/db-expert, command:testing/run-checks]',
        '---',
        '',
        '# Check Loop',
      ].join('\n')
    );
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  function build(spec) {
    return buildPlugin(spec, { componentsDir, outDir });
  }

  test('builds a spec-conformant bundle from mixed components', async () => {
    const result = await build({
      name: 'Test_Pack!',
      version: '1.2.3',
      description: 'A test pack.',
      keywords: ['test'],
      components: [
        'skill:testing/pdf-tools',
        'mcp:testing/fake-db',
        'agent:testing/db-expert',
        'hook:testing/notify',
      ],
    });

    expect(result.name).toBe('test-pack');
    const manifest = await fs.readJson(path.join(result.dir, 'plugin.json'));
    expect(manifest.$schema).toBe(PLUGIN_SCHEMA);
    expect(manifest.name).toBe('test-pack');
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.extensions[EXTENSION_NAMESPACE].agents).toEqual([
      `./${EXTENSION_NAMESPACE}/agents/testing/db-expert.md`,
    ]);
    expect(manifest.extensions[EXTENSION_NAMESPACE].mcpDescriptions['fake-db']).toBe('A fake database server');
  });

  test('normalizes skill frontmatter: name matches dir, extras folded into metadata', async () => {
    const result = await build({
      name: 'skills-only',
      components: ['skill:testing/pdf-tools'],
    });

    const skillMd = await fs.readFile(path.join(result.dir, 'skills', 'pdf-tools', 'SKILL.md'), 'utf8');
    expect(skillMd).toMatch(/^---\nname: pdf-tools\n/);
    expect(skillMd).toContain('description: Extract and merge PDFs.');
    expect(skillMd).toMatch(/metadata:\n/);
    expect(skillMd).toContain("version: 2.0.0");
    expect(skillMd).toContain('original-name: PDF Tools Pro');
    expect(skillMd).not.toMatch(/^tags:/m);
    // Supporting files travel with the skill
    expect(await fs.pathExists(path.join(result.dir, 'skills', 'pdf-tools', 'scripts', 'extract.py'))).toBe(true);
  });

  test('merges MCP configs stripping non-standard description and inferring transport', async () => {
    const result = await build({
      name: 'mcp-only',
      components: ['mcp:testing/fake-db'],
    });

    const mcp = await fs.readJson(path.join(result.dir, 'mcp.json'));
    expect(mcp.$schema).toBe(MCP_SCHEMA);
    expect(mcp.mcpServers['fake-db'].description).toBeUndefined();
    expect(mcp.mcpServers['fake-db'].type).toBe('stdio');
    expect(mcp.mcpServers['fake-db'].env.FAKE_TOKEN).toBe('<personal-access-token>');
  });

  test('inlines loop-referenced components (self-containment)', async () => {
    const result = await build({
      name: 'loop-pack',
      components: ['loop:testing/check-loop'],
    });

    expect(result.summary.extensions.loops).toEqual(['testing/check-loop']);
    expect(result.summary.extensions.agents).toEqual(['testing/db-expert']);
    expect(result.summary.extensions.commands).toEqual(['testing/run-checks']);
    expect(
      await fs.pathExists(path.join(result.dir, EXTENSION_NAMESPACE, 'agents', 'testing', 'db-expert.md'))
    ).toBe(true);
  });

  test('carries hook sibling scripts into the extension namespace', async () => {
    const result = await build({
      name: 'hook-pack',
      components: ['hook:testing/notify'],
    });
    expect(
      await fs.pathExists(path.join(result.dir, EXTENSION_NAMESPACE, 'hooks', 'testing', 'notify.sh'))
    ).toBe(true);
  });

  test('emits a dual Claude Code native manifest', async () => {
    const result = await build({
      name: 'dual-pack',
      components: ['skill:testing/pdf-tools', 'mcp:testing/fake-db', 'agent:testing/db-expert'],
    });
    const native = await fs.readJson(path.join(result.dir, '.claude-plugin', 'plugin.json'));
    expect(native.name).toBe('dual-pack');
    expect(native.skills).toEqual(['./skills/pdf-tools']);
    expect(native.agents).toEqual([`./${EXTENSION_NAMESPACE}/agents/testing/db-expert.md`]);
    expect(native.mcpServers['fake-db'].command).toBe('npx');
  });

  test('validateBundle passes for emitted bundles and rejects a broken manifest', async () => {
    const result = await build({
      name: 'valid-pack',
      components: ['skill:testing/pdf-tools', 'mcp:testing/fake-db'],
    });
    const ok = await validateBundle(result.dir);
    expect(ok.errors).toEqual([]);
    expect(ok.valid).toBe(true);

    await fs.writeJson(path.join(result.dir, 'plugin.json'), { name: 'Bad Name!!' });
    const bad = await validateBundle(result.dir);
    expect(bad.valid).toBe(false);
  });

  test('rejects path traversal in component tokens', async () => {
    await expect(
      build({ name: 'evil', components: ['agent:../../../etc/passwd'] })
    ).rejects.toThrow(/clean relative path/);
  });

  test('name normalization follows the spec charset', () => {
    expect(normalizePluginName('Browser_Automation')).toBe('browser-automation');
    expect(normalizePluginName('acme.tools')).toBe('acme.tools');
    expect(normalizeSkillName('PDF Processing Pro')).toBe('pdf-processing-pro');
  });
});

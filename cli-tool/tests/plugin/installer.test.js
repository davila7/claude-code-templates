/**
 * Tests for the Agent Plugins bundle installer (src/plugin-installer.js).
 *
 * A real bundle is built with the packer into a temp dir; global.fetch is
 * stubbed to serve the registry, manifests, and files from that dir — no
 * network, no dependency on the live registry.
 */

process.env.CCT_NO_TRACKING = 'true'; // keep tests network-silent

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');

const { buildPlugin } = require('../../src/plugin');
const { installIndividualPlugin, mergeMcpServers, isSafeRelativePath } = require('../../src/plugin-installer');

const REGISTRY = 'https://registry.test/agent-plugins';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function walkFiles(dir, base = dir) {
  const out = [];
  for (const entry of (await fs.readdir(dir)).sort()) {
    const p = path.join(dir, entry);
    if ((await fs.stat(p)).isDirectory()) out.push(...(await walkFiles(p, base)));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

describe('Agent Plugins installer', () => {
  let tmpDir;
  let bundleDir;
  let targetDir;
  let registryIndex;
  let filesManifest;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    process.env.CCT_PLUGIN_REGISTRY_URL = REGISTRY;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ap-installer-test-'));
    targetDir = path.join(tmpDir, 'project');
    await fs.ensureDir(targetDir);

    // Build a real bundle with the packer
    const componentsDir = path.join(tmpDir, 'components');
    await fs.outputFile(
      path.join(componentsDir, 'skills', 'testing', 'pdf-tools', 'SKILL.md'),
      '---\nname: pdf-tools\ndescription: Extract PDFs.\n---\n\n# PDF Tools\n'
    );
    await fs.outputJson(path.join(componentsDir, 'mcps', 'testing', 'fake-db.json'), {
      mcpServers: {
        'fake-db': { description: 'Fake DB', command: 'npx', args: ['-y', 'fake-db'] },
      },
    });
    await fs.outputFile(
      path.join(componentsDir, 'agents', 'testing', 'db-expert.md'),
      '---\nname: db-expert\ndescription: DB expert\n---\n\nExpert.\n'
    );
    const built = await buildPlugin(
      { name: 'test-pack', version: '1.0.0', description: 'Test pack',
        components: ['skill:testing/pdf-tools', 'mcp:testing/fake-db', 'agent:testing/db-expert'] },
      { componentsDir, outDir: path.join(tmpDir, 'out') }
    );
    bundleDir = built.dir;

    // files.json + registry index, same shape the build script emits
    const files = [];
    for (const rel of await walkFiles(bundleDir)) {
      const buffer = await fs.readFile(path.join(bundleDir, rel));
      files.push({ path: rel, sha256: sha256(buffer), size: buffer.length });
    }
    filesManifest = { registryVersion: 1, files };
    await fs.writeJson(path.join(bundleDir, 'files.json'), filesManifest);
    registryIndex = {
      registryVersion: 1,
      specVersion: '1.0.0',
      bundles: [{ name: 'test-pack', version: '1.0.0', path: 'test-pack/' }],
    };

    global.fetch = jest.fn(async (url) => {
      const notFound = { ok: false, status: 404, statusText: 'Not Found' };
      if (!String(url).startsWith(REGISTRY)) return notFound;
      const rel = String(url).slice(REGISTRY.length + 1);
      if (rel === 'index.json') {
        return { ok: true, status: 200, json: async () => registryIndex };
      }
      if (!rel.startsWith('test-pack/')) return notFound;
      const filePath = path.join(bundleDir, rel.slice('test-pack/'.length));
      if (!(await fs.pathExists(filePath))) return notFound;
      const buffer = await fs.readFile(filePath);
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(buffer.toString('utf8')),
        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      };
    });
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    delete process.env.CCT_PLUGIN_REGISTRY_URL;
    await fs.remove(tmpDir);
  });

  test('installs a bundle: unpack, verify, and activate into .claude/', async () => {
    const ok = await installIndividualPlugin('test-pack', targetDir, {});
    expect(ok).toBe(true);

    // Pure standard layout unpacked
    expect(await fs.pathExists(path.join(targetDir, '.agent-plugins', 'test-pack', 'plugin.json'))).toBe(true);
    // Skill activated
    expect(await fs.pathExists(path.join(targetDir, '.claude', 'skills', 'pdf-tools', 'SKILL.md'))).toBe(true);
    // Agent activated flat (category stripped)
    expect(await fs.pathExists(path.join(targetDir, '.claude', 'agents', 'db-expert.md'))).toBe(true);
    // MCP merged
    const mcp = await fs.readJson(path.join(targetDir, '.mcp.json'));
    expect(mcp.mcpServers['fake-db'].command).toBe('npx');
    expect(mcp.mcpServers['fake-db'].description).toBeUndefined();
    expect(mcp.$schema).toBeUndefined();
  });

  test('preserves existing .mcp.json servers on activation', async () => {
    await fs.writeJson(path.join(targetDir, '.mcp.json'), {
      mcpServers: { 'my-server': { command: 'node', args: ['server.js'] } },
    });
    await installIndividualPlugin('test-pack', targetDir, {});
    const mcp = await fs.readJson(path.join(targetDir, '.mcp.json'));
    expect(mcp.mcpServers['my-server'].command).toBe('node');
    expect(mcp.mcpServers['fake-db'].command).toBe('npx');
  });

  test('--plugin-raw unpacks without activating', async () => {
    const ok = await installIndividualPlugin('test-pack', targetDir, { pluginRaw: true });
    expect(ok).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.agent-plugins', 'test-pack', 'plugin.json'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.claude'))).toBe(false);
    expect(await fs.pathExists(path.join(targetDir, '.mcp.json'))).toBe(false);
  });

  test('rejects unknown plugin names', async () => {
    expect(await installIndividualPlugin('nope', targetDir, {})).toBe(false);
    expect(await installIndividualPlugin('Bad Name!', targetDir, {})).toBe(false);
  });

  test('rejects the whole plugin when plugin.json fails spec validation', async () => {
    await fs.writeJson(path.join(bundleDir, 'plugin.json'), { name: 'test-pack' }); // no $schema
    expect(await installIndividualPlugin('test-pack', targetDir, {})).toBe(false);
    expect(await fs.pathExists(path.join(targetDir, '.agent-plugins'))).toBe(false);
  });

  test('rejects path traversal in the files manifest', async () => {
    filesManifest.files.push({ path: '../../evil.sh', sha256: 'x', size: 1 });
    await fs.writeJson(path.join(bundleDir, 'files.json'), filesManifest);
    expect(await installIndividualPlugin('test-pack', targetDir, {})).toBe(false);
    expect(await fs.pathExists(path.join(targetDir, '..', 'evil.sh'))).toBe(false);
  });

  test('rejects on sha256 mismatch and leaves no partial bundle', async () => {
    filesManifest.files.find((f) => f.path === 'README.md').sha256 = '0'.repeat(64);
    await fs.writeJson(path.join(bundleDir, 'files.json'), filesManifest);
    expect(await installIndividualPlugin('test-pack', targetDir, {})).toBe(false);
    expect(await fs.pathExists(path.join(targetDir, '.agent-plugins', 'test-pack'))).toBe(false);
  });

  test('dry run lists files without writing anything', async () => {
    const ok = await installIndividualPlugin('test-pack', targetDir, { dryRun: true });
    expect(ok).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.agent-plugins'))).toBe(false);
  });

  test('isSafeRelativePath blocks escape vectors', () => {
    expect(isSafeRelativePath('skills/x/SKILL.md')).toBe(true);
    expect(isSafeRelativePath('../x')).toBe(false);
    expect(isSafeRelativePath('/etc/passwd')).toBe(false);
    expect(isSafeRelativePath('a\\b')).toBe(false);
    expect(isSafeRelativePath('C:/windows')).toBe(false);
    expect(isSafeRelativePath('a//b')).toBe(false);
  });

  describe('mergeMcpServers (regression for the extracted helper)', () => {
    test('strips description, preserves existing, overwrites same-name', async () => {
      await fs.writeJson(path.join(targetDir, '.mcp.json'), {
        mcpServers: {
          keep: { command: 'a' },
          replace: { command: 'old' },
        },
      });
      const merged = await mergeMcpServers(targetDir, {
        $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
        mcpServers: {
          replace: { description: 'gone', command: 'new' },
          added: { command: 'b' },
        },
      });
      expect(merged.mcpServers.keep.command).toBe('a');
      expect(merged.mcpServers.replace.command).toBe('new');
      expect(merged.mcpServers.replace.description).toBeUndefined();
      expect(merged.mcpServers.added.command).toBe('b');
      expect(merged.$schema).toBeUndefined();
      const onDisk = await fs.readFile(path.join(targetDir, '.mcp.json'), 'utf8');
      expect(onDisk).toContain('  "mcpServers"'); // 2-space indent preserved
    });

    test('does not mutate the caller-provided config object', async () => {
      const incoming = { mcpServers: { s: { description: 'd', command: 'x' } } };
      await mergeMcpServers(targetDir, incoming);
      expect(incoming.mcpServers.s.description).toBe('d');
    });
  });
});

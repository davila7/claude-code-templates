const IntegrityValidator = require('../../src/validation/validators/IntegrityValidator');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

describe('IntegrityValidator', () => {
  let validator;
  const testRegistryPath = path.join(process.cwd(), '.claude/security/component-hashes.json');

  beforeEach(() => {
    validator = new IntegrityValidator();
  });

  afterEach(async () => {
    // Clean up test registry file
    if (await fs.pathExists(testRegistryPath)) {
      await fs.remove(testRegistryPath);
    }
  });

  describe('Hash Generation', () => {
    it('should generate consistent SHA256 hash', () => {
      const content = 'test content';
      const hash1 = validator.generateHash(content);
      const hash2 = validator.generateHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 in hex is 64 chars
    });

    it('should generate different hashes for different content', () => {
      const hash1 = validator.generateHash('content 1');
      const hash2 = validator.generateHash('content 2');

      expect(hash1).not.toBe(hash2);
    });

    it('should generate expected hash for known content', () => {
      const content = 'Hello, World!';
      const expectedHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
      const actualHash = validator.generateHash(content);

      expect(actualHash).toBe(expectedHash);
    });
  });

  describe('Basic Validation', () => {
    it('should validate and generate hash for valid component', async () => {
      const component = {
        content: `---
name: test-agent
description: A test agent
tools: Read
version: 1.0.0
---
Content`,
        path: 'test-agent.md',
        type: 'agent',
        version: '1.0.0'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
      expect(result.hash).toBeDefined();
      expect(result.hash).toHaveLength(64);
      expect(result.version).toBe('1.0.0');
    });

    it('should error when content is missing', async () => {
      const component = {
        content: null,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INT_E001'
        })
      );
    });
  });

  describe('Hash Verification', () => {
    it('should pass when hash matches expected hash', async () => {
      const content = 'test content';
      const expectedHash = validator.generateHash(content);

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component, { expectedHash });

      expect(result.valid).toBe(true);
      expect(result.info.some(i => i.code === 'INT_I002')).toBe(true);
    });

    it('should error when hash does not match expected hash', async () => {
      const component = {
        content: 'actual content',
        path: 'test.md',
        type: 'agent'
      };

      const wrongHash = validator.generateHash('different content');

      const result = await validator.validate(component, { expectedHash: wrongHash });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INT_E002'
        })
      );
    });
  });

  describe('Version Validation', () => {
    it('should accept valid semantic version', async () => {
      const component = {
        content: 'test content',
        path: 'test.md',
        type: 'agent',
        version: '1.2.3'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
      expect(result.info.some(i => i.code === 'INT_I007')).toBe(true);
    });

    it('should accept simple version format', async () => {
      const component = {
        content: 'test content',
        path: 'test.md',
        type: 'agent',
        version: '1.0'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
    });

    it('should warn about invalid version format', async () => {
      const component = {
        content: 'test content',
        path: 'test.md',
        type: 'agent',
        version: 'v1.0-beta'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'INT_W003'
        })
      );
    });

    it('should warn when no version is specified', async () => {
      const component = {
        content: 'test content',
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'INT_W002'
        })
      );
    });
  });

  describe('Hash Registry', () => {
    it('should update registry when requested', async () => {
      const component = {
        content: 'test content',
        path: 'test-agent.md',
        type: 'agent',
        version: '1.0.0'
      };

      await validator.validate(component, { updateRegistry: true });

      const registry = await validator.loadHashRegistry();
      const normalizedPath = validator.normalizePath('test-agent.md');

      expect(registry[normalizedPath]).toBeDefined();
      expect(registry[normalizedPath].hash).toBe(validator.generateHash('test content'));
      expect(registry[normalizedPath].version).toBe('1.0.0');
    });

    it('should detect hash changes from registry', async () => {
      const component1 = {
        content: 'original content',
        path: 'test-agent.md',
        type: 'agent',
        version: '1.0.0'
      };

      // First validation - update registry
      await validator.validate(component1, { updateRegistry: true });

      // Second validation with modified content
      const component2 = {
        content: 'modified content',
        path: 'test-agent.md',
        type: 'agent',
        version: '1.0.0'
      };

      const result = await validator.validate(component2);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'INT_W001'
        })
      );
    });

    it('should detect version changes', async () => {
      const component1 = {
        content: 'test content',
        path: 'test-agent.md',
        type: 'agent',
        version: '1.0.0'
      };

      await validator.validate(component1, { updateRegistry: true });

      const component2 = {
        content: 'test content',
        path: 'test-agent.md',
        type: 'agent',
        version: '2.0.0'
      };

      const result = await validator.validate(component2);

      expect(result.info.some(i => i.code === 'INT_I004')).toBe(true);
    });

    it('should handle new components not in registry', async () => {
      const component = {
        content: 'new content',
        path: 'new-agent.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.info.some(i => i.code === 'INT_I005' || i.code === 'INT_I006')).toBe(true);
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple components', async () => {
      const components = [
        {
          content: 'content 1',
          path: 'agent1.md',
          type: 'agent',
          version: '1.0.0'
        },
        {
          content: 'content 2',
          path: 'agent2.md',
          type: 'agent',
          version: '1.0.0'
        },
        {
          content: 'content 3',
          path: 'agent3.md',
          type: 'agent',
          version: '1.0.0'
        }
      ];

      const result = await validator.batchValidate(components, { updateRegistry: true });

      expect(result.total).toBe(3);
      expect(result.passed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.components).toHaveLength(3);
    });

    it('should count failures correctly in batch validation', async () => {
      const components = [
        {
          content: 'valid content',
          path: 'agent1.md',
          type: 'agent',
          version: '1.0.0'
        },
        {
          content: null, // Invalid
          path: 'agent2.md',
          type: 'agent'
        },
        {
          content: 'valid content',
          path: 'agent3.md',
          type: 'agent'
        }
      ];

      const result = await validator.batchValidate(components);

      expect(result.total).toBe(3);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('Integrity Report', () => {
    it('should generate comprehensive integrity report', async () => {
      const component = {
        content: `---
name: test-agent
description: A test agent
tools: Read
version: 1.0.0
---
Content`,
        path: 'test-agent.md',
        type: 'agent',
        version: '1.0.0'
      };

      const report = await validator.generateIntegrityReport(component);

      expect(report).toHaveProperty('valid');
      expect(report).toHaveProperty('hash');
      expect(report).toHaveProperty('version');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('issues');
      expect(report.issues).toHaveProperty('errors');
      expect(report.issues).toHaveProperty('warnings');
    });
  });

  describe('Real Component Validation', () => {
    it('should validate real frontend-developer agent', async () => {
      const agentPath = path.join(
        __dirname,
        '../../components/agents/development-team/frontend-developer.md'
      );

      if (!await fs.pathExists(agentPath)) {
        console.log('Skipping test: frontend-developer.md not found');
        return;
      }

      const content = await fs.readFile(agentPath, 'utf8');

      const component = {
        content,
        path: agentPath,
        type: 'agent',
        version: '1.0.0'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
      expect(result.hash).toBeDefined();
      expect(result.hash).toHaveLength(64);
    });
  });

  describe('Path Normalization', () => {
    it('should normalize absolute paths to relative', () => {
      const absolutePath = path.join(process.cwd(), 'components/agent.md');
      const normalized = validator.normalizePath(absolutePath);

      expect(normalized).toBe('components/agent.md');
    });

    it('should keep relative paths unchanged', () => {
      const relativePath = 'components/agent.md';
      const normalized = validator.normalizePath(relativePath);

      expect(normalized).toBe(relativePath);
    });
  });
});

const StructuralValidator = require('../../src/validation/validators/StructuralValidator');
const fs = require('fs-extra');
const path = require('path');

describe('StructuralValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new StructuralValidator();
  });

  describe('Valid Component', () => {
    it('should pass validation for a well-formed agent', async () => {
      const content = `---
name: test-agent
description: A test agent for validation testing purposes
tools: Read, Write, Edit
model: sonnet
---

## Overview
This is a test agent.

## Usage
Use this agent for testing.
`;

      const component = {
        content,
        path: 'test-agent.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(90);
    });

    it('should validate the real frontend-developer agent', async () => {
      const agentPath = path.join(
        __dirname,
        '../../components/agents/development-team/frontend-developer.md'
      );

      if (!fs.existsSync(agentPath)) {
        console.log('Skipping test: frontend-developer.md not found');
        return;
      }

      const content = await fs.readFile(agentPath, 'utf8');

      const component = {
        content,
        path: agentPath,
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.score).toBeGreaterThan(80);
    });
  });

  describe('Frontmatter Validation', () => {
    it('should error when frontmatter is missing', async () => {
      const content = 'This is content without frontmatter';

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_E001'
        })
      );
    });

    it('should error when frontmatter YAML is invalid', async () => {
      const content = `---
name: test
description: test
invalid: yaml: syntax:
---
Content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_E002'
        })
      );
    });

    it('should error when required fields are missing', async () => {
      const content = `---
name: test-agent
---
Content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'STRUCT_E006')).toBe(true);
    });
  });

  describe('File Size Validation', () => {
    it('should error when file size exceeds limit', async () => {
      const largeContent = `---
name: large-agent
description: This is a large test agent
tools: Read
---

${' Large content '.repeat(20000)}`; // Create >100KB file

      const component = {
        content: largeContent,
        path: 'large.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_E003'
        })
      );
    });

    it('should warn when file size approaches limit', async () => {
      // Create content that is ~85KB (80% of 100KB limit)
      const largeText = 'X'.repeat(5000); // 5KB chunk
      const mediumContent = `---
name: medium-agent
description: This is a medium test agent
tools: Read
---

${largeText.repeat(17)}`; // 85KB total

      const component = {
        content: mediumContent,
        path: 'medium.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings.some(w => w.code === 'STRUCT_W002')).toBe(true);
    });
  });

  describe('Description Validation', () => {
    it('should warn when description is too short', async () => {
      const content = `---
name: test-agent
description: Short
tools: Read
---
Content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_W003'
        })
      );
    });

    it('should warn when description is too long', async () => {
      const longDescription = 'A '.repeat(300);
      const content = `---
name: test-agent
description: ${longDescription}
tools: Read
---
Content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_W004'
        })
      );
    });
  });

  describe('Tools Validation', () => {
    it('should validate valid tools', async () => {
      const content = `---
name: test-agent
description: A test agent with valid tools
tools: Read, Write, Edit, Bash
---
Content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
    });

    it('should warn about unknown tools', async () => {
      const content = `---
name: test-agent
description: A test agent with unknown tools
tools: Read, UnknownTool, InvalidTool
---
Content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_W006'
        })
      );
    });
  });

  describe('Model Validation', () => {
    it('should warn when model is missing', async () => {
      const content = `---
name: test-agent
description: A test agent without model
tools: Read
---
Content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_W007'
        })
      );
    });

    it('should warn about unknown model', async () => {
      const content = `---
name: test-agent
description: A test agent with unknown model
tools: Read
model: unknown-model
---
Content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_W008'
        })
      );
    });
  });

  describe('Content Structure Validation', () => {
    it('should warn when content is too short', async () => {
      const content = `---
name: test-agent
description: A test agent with minimal content
tools: Read
---
Short`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_W009'
        })
      );
    });

    it('should warn when no headers are present', async () => {
      const content = `---
name: test-agent
description: A test agent without headers in content
tools: Read
---
This is content without any markdown headers at all.
It just has plain text and no structure.`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_W010'
        })
      );
    });

    it('should warn when too many sections', async () => {
      const manyHeaders = Array.from({ length: 25 }, (_, i) => `## Section ${i + 1}`).join('\n\n');
      const content = `---
name: test-agent
description: A test agent with too many sections
tools: Read
---
${manyHeaders}`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_W011'
        })
      );
    });
  });

  describe('Encoding Validation', () => {
    it('should error when null bytes are present', async () => {
      const content = `---
name: test-agent
description: A test agent with null bytes
tools: Read
---
Content with \0 null byte`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'STRUCT_E005'
        })
      );
    });
  });

  describe('Score Calculation', () => {
    it('should calculate score correctly', async () => {
      const content = `---
name: test-agent
description: A test agent for score testing purposes
tools: Read
---

## Overview
Good content`;

      const component = {
        content,
        path: 'test.md',
        type: 'agent'
      };

      const result = await validator.validate(component);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});

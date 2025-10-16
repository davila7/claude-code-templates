const BaseValidator = require('../BaseValidator');
const yaml = require('js-yaml');

/**
 * StructuralValidator - Validates component structure and format
 *
 * Checks:
 * - YAML frontmatter presence and validity
 * - Required fields (name, description)
 * - File size limits
 * - UTF-8 encoding
 * - Section count limits
 * - Component type-specific requirements
 */
class StructuralValidator extends BaseValidator {
  constructor() {
    super();

    // Configuration limits
    this.MAX_FILE_SIZE = 100 * 1024; // 100KB
    this.MAX_SECTION_COUNT = 20; // Prevent context overflow
    this.MIN_DESCRIPTION_LENGTH = 20;
    this.MAX_DESCRIPTION_LENGTH = 500;

    // Required fields by component type
    this.REQUIRED_FIELDS = {
      agent: ['name', 'description', 'tools'],
      command: ['name', 'description'],
      mcp: ['name', 'description', 'command'],
      setting: ['name', 'description'],
      hook: ['name', 'description', 'trigger']
    };

    // Optional but recommended fields
    this.RECOMMENDED_FIELDS = {
      agent: ['model'],
      command: ['usage', 'examples'],
      mcp: ['args'],
      setting: ['type'],
      hook: ['conditions']
    };
  }

  /**
   * Validate component structure
   * @param {object} component - Component data
   * @param {string} component.content - Raw markdown content
   * @param {string} component.path - File path
   * @param {string} component.type - Component type (agent, command, mcp, etc.)
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation results
   */
  async validate(component, options = {}) {
    this.reset();

    const { content, path, type } = component;

    if (!content) {
      this.addError('STRUCT_E001', 'Component content is empty or missing', { path });
      return this.getResults();
    }

    // 1. File size validation
    this.validateFileSize(content, path);

    // 2. UTF-8 encoding validation
    this.validateEncoding(content, path);

    // 3. Frontmatter validation
    const frontmatter = this.validateFrontmatter(content, path);

    if (frontmatter) {
      // 4. Required fields validation
      this.validateRequiredFields(frontmatter, type, path);

      // 5. Description validation
      this.validateDescription(frontmatter, path);

      // 6. Tools validation (for agents)
      if (type === 'agent') {
        this.validateTools(frontmatter, path);
      }

      // 7. Model validation (for agents)
      if (type === 'agent') {
        this.validateModel(frontmatter, path);
      }

      // 8. Recommended fields check
      this.checkRecommendedFields(frontmatter, type, path);
    }

    // 9. Content structure validation
    this.validateContentStructure(content, path);

    // 10. Section count validation
    this.validateSectionCount(content, path);

    return this.getResults();
  }

  /**
   * Validate file size
   */
  validateFileSize(content, path) {
    const size = Buffer.byteLength(content, 'utf8');

    if (size > this.MAX_FILE_SIZE) {
      this.addError(
        'STRUCT_E003',
        `File size (${(size / 1024).toFixed(2)}KB) exceeds maximum allowed size (${this.MAX_FILE_SIZE / 1024}KB)`,
        { path, size, limit: this.MAX_FILE_SIZE }
      );
    } else if (size > this.MAX_FILE_SIZE * 0.8) {
      this.addWarning(
        'STRUCT_W002',
        `File size (${(size / 1024).toFixed(2)}KB) is approaching the limit`,
        { path, size, limit: this.MAX_FILE_SIZE }
      );
    }

    this.addInfo('STRUCT_I001', `File size: ${(size / 1024).toFixed(2)}KB`, { path, size });
  }

  /**
   * Validate UTF-8 encoding
   */
  validateEncoding(content, path) {
    try {
      // Try to detect non-UTF-8 characters
      const buffer = Buffer.from(content, 'utf8');
      const decoded = buffer.toString('utf8');

      if (decoded !== content) {
        this.addError(
          'STRUCT_E004',
          'File contains invalid UTF-8 encoding',
          { path }
        );
      }

      // Check for null bytes (potential binary content)
      if (content.includes('\0')) {
        this.addError(
          'STRUCT_E005',
          'File contains null bytes (possible binary content)',
          { path }
        );
      }
    } catch (error) {
      this.addError(
        'STRUCT_E004',
        'Failed to validate encoding',
        { path, error: error.message }
      );
    }
  }

  /**
   * Validate and parse YAML frontmatter
   * @returns {object|null} Parsed frontmatter or null if invalid
   */
  validateFrontmatter(content, path) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      this.addError(
        'STRUCT_E001',
        'Missing YAML frontmatter (must start with --- and end with ---)',
        { path }
      );
      return null;
    }

    try {
      const frontmatter = yaml.load(frontmatterMatch[1]);

      if (!frontmatter || typeof frontmatter !== 'object') {
        this.addError(
          'STRUCT_E002',
          'Frontmatter is empty or not a valid object',
          { path }
        );
        return null;
      }

      this.addInfo('STRUCT_I002', 'Valid YAML frontmatter found', { path });
      return frontmatter;
    } catch (error) {
      this.addError(
        'STRUCT_E002',
        `Invalid YAML syntax in frontmatter: ${error.message}`,
        { path, error: error.message }
      );
      return null;
    }
  }

  /**
   * Validate required fields
   */
  validateRequiredFields(frontmatter, type, path) {
    const requiredFields = this.REQUIRED_FIELDS[type] || ['name', 'description'];

    for (const field of requiredFields) {
      if (!frontmatter[field]) {
        this.addError(
          'STRUCT_E006',
          `Missing required field: ${field}`,
          { path, field, type }
        );
      }
    }
  }

  /**
   * Validate description field
   */
  validateDescription(frontmatter, path) {
    const description = frontmatter.description;

    if (!description) return; // Already caught by required fields

    if (typeof description !== 'string') {
      this.addError(
        'STRUCT_E007',
        'Description must be a string',
        { path, type: typeof description }
      );
      return;
    }

    const length = description.trim().length;

    if (length < this.MIN_DESCRIPTION_LENGTH) {
      this.addWarning(
        'STRUCT_W003',
        `Description is too short (${length} chars, minimum ${this.MIN_DESCRIPTION_LENGTH})`,
        { path, length, min: this.MIN_DESCRIPTION_LENGTH }
      );
    }

    if (length > this.MAX_DESCRIPTION_LENGTH) {
      this.addWarning(
        'STRUCT_W004',
        `Description is too long (${length} chars, maximum ${this.MAX_DESCRIPTION_LENGTH})`,
        { path, length, max: this.MAX_DESCRIPTION_LENGTH }
      );
    }
  }

  /**
   * Validate tools field for agents
   */
  validateTools(frontmatter, path) {
    const tools = frontmatter.tools;

    if (!tools) return; // Already caught by required fields

    // Tools can be a string (comma-separated) or array
    if (typeof tools === 'string') {
      const toolsList = tools.split(',').map(t => t.trim()).filter(t => t);

      if (toolsList.length === 0) {
        this.addWarning('STRUCT_W005', 'Tools field is empty', { path });
      }

      // Validate known tool names
      const validTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', '*'];
      const invalidTools = toolsList.filter(t => !validTools.includes(t) && t !== '*');

      if (invalidTools.length > 0) {
        this.addWarning(
          'STRUCT_W006',
          `Unknown tools specified: ${invalidTools.join(', ')}`,
          { path, invalidTools }
        );
      }
    } else if (Array.isArray(tools)) {
      if (tools.length === 0) {
        this.addWarning('STRUCT_W005', 'Tools array is empty', { path });
      }
    } else {
      this.addError(
        'STRUCT_E008',
        'Tools field must be a string or array',
        { path, type: typeof tools }
      );
    }
  }

  /**
   * Validate model field for agents
   */
  validateModel(frontmatter, path) {
    const model = frontmatter.model;

    if (!model) {
      this.addWarning('STRUCT_W007', 'No model specified (recommended)', { path });
      return;
    }

    const validModels = ['sonnet', 'opus', 'haiku', 'claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'];

    if (!validModels.includes(model)) {
      this.addWarning(
        'STRUCT_W008',
        `Unknown model: ${model}. Valid models: ${validModels.join(', ')}`,
        { path, model }
      );
    }
  }

  /**
   * Check for recommended fields
   */
  checkRecommendedFields(frontmatter, type, path) {
    const recommendedFields = this.RECOMMENDED_FIELDS[type] || [];
    const missingFields = recommendedFields.filter(field => !frontmatter[field]);

    if (missingFields.length > 0) {
      this.addInfo(
        'STRUCT_I003',
        `Missing recommended fields: ${missingFields.join(', ')}`,
        { path, missingFields }
      );
    }
  }

  /**
   * Validate content structure
   */
  validateContentStructure(content, path) {
    // Remove frontmatter for content analysis
    const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    if (contentWithoutFrontmatter.trim().length < 50) {
      this.addWarning(
        'STRUCT_W009',
        'Component content is very short (less than 50 characters)',
        { path, length: contentWithoutFrontmatter.trim().length }
      );
    }

    // Check for basic markdown structure
    const hasHeaders = /^#{1,6}\s+.+$/m.test(contentWithoutFrontmatter);

    if (!hasHeaders) {
      this.addWarning(
        'STRUCT_W010',
        'No markdown headers found in content (recommended for organization)',
        { path }
      );
    }
  }

  /**
   * Validate section count (prevent context overflow)
   */
  validateSectionCount(content, path) {
    const sections = content.match(/^#{1,6}\s+.+$/gm) || [];
    const count = sections.length;

    if (count > this.MAX_SECTION_COUNT) {
      this.addWarning(
        'STRUCT_W011',
        `Too many sections (${count}), may cause context overflow. Maximum recommended: ${this.MAX_SECTION_COUNT}`,
        { path, count, max: this.MAX_SECTION_COUNT }
      );
    }

    this.addInfo('STRUCT_I004', `Section count: ${count}`, { path, count });
  }
}

module.exports = StructuralValidator;

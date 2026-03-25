const BaseValidator = require('../BaseValidator');
const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

/**
 * IntegrityValidator - Validates component integrity and versioning
 *
 * Checks:
 * - SHA256 hash generation
 * - Hash verification against stored hashes
 * - Version tracking
 * - Signature validation (future)
 * - Tamper detection
 */
class IntegrityValidator extends BaseValidator {
  constructor() {
    super();

    // Path to store component hashes (relative to project)
    this.HASH_REGISTRY_PATH = '.claude/security/component-hashes.json';
  }

  /**
   * Validate component integrity
   * @param {object} component - Component data
   * @param {string} component.content - Raw markdown content
   * @param {string} component.path - File path
   * @param {string} component.type - Component type
   * @param {string} component.version - Component version (optional)
   * @param {object} options - Validation options
   * @param {boolean} options.updateRegistry - Update hash registry after validation
   * @param {string} options.expectedHash - Expected hash to verify against
   * @returns {Promise<object>} Validation results with hash
   */
  async validate(component, options = {}) {
    this.reset();

    const { content, path: filePath, type, version } = component;
    const { updateRegistry = false, expectedHash = null } = options;

    if (!content) {
      this.addError('INT_E001', 'Component content is empty or missing', { path: filePath });
      return this.getResults();
    }

    // 1. Generate SHA256 hash
    const hash = this.generateHash(content);
    this.addInfo('INT_I001', `Generated SHA256 hash`, {
      path: filePath,
      hash: hash.substring(0, 16) + '...',
      fullHash: hash
    });

    // 2. Verify against expected hash if provided
    if (expectedHash) {
      this.verifyHash(hash, expectedHash, filePath);
    }

    // 3. Check hash registry for changes
    await this.checkHashRegistry(filePath, hash, type, version);

    // 4. Validate version if provided
    // Note: Version is optional for components - metadata is stored in marketplace.json
    if (version) {
      this.validateVersion(version, filePath);
    } else {
      this.addInfo('INT_I009', 'No version in component (metadata in marketplace.json)', {
        path: filePath
      });
    }

    // 5. Update registry if requested
    if (updateRegistry) {
      await this.updateHashRegistry(filePath, hash, type, version);
    }

    // Add hash to results for external use
    const results = this.getResults();
    results.hash = hash;
    results.version = version;

    return results;
  }

  /**
   * Generate SHA256 hash of content
   * @param {string} content - Content to hash
   * @returns {string} SHA256 hash in hex format
   */
  generateHash(content) {
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }

  /**
   * Verify hash matches expected hash
   * @param {string} actualHash - Generated hash
   * @param {string} expectedHash - Expected hash
   * @param {string} filePath - File path for error reporting
   */
  verifyHash(actualHash, expectedHash, filePath) {
    if (actualHash !== expectedHash) {
      this.addError(
        'INT_E002',
        'Hash mismatch: Component content has been modified',
        {
          path: filePath,
          expected: expectedHash.substring(0, 16) + '...',
          actual: actualHash.substring(0, 16) + '...',
          fullExpected: expectedHash,
          fullActual: actualHash
        }
      );
    } else {
      this.addInfo('INT_I002', 'Hash verification passed', { path: filePath });
    }
  }

  /**
   * Check component hash against registry
   * @param {string} filePath - File path
   * @param {string} currentHash - Current hash
   * @param {string} type - Component type
   * @param {string} version - Component version
   */
  async checkHashRegistry(filePath, currentHash, type, version) {
    try {
      const registry = await this.loadHashRegistry();
      const normalizedPath = this.normalizePath(filePath);

      if (registry[normalizedPath]) {
        const stored = registry[normalizedPath];

        // Check if hash has changed
        if (stored.hash !== currentHash) {
          this.addWarning(
            'INT_W001',
            'Component hash has changed since last validation',
            {
              path: filePath,
              previousHash: stored.hash.substring(0, 16) + '...',
              currentHash: currentHash.substring(0, 16) + '...',
              lastValidated: stored.timestamp
            }
          );
        } else {
          this.addInfo('INT_I003', 'Hash matches registry', {
            path: filePath,
            lastValidated: stored.timestamp
          });
        }

        // Check version changes
        if (version && stored.version && stored.version !== version) {
          this.addInfo('INT_I004', 'Version updated', {
            path: filePath,
            previousVersion: stored.version,
            currentVersion: version
          });
        }
      } else {
        this.addInfo('INT_I005', 'Component not in registry (new component)', {
          path: filePath
        });
      }
    } catch (error) {
      // Registry doesn't exist or couldn't be read - this is OK for new setups
      this.addInfo('INT_I006', 'Hash registry not found (first run)', {
        path: filePath
      });
    }
  }

  /**
   * Validate version format
   * @param {string} version - Version string
   * @param {string} filePath - File path for error reporting
   */
  validateVersion(version, filePath) {
    // Support semantic versioning (X.Y.Z) and simple versions
    const semverPattern = /^\d+\.\d+\.\d+$/;
    const simplePattern = /^\d+(\.\d+)?$/;

    if (!semverPattern.test(version) && !simplePattern.test(version)) {
      this.addWarning(
        'INT_W003',
        `Version format "${version}" doesn't follow semantic versioning (X.Y.Z)`,
        {
          path: filePath,
          version,
          recommendation: 'Use semantic versioning (e.g., 1.0.0)'
        }
      );
    } else {
      this.addInfo('INT_I007', `Valid version: ${version}`, { path: filePath, version });
    }
  }

  /**
   * Update hash registry with new hash
   * @param {string} filePath - File path
   * @param {string} hash - Current hash
   * @param {string} type - Component type
   * @param {string} version - Component version
   */
  async updateHashRegistry(filePath, hash, type, version) {
    try {
      const registry = await this.loadHashRegistry();
      const normalizedPath = this.normalizePath(filePath);

      registry[normalizedPath] = {
        hash,
        type,
        version: version || 'unversioned',
        timestamp: new Date().toISOString(),
        path: filePath
      };

      await this.saveHashRegistry(registry);

      this.addInfo('INT_I008', 'Hash registry updated', {
        path: filePath,
        hash: hash.substring(0, 16) + '...'
      });
    } catch (error) {
      this.addWarning(
        'INT_W004',
        `Failed to update hash registry: ${error.message}`,
        { path: filePath, error: error.message }
      );
    }
  }

  /**
   * Load hash registry from file
   * @returns {Promise<object>} Registry object
   */
  async loadHashRegistry() {
    const registryPath = path.join(process.cwd(), this.HASH_REGISTRY_PATH);

    if (await fs.pathExists(registryPath)) {
      return await fs.readJson(registryPath);
    }

    return {};
  }

  /**
   * Save hash registry to file
   * @param {object} registry - Registry object to save
   */
  async saveHashRegistry(registry) {
    const registryPath = path.join(process.cwd(), this.HASH_REGISTRY_PATH);

    // Ensure directory exists
    await fs.ensureDir(path.dirname(registryPath));

    // Save with pretty formatting
    await fs.writeJson(registryPath, registry, { spaces: 2 });
  }

  /**
   * Normalize file path for consistent registry keys
   * @param {string} filePath - File path to normalize
   * @returns {string} Normalized path
   */
  normalizePath(filePath) {
    // Convert to relative path from project root
    const cwd = process.cwd();
    if (filePath.startsWith(cwd)) {
      return path.relative(cwd, filePath);
    }
    return filePath;
  }

  /**
   * Generate integrity report for a component
   * @param {object} component - Component data
   * @returns {Promise<object>} Integrity report
   */
  async generateIntegrityReport(component) {
    const result = await this.validate(component);

    return {
      valid: result.valid,
      hash: result.hash,
      version: result.version,
      timestamp: new Date().toISOString(),
      issues: {
        errors: result.errors,
        warnings: result.warnings
      }
    };
  }

  /**
   * Batch validate multiple components
   * @param {Array<object>} components - Array of components to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Batch validation results
   */
  async batchValidate(components, options = {}) {
    const results = {
      total: components.length,
      passed: 0,
      failed: 0,
      warnings: 0,
      components: []
    };

    for (const component of components) {
      const result = await this.validate(component, options);

      results.components.push({
        path: component.path,
        valid: result.valid,
        hash: result.hash,
        errors: result.errorCount,
        warnings: result.warningCount
      });

      if (result.valid) {
        results.passed++;
      } else {
        results.failed++;
      }

      results.warnings += result.warningCount;
    }

    return results;
  }
}

module.exports = IntegrityValidator;

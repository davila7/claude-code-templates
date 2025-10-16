const BaseValidator = require('../BaseValidator');
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

/**
 * ProvenanceValidator - Validates component provenance and metadata
 *
 * Checks:
 * - Author information
 * - Source repository tracking
 * - Git commit SHA tracking
 * - Timestamp tracking
 * - Version consistency
 * - Verified author status (future)
 */
class ProvenanceValidator extends BaseValidator {
  constructor() {
    super();
  }

  /**
   * Validate component provenance
   * @param {object} component - Component data
   * @param {string} component.content - Raw markdown content
   * @param {string} component.path - File path
   * @param {object} options - Validation options
   * @param {boolean} options.requireGit - Require Git metadata
   * @param {boolean} options.requireAuthor - Require author information
   * @returns {Promise<object>} Validation results
   */
  async validate(component, options = {}) {
    this.reset();

    const { content, path: filePath } = component;
    const { requireGit = false, requireAuthor = false } = options;

    if (!content) {
      this.addError('PROV_E001', 'Component content is empty or missing', { path: filePath });
      return this.getResults();
    }

    // 1. Extract frontmatter metadata
    const metadata = this.extractMetadata(content, filePath);

    // 2. Validate author information
    this.validateAuthor(metadata, filePath, requireAuthor);

    // 3. Extract Git metadata if file exists
    if (fs.existsSync(filePath)) {
      const gitMetadata = await this.extractGitMetadata(filePath);
      if (gitMetadata) {
        this.validateGitMetadata(gitMetadata, filePath);
      } else if (requireGit) {
        this.addWarning('PROV_W001', 'No Git metadata found', { path: filePath });
      }
    } else {
      this.addInfo('PROV_I001', 'File path does not exist (in-memory component)', { path: filePath });
    }

    // 4. Validate repository URL if provided
    if (metadata.repository) {
      this.validateRepository(metadata.repository, filePath);
    }

    // 5. Validate version information
    if (metadata.version) {
      this.validateVersionConsistency(metadata.version, filePath);
    }

    // Add metadata to results
    const results = this.getResults();
    results.metadata = {
      author: metadata.author || 'unknown',
      repository: metadata.repository || 'unknown',
      version: metadata.version || 'unversioned',
      extractedAt: new Date().toISOString()
    };

    return results;
  }

  /**
   * Extract metadata from frontmatter
   * @param {string} content - Component content
   * @param {string} filePath - File path
   * @returns {object} Metadata object
   */
  extractMetadata(content, filePath) {
    const metadata = {};

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return metadata;
    }

    const frontmatter = frontmatterMatch[1];

    // Extract author
    const authorMatch = frontmatter.match(/^author:\s*(.+)$/m);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim().replace(/['"]/g, '');
    }

    // Extract repository
    const repoMatch = frontmatter.match(/^repository:\s*(.+)$/m);
    if (repoMatch) {
      metadata.repository = repoMatch[1].trim().replace(/['"]/g, '');
    }

    // Extract version
    const versionMatch = frontmatter.match(/^version:\s*(.+)$/m);
    if (versionMatch) {
      metadata.version = versionMatch[1].trim().replace(/['"]/g, '');
    }

    return metadata;
  }

  /**
   * Validate author information
   */
  validateAuthor(metadata, filePath, required) {
    if (!metadata.author) {
      if (required) {
        this.addError('PROV_E002', 'Author information is required but missing', { path: filePath });
      } else {
        // Author is optional for components - metadata is stored in marketplace.json
        this.addInfo('PROV_I007', 'No author in component (metadata in marketplace.json)', {
          path: filePath
        });
      }
    } else {
      this.addInfo('PROV_I002', `Author: ${metadata.author}`, { path: filePath });

      // Validate author format (basic check)
      if (metadata.author.length < 2) {
        this.addWarning('PROV_W003', 'Author name seems too short', {
          path: filePath,
          author: metadata.author
        });
      }
    }
  }

  /**
   * Extract Git metadata for a file
   * @param {string} filePath - Path to file
   * @returns {Promise<object|null>} Git metadata or null
   */
  async extractGitMetadata(filePath) {
    try {
      // Get last commit SHA for this file
      const commitSha = execSync(
        `git log -1 --format=%H -- "${filePath}"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();

      if (!commitSha) {
        return null;
      }

      // Get commit author
      const author = execSync(
        `git log -1 --format=%an -- "${filePath}"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();

      // Get commit date
      const date = execSync(
        `git log -1 --format=%ai -- "${filePath}"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();

      // Get remote URL
      let remoteUrl = '';
      try {
        remoteUrl = execSync(
          'git config --get remote.origin.url',
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
        ).trim();
      } catch (e) {
        // No remote configured
      }

      return {
        commitSha,
        author,
        date,
        remoteUrl
      };
    } catch (error) {
      // Not a git repository or file not tracked
      return null;
    }
  }

  /**
   * Validate Git metadata
   */
  validateGitMetadata(gitMetadata, filePath) {
    const { commitSha, author, date, remoteUrl } = gitMetadata;

    this.addInfo('PROV_I003', `Git commit: ${commitSha.substring(0, 7)}`, {
      path: filePath,
      fullSha: commitSha,
      author,
      date
    });

    if (remoteUrl) {
      this.addInfo('PROV_I004', `Repository: ${remoteUrl}`, {
        path: filePath,
        remoteUrl
      });

      // Validate that remote URL is a recognized platform
      if (!this.isRecognizedGitPlatform(remoteUrl)) {
        this.addWarning('PROV_W004', 'Git remote is not a recognized platform', {
          path: filePath,
          remoteUrl,
          recognized: ['github.com', 'gitlab.com', 'bitbucket.org']
        });
      }
    }
  }

  /**
   * Validate repository URL
   */
  validateRepository(repository, filePath) {
    // Check if it's a valid GitHub/GitLab/Bitbucket URL
    const gitPlatforms = [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'codeberg.org'
    ];

    const isValid = gitPlatforms.some(platform => repository.includes(platform));

    if (!isValid) {
      this.addWarning('PROV_W005', 'Repository URL is not from a recognized platform', {
        path: filePath,
        repository,
        recognized: gitPlatforms
      });
    } else {
      this.addInfo('PROV_I005', `Repository: ${repository}`, { path: filePath });
    }

    // Check for HTTPS
    if (repository.startsWith('http://')) {
      this.addWarning('PROV_W006', 'Repository URL uses HTTP (HTTPS recommended)', {
        path: filePath,
        repository
      });
    }
  }

  /**
   * Validate version consistency
   */
  validateVersionConsistency(version, filePath) {
    // Check if version follows semantic versioning
    const semverPattern = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

    if (!semverPattern.test(version)) {
      this.addWarning('PROV_W007', 'Version does not follow semantic versioning', {
        path: filePath,
        version,
        expected: 'X.Y.Z or X.Y.Z-tag'
      });
    } else {
      this.addInfo('PROV_I006', `Version: ${version}`, { path: filePath });
    }
  }

  /**
   * Check if Git remote is a recognized platform
   */
  isRecognizedGitPlatform(remoteUrl) {
    const platforms = [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'codeberg.org'
    ];

    return platforms.some(platform => remoteUrl.includes(platform));
  }

  /**
   * Generate provenance report
   * @param {object} component - Component to analyze
   * @returns {Promise<object>} Provenance report
   */
  async generateProvenanceReport(component) {
    const result = await this.validate(component);

    // Extract Git metadata if available
    let gitMetadata = null;
    if (component.path && fs.existsSync(component.path)) {
      gitMetadata = await this.extractGitMetadata(component.path);
    }

    return {
      traceable: result.valid && result.metadata.author !== 'unknown',
      metadata: result.metadata,
      git: gitMetadata,
      issues: {
        errors: result.errors,
        warnings: result.warnings
      },
      trustScore: this.calculateTrustScore(result, gitMetadata),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate trust score based on provenance data
   * @param {object} result - Validation results
   * @param {object} gitMetadata - Git metadata
   * @returns {number} Trust score (0-100)
   */
  calculateTrustScore(result, gitMetadata) {
    let score = 50; // Base score

    // Has author: +15
    if (result.metadata.author !== 'unknown') {
      score += 15;
    }

    // Has repository: +15
    if (result.metadata.repository !== 'unknown') {
      score += 15;
    }

    // Has version: +10
    if (result.metadata.version !== 'unversioned') {
      score += 10;
    }

    // Has Git metadata: +10
    if (gitMetadata) {
      score += 10;
    }

    // Deduct for warnings and errors
    score -= result.warningCount * 2;
    score -= result.errorCount * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Batch validate provenance for multiple components
   * @param {Array<object>} components - Components to validate
   * @returns {Promise<object>} Batch validation results
   */
  async batchValidate(components) {
    const results = {
      total: components.length,
      traceable: 0,
      untraceable: 0,
      averageTrustScore: 0,
      components: []
    };

    let totalTrustScore = 0;

    for (const component of components) {
      const report = await this.generateProvenanceReport(component);

      results.components.push({
        path: component.path,
        traceable: report.traceable,
        trustScore: report.trustScore,
        author: report.metadata.author,
        repository: report.metadata.repository
      });

      if (report.traceable) {
        results.traceable++;
      } else {
        results.untraceable++;
      }

      totalTrustScore += report.trustScore;
    }

    results.averageTrustScore = Math.round(totalTrustScore / components.length);

    return results;
  }
}

module.exports = ProvenanceValidator;

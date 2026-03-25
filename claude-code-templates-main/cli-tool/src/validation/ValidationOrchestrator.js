const StructuralValidator = require('./validators/StructuralValidator');
const IntegrityValidator = require('./validators/IntegrityValidator');
const SemanticValidator = require('./validators/SemanticValidator');
const ReferenceValidator = require('./validators/ReferenceValidator');
const ProvenanceValidator = require('./validators/ProvenanceValidator');
const chalk = require('chalk');

/**
 * ValidationOrchestrator - Coordinates all validators and generates comprehensive reports
 *
 * Runs all validators in sequence and aggregates results
 */
class ValidationOrchestrator {
  constructor() {
    this.validators = {
      structural: new StructuralValidator(),
      integrity: new IntegrityValidator(),
      semantic: new SemanticValidator(),
      reference: new ReferenceValidator(),
      provenance: new ProvenanceValidator()
    };
  }

  /**
   * Validate a single component with all validators
   * @param {object} component - Component to validate
   * @param {object} options - Validation options
   * @param {Array<string>} options.validators - List of validators to run (default: all)
   * @param {boolean} options.strict - Enable strict mode
   * @param {boolean} options.updateRegistry - Update hash registry
   * @returns {Promise<object>} Comprehensive validation results
   */
  async validateComponent(component, options = {}) {
    const {
      validators = ['structural', 'integrity', 'semantic', 'reference', 'provenance'],
      strict = false,
      updateRegistry = false
    } = options;

    const results = {
      component: {
        path: component.path,
        type: component.type
      },
      timestamp: new Date().toISOString(),
      overall: {
        valid: true,
        score: 0,
        errorCount: 0,
        warningCount: 0
      },
      validators: {}
    };

    // Run each validator
    for (const validatorName of validators) {
      if (!this.validators[validatorName]) {
        console.warn(chalk.yellow(`⚠️  Unknown validator: ${validatorName}`));
        continue;
      }

      try {
        const validator = this.validators[validatorName];
        let validatorOptions = {};

        // Validator-specific options
        if (validatorName === 'semantic') {
          validatorOptions.strict = strict;
        } else if (validatorName === 'integrity') {
          validatorOptions.updateRegistry = updateRegistry;
        }

        const result = await validator.validate(component, validatorOptions);

        results.validators[validatorName] = {
          valid: result.valid,
          score: result.score || 0,
          errorCount: result.errorCount,
          warningCount: result.warningCount,
          errors: result.errors,
          warnings: result.warnings,
          info: result.info
        };

        // Add validator-specific metadata
        if (result.hash) {
          results.validators[validatorName].hash = result.hash;
        }
        if (result.metadata) {
          results.validators[validatorName].metadata = result.metadata;
        }

        // Update overall results
        if (!result.valid) {
          results.overall.valid = false;
        }
        results.overall.errorCount += result.errorCount;
        results.overall.warningCount += result.warningCount;

      } catch (error) {
        results.validators[validatorName] = {
          valid: false,
          error: error.message,
          errorCount: 1,
          warningCount: 0
        };
        results.overall.valid = false;
        results.overall.errorCount++;
      }
    }

    // Calculate overall score (average of all validator scores)
    const scores = Object.values(results.validators)
      .map(v => v.score || 0)
      .filter(s => s > 0);

    if (scores.length > 0) {
      results.overall.score = Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length
      );
    }

    return results;
  }

  /**
   * Validate multiple components
   * @param {Array<object>} components - Components to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Batch validation results
   */
  async validateComponents(components, options = {}) {
    const results = {
      summary: {
        total: components.length,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      components: [],
      timestamp: new Date().toISOString()
    };

    for (const component of components) {
      const result = await this.validateComponent(component, options);

      results.components.push(result);

      if (result.overall.valid) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }

      results.summary.warnings += result.overall.warningCount;
    }

    return results;
  }

  /**
   * Generate human-readable report
   * @param {object} validationResults - Results from validateComponent or validateComponents
   * @param {object} options - Report options
   * @param {boolean} options.verbose - Include detailed information
   * @param {boolean} options.colors - Use colored output (default: true)
   * @returns {string} Formatted report
   */
  generateReport(validationResults, options = {}) {
    const { verbose = false, colors = true } = options;
    const lines = [];

    // Helper functions for colored output
    const success = (text) => colors ? chalk.green(text) : text;
    const error = (text) => colors ? chalk.red(text) : text;
    const warning = (text) => colors ? chalk.yellow(text) : text;
    const info = (text) => colors ? chalk.blue(text) : text;
    const dim = (text) => colors ? chalk.gray(text) : text;

    // Check if this is a batch result or single component result
    const isBatch = validationResults.summary && validationResults.components;

    if (isBatch) {
      // Batch report
      lines.push('');
      lines.push(info('🔒 Security Audit Report'));
      lines.push(dim('━'.repeat(60)));
      lines.push('');

      lines.push(`📊 Summary:`);
      lines.push(`   Total components: ${validationResults.summary.total}`);
      lines.push(`   ${success('✅ Passed')}: ${validationResults.summary.passed}`);
      lines.push(`   ${error('❌ Failed')}: ${validationResults.summary.failed}`);
      lines.push(`   ${warning('⚠️  Warnings')}: ${validationResults.summary.warnings}`);
      lines.push('');

      // Component details
      for (const component of validationResults.components) {
        lines.push(this._formatComponentResult(component, verbose, { success, error, warning, info, dim }));
      }
    } else {
      // Single component report
      lines.push(this._formatComponentResult(validationResults, verbose, { success, error, warning, info, dim }));
    }

    lines.push(dim('━'.repeat(60)));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format a single component result
   * @private
   */
  _formatComponentResult(componentResult, verbose, colors) {
    const { success, error, warning, info, dim } = colors;
    const lines = [];

    const status = componentResult.overall.valid ? success('✅ PASS') : error('❌ FAIL');
    const scoreBadge = this._getScoreBadge(componentResult.overall.score, colors);

    lines.push(`${status} ${componentResult.component.path} ${scoreBadge}`);

    // Validator breakdown
    for (const [validatorName, result] of Object.entries(componentResult.validators)) {
      const validatorStatus = result.valid ? success('✅') : error('❌');
      const validatorScore = result.score ? dim(`(${result.score}/100)`) : '';

      lines.push(`   ├─ ${validatorStatus} ${validatorName}: ${result.errorCount === 0 ? 'PASS' : `${result.errorCount} errors`} ${validatorScore}`);

      // Show errors
      if (result.errors && result.errors.length > 0 && verbose) {
        for (const err of result.errors.slice(0, 3)) {
          lines.push(`   │  ${error('ERROR')}: ${err.message} ${dim(`[${err.code}]`)}`);
        }
        if (result.errors.length > 3) {
          lines.push(`   │  ${dim(`... and ${result.errors.length - 3} more errors`)}`);
        }
      }

      // Show warnings
      if (result.warnings && result.warnings.length > 0 && verbose) {
        for (const warn of result.warnings.slice(0, 2)) {
          lines.push(`   │  ${warning('WARNING')}: ${warn.message} ${dim(`[${warn.code}]`)}`);
        }
        if (result.warnings.length > 2) {
          lines.push(`   │  ${dim(`... and ${result.warnings.length - 2} more warnings`)}`);
        }
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Get score badge with color
   * @private
   */
  _getScoreBadge(score, colors) {
    const { success, error, warning, dim } = colors;

    if (score >= 90) return success(`[${score}/100]`);
    if (score >= 70) return warning(`[${score}/100]`);
    if (score >= 50) return error(`[${score}/100]`);
    return dim(`[${score}/100]`);
  }

  /**
   * Generate JSON report
   * @param {object} validationResults - Results from validateComponent or validateComponents
   * @returns {string} JSON formatted report
   */
  generateJsonReport(validationResults) {
    return JSON.stringify(validationResults, null, 2);
  }

  /**
   * Get all error codes from results
   * @param {object} validationResults - Validation results
   * @returns {Array<string>} Unique error codes
   */
  getErrorCodes(validationResults) {
    const codes = new Set();

    const processResult = (result) => {
      for (const validator of Object.values(result.validators)) {
        if (validator.errors) {
          validator.errors.forEach(err => codes.add(err.code));
        }
      }
    };

    if (validationResults.components) {
      validationResults.components.forEach(processResult);
    } else {
      processResult(validationResults);
    }

    return Array.from(codes).sort();
  }
}

module.exports = ValidationOrchestrator;

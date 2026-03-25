/**
 * BaseValidator - Abstract base class for component validation
 *
 * Provides common validation infrastructure and result formatting
 * All validators extend this class and implement the validate() method
 */
class BaseValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  /**
   * Add an error to the validation results
   * @param {string} code - Error code for identification (e.g., STRUCT_E001)
   * @param {string} message - Human-readable error message
   * @param {object} metadata - Additional context about the error
   */
  addError(code, message, metadata = {}) {
    this.errors.push({
      level: 'error',
      code,
      message,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add a warning to the validation results
   * @param {string} code - Warning code for identification
   * @param {string} message - Human-readable warning message
   * @param {object} metadata - Additional context about the warning
   */
  addWarning(code, message, metadata = {}) {
    this.warnings.push({
      level: 'warning',
      code,
      message,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add an info message to the validation results
   * @param {string} code - Info code for identification
   * @param {string} message - Human-readable info message
   * @param {object} metadata - Additional context
   */
  addInfo(code, message, metadata = {}) {
    this.info.push({
      level: 'info',
      code,
      message,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if validation passed (no errors)
   * @returns {boolean}
   */
  isValid() {
    return this.errors.length === 0;
  }

  /**
   * Calculate validation score (0-100)
   * Errors reduce score more than warnings
   * @returns {number}
   */
  getScore() {
    const errorPenalty = this.errors.length * 25;
    const warningPenalty = this.warnings.length * 5;
    return Math.max(0, 100 - errorPenalty - warningPenalty);
  }

  /**
   * Get all validation results
   * @returns {object}
   */
  getResults() {
    return {
      valid: this.isValid(),
      score: this.getScore(),
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      infoCount: this.info.length,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info
    };
  }

  /**
   * Reset validation state
   */
  reset() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  /**
   * Calculate line number from character index in content
   * @param {string} content - Full content
   * @param {number} index - Character index
   * @returns {object} Line information (line number, column, line text)
   */
  getLineFromIndex(content, index) {
    // Count newlines before the index to get line number
    const beforeIndex = content.substring(0, index);
    const lineNumber = (beforeIndex.match(/\n/g) || []).length + 1;

    // Find the start of the current line
    const lineStart = beforeIndex.lastIndexOf('\n') + 1;

    // Find the end of the current line
    const afterIndex = content.substring(index);
    const nextNewline = afterIndex.indexOf('\n');
    const lineEnd = nextNewline === -1 ? content.length : index + nextNewline;

    // Extract the full line text
    const lineText = content.substring(lineStart, lineEnd);

    // Calculate column (position in the line)
    const column = index - lineStart + 1;

    return {
      line: lineNumber,
      column: column,
      lineText: lineText.trim(),
      position: `${lineNumber}:${column}`
    };
  }

  /**
   * Abstract method - must be implemented by subclasses
   * @param {object} component - Component to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation results
   * @throws {Error} If not implemented
   */
  async validate(component, options = {}) {
    throw new Error('validate() must be implemented by subclass');
  }
}

module.exports = BaseValidator;

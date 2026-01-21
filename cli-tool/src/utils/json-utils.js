/**
 * JSON Utility Functions
 * Safe JSON parsing and manipulation utilities
 */

const chalk = require('chalk');

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {Object} options - Options for parsing
 * @param {*} options.defaultValue - Default value if parsing fails (default: null)
 * @param {boolean} options.silent - Suppress error messages (default: false)
 * @param {string} options.context - Context string for error messages
 * @returns {Object|null} Parsed JSON or default value
 */
function safeJsonParse(jsonString, options = {}) {
  const { defaultValue = null, silent = false, context = '' } = options;

  if (!jsonString || typeof jsonString !== 'string') {
    if (!silent) {
      console.log(chalk.yellow(`⚠️  Invalid JSON input${context ? ` (${context})` : ''}: expected string`));
    }
    return defaultValue;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    if (!silent) {
      console.log(chalk.yellow(`⚠️  JSON parse error${context ? ` (${context})` : ''}: ${error.message}`));
    }
    return defaultValue;
  }
}

/**
 * Safely stringify JSON with error handling
 * @param {*} value - Value to stringify
 * @param {Object} options - Options for stringifying
 * @param {number} options.spaces - Number of spaces for indentation (default: 2)
 * @param {boolean} options.silent - Suppress error messages (default: false)
 * @param {string} options.context - Context string for error messages
 * @returns {string|null} JSON string or null on error
 */
function safeJsonStringify(value, options = {}) {
  const { spaces = 2, silent = false, context = '' } = options;

  try {
    return JSON.stringify(value, null, spaces);
  } catch (error) {
    if (!silent) {
      console.log(chalk.yellow(`⚠️  JSON stringify error${context ? ` (${context})` : ''}: ${error.message}`));
    }
    return null;
  }
}

/**
 * Parse JSONL (JSON Lines) content
 * @param {string} content - JSONL content to parse
 * @param {Object} options - Options for parsing
 * @param {boolean} options.skipInvalid - Skip invalid lines instead of failing (default: true)
 * @param {boolean} options.silent - Suppress error messages (default: false)
 * @returns {Array} Array of parsed JSON objects
 */
function parseJsonl(content, options = {}) {
  const { skipInvalid = true, silent = false } = options;

  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.trim().split('\n').filter(line => line.trim());
  const results = [];
  let errorCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      results.push(JSON.parse(line));
    } catch (error) {
      errorCount++;
      if (!skipInvalid) {
        throw new Error(`Invalid JSON at line ${i + 1}: ${error.message}`);
      }
    }
  }

  if (errorCount > 0 && !silent) {
    console.log(chalk.yellow(`⚠️  Skipped ${errorCount} invalid JSON lines`));
  }

  return results;
}

/**
 * Deep clone an object using JSON serialization
 * @param {*} value - Value to clone
 * @returns {*} Cloned value or null on error
 */
function deepClone(value) {
  if (value === null || value === undefined) {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
}

/**
 * Check if a string is valid JSON
 * @param {string} jsonString - String to validate
 * @returns {boolean} True if valid JSON
 */
function isValidJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return false;
  }

  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get nested property from JSON object using dot notation
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-notation path (e.g., 'a.b.c')
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} Value at path or default value
 */
function getNestedValue(obj, path, defaultValue = undefined) {
  if (!obj || typeof path !== 'string') {
    return defaultValue;
  }

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Set nested property in JSON object using dot notation
 * @param {Object} obj - Object to modify
 * @param {string} path - Dot-notation path (e.g., 'a.b.c')
 * @param {*} value - Value to set
 * @returns {Object} Modified object
 */
function setNestedValue(obj, path, value) {
  if (!obj || typeof path !== 'string') {
    return obj;
  }

  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return obj;
}

module.exports = {
  safeJsonParse,
  safeJsonStringify,
  parseJsonl,
  deepClone,
  isValidJson,
  getNestedValue,
  setNestedValue
};

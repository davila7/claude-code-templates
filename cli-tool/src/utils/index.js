/**
 * Utility Functions Index
 * Re-exports all utility modules for easy importing
 */

const installLocations = require('./install-locations');
const jsonUtils = require('./json-utils');

module.exports = {
  // Install location utilities
  ...installLocations,

  // JSON utilities
  ...jsonUtils
};

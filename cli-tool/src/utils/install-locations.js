/**
 * Install Location Utilities
 * Shared utilities for determining installation locations for settings and hooks
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

/**
 * Get available installation location choices for inquirer
 * @returns {Array} Array of choice objects for inquirer
 */
function getInstallLocationChoices() {
  return [
    {
      name: '🏠 User settings (~/.claude/settings.json) - Applies to all projects',
      value: 'user'
    },
    {
      name: '📁 Project settings (.claude/settings.json) - Shared with team',
      value: 'project'
    },
    {
      name: '⚙️  Local settings (.claude/settings.local.json) - Personal, not committed',
      value: 'local',
      checked: true // Default selection
    },
    {
      name: '🏢 Enterprise managed settings - System-wide policy (requires admin)',
      value: 'enterprise'
    }
  ];
}

/**
 * Resolve the target directory and settings file for an installation location
 * @param {string} location - Installation location ('user', 'project', 'local', 'enterprise')
 * @param {string} projectDir - Current project directory
 * @returns {Object} Object containing targetDir, settingsFile, and isEnterprise flag
 */
function resolveInstallLocation(location, projectDir) {
  let targetDir = projectDir;
  let settingsFile = 'settings.local.json'; // default
  let isEnterprise = false;

  switch (location) {
    case 'user':
      targetDir = os.homedir();
      settingsFile = 'settings.json';
      break;

    case 'project':
      settingsFile = 'settings.json';
      break;

    case 'local':
      settingsFile = 'settings.local.json';
      break;

    case 'enterprise':
      isEnterprise = true;
      settingsFile = 'managed-settings.json';

      const platform = os.platform();
      if (platform === 'darwin') {
        // macOS
        targetDir = '/Library/Application Support/ClaudeCode';
      } else if (platform === 'linux' || (process.platform === 'win32' && process.env.WSL_DISTRO_NAME)) {
        // Linux and WSL
        targetDir = '/etc/claude-code';
      } else if (platform === 'win32') {
        // Windows
        targetDir = 'C:\\ProgramData\\ClaudeCode';
      } else {
        // Fallback to user settings for unsupported platforms
        console.log(chalk.yellow('⚠️  Platform not supported for enterprise settings. Using user settings instead.'));
        targetDir = os.homedir();
        settingsFile = 'settings.json';
        isEnterprise = false;
      }

      if (isEnterprise) {
        console.log(chalk.yellow(`⚠️  Enterprise settings require administrator privileges.`));
        console.log(chalk.gray(`📍 Target path: ${path.join(targetDir, settingsFile)}`));
      }
      break;
  }

  return { targetDir, settingsFile, isEnterprise };
}

/**
 * Get the full path to the settings file for an installation location
 * @param {string} location - Installation location
 * @param {string} projectDir - Current project directory
 * @returns {Object} Object containing claudeDir and actualTargetFile paths
 */
function getSettingsFilePath(location, projectDir) {
  const { targetDir, settingsFile, isEnterprise } = resolveInstallLocation(location, projectDir);

  const claudeDir = path.join(targetDir, '.claude');
  const targetSettingsFile = path.join(claudeDir, settingsFile);

  // For enterprise settings, the file is directly in the enterprise directory
  const actualTargetFile = isEnterprise
    ? path.join(targetDir, settingsFile)
    : targetSettingsFile;

  return {
    claudeDir,
    actualTargetFile,
    targetDir,
    settingsFile,
    isEnterprise
  };
}

/**
 * Ensure the target directory exists for an installation location
 * @param {string} location - Installation location
 * @param {string} projectDir - Current project directory
 * @returns {Promise<boolean>} True if directory was created/exists, false on error
 */
async function ensureInstallDirectory(location, projectDir) {
  const { claudeDir, targetDir, isEnterprise } = getSettingsFilePath(location, projectDir);

  try {
    if (isEnterprise) {
      // Enterprise settings go directly in the enterprise directory
      await fs.ensureDir(targetDir);
    } else {
      // Regular settings go in .claude directory
      await fs.ensureDir(claudeDir);
    }
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Failed to create directory: ${error.message}`));
    if (isEnterprise) {
      console.log(chalk.yellow('💡 Try running with administrator privileges or choose a different installation location.'));
    }
    return false;
  }
}

/**
 * Read existing configuration from an installation location
 * @param {string} location - Installation location
 * @param {string} projectDir - Current project directory
 * @returns {Promise<Object>} Existing configuration or empty object
 */
async function readExistingConfig(location, projectDir) {
  const { actualTargetFile } = getSettingsFilePath(location, projectDir);

  try {
    if (await fs.pathExists(actualTargetFile)) {
      return await fs.readJson(actualTargetFile);
    }
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not read existing configuration: ${error.message}`));
  }

  return {};
}

/**
 * Merge two configuration objects with deep merge for specific sections
 * @param {Object} existing - Existing configuration
 * @param {Object} newConfig - New configuration to merge
 * @returns {Object} Merged configuration
 */
function mergeConfigurations(existing, newConfig) {
  const merged = {
    ...existing,
    ...newConfig
  };

  // Deep merge permissions
  if (existing.permissions && newConfig.permissions) {
    merged.permissions = {
      ...existing.permissions,
      ...newConfig.permissions
    };

    // Merge arrays for allow, deny, ask (deduplicate)
    ['allow', 'deny', 'ask'].forEach(key => {
      if (existing.permissions[key] && newConfig.permissions[key]) {
        merged.permissions[key] = [
          ...new Set([...existing.permissions[key], ...newConfig.permissions[key]])
        ];
      }
    });
  }

  // Deep merge env
  if (existing.env && newConfig.env) {
    merged.env = {
      ...existing.env,
      ...newConfig.env
    };
  }

  // Deep merge hooks
  if (existing.hooks && newConfig.hooks) {
    merged.hooks = {
      ...existing.hooks,
      ...newConfig.hooks
    };
  }

  return merged;
}

/**
 * Check for configuration conflicts between existing and new config
 * @param {Object} existing - Existing configuration
 * @param {Object} newConfig - New configuration
 * @returns {Array} Array of conflict descriptions
 */
function detectConfigConflicts(existing, newConfig) {
  const conflicts = [];

  // Check for conflicting environment variables
  if (existing.env && newConfig.env) {
    Object.keys(newConfig.env).forEach(key => {
      if (existing.env[key] && existing.env[key] !== newConfig.env[key]) {
        conflicts.push(`Environment variable "${key}" (current: "${existing.env[key]}", new: "${newConfig.env[key]}")`);
      }
    });
  }

  // Check for conflicting top-level settings
  Object.keys(newConfig).forEach(key => {
    if (key !== 'permissions' && key !== 'env' && key !== 'hooks' && key !== 'description' && key !== 'files' &&
        existing[key] !== undefined && JSON.stringify(existing[key]) !== JSON.stringify(newConfig[key])) {

      if (typeof existing[key] === 'object' && existing[key] !== null &&
          typeof newConfig[key] === 'object' && newConfig[key] !== null) {
        conflicts.push(`Setting "${key}" (will be overwritten with new configuration)`);
      } else {
        conflicts.push(`Setting "${key}" (current: "${existing[key]}", new: "${newConfig[key]}")`);
      }
    }
  });

  return conflicts;
}

module.exports = {
  getInstallLocationChoices,
  resolveInstallLocation,
  getSettingsFilePath,
  ensureInstallDirectory,
  readExistingConfig,
  mergeConfigurations,
  detectConfigConflicts
};

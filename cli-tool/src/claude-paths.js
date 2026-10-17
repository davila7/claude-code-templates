const os = require('os');
const path = require('path');

/**
 * Resolve Claude Code's user-data directory.
 * CLAUDE_CONFIG_DIR takes precedence over homeDir and relative values resolve
 * from the current working directory, matching Node's normal path semantics.
 */
function getClaudeConfigDir(homeDir = os.homedir(), env = process.env) {
  const configuredDir = env.CLAUDE_CONFIG_DIR?.trim();
  return configuredDir ? path.resolve(configuredDir) : path.join(homeDir, '.claude');
}

module.exports = { getClaudeConfigDir };

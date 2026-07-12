const os = require('os');
const path = require('path');

function getClaudeConfigDir(homeDir = os.homedir(), env = process.env) {
  const configuredDir = env.CLAUDE_CONFIG_DIR?.trim();
  return configuredDir ? path.resolve(configuredDir) : path.join(homeDir, '.claude');
}

module.exports = { getClaudeConfigDir };

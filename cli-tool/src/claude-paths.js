'use strict';

/**
 * Where Claude Code keeps its user data (settings, agents, commands and the
 * projects/ transcripts): CLAUDE_CONFIG_DIR when it is set, otherwise ~/.claude.
 * Built-ins only: plugin-install.js uses it in the root test job, which runs
 * without npm install.
 */

const os = require('os');
const path = require('path');

function claudeConfigDir(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

module.exports = { claudeConfigDir };

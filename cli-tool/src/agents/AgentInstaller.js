/**
 * AgentInstaller - Handles installation of Claude Code agents
 * 
 * Responsible for copying agent files to project's .claude/agents directory
 * and tracking which agents are already installed.
 */
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Ensure the .claude/agents directory exists
 * @param {string} projectPath - Project root directory
 * @returns {Promise<string>} Path to agents directory
 */
async function ensureAgentsDirectory(projectPath) {
  const agentsDir = path.join(projectPath, '.claude', 'agents');
  await fs.ensureDir(agentsDir);
  return agentsDir;
}

/**
 * Install a single agent to the target directory
 * @param {Object} agent - Agent object with name, filePath, language, framework
 * @param {string} agentsDir - Target directory for agent files
 * @returns {Promise<Object>} Result object with success status
 */
async function installSingleAgent(agent, agentsDir) {
  if (!agent?.filePath) {
    return { success: false, name: agent?.name, reason: 'not_found' };
  }
  
  if (!await fs.pathExists(agent.filePath)) {
    return { success: false, name: agent.name, reason: 'source_missing' };
  }
  
  const targetFile = path.join(agentsDir, `${agent.name}.md`);
  await fs.copy(agent.filePath, targetFile);
  return { success: true, name: agent.name, agent };
}

/**
 * Log installation results to console
 * @param {Array} results - Array of installation result objects
 * @returns {boolean} True if at least one agent was installed
 */
function logInstallResults(results) {
  const installed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  for (const result of installed) {
    console.log(chalk.green(`✓ Installed agent: ${result.name} (${result.agent.language}/${result.agent.framework})`));
  }
  
  for (const result of failed) {
    const msg = result.reason === 'source_missing' 
      ? `Agent source file not found: ${result.name}`
      : `Agent not found: ${result.name}`;
    console.log(chalk.yellow(`⚠️  ${msg}`));
  }
  
  if (installed.length > 0) {
    console.log(chalk.green(`\n🎉 Successfully installed ${installed.length} agent(s) to .claude/agents/`));
    console.log(chalk.blue('   You can now use these agents in your Claude Code conversations!'));
  } else {
    console.log(chalk.yellow('⚠️  No agents were installed'));
  }
  
  return installed.length > 0;
}

/**
 * Install selected agents to the project's .claude/agents directory
 * @param {Array} selectedAgents - Array of agent names to install
 * @param {string} projectPath - Project directory path
 * @param {Function} getAvailableAgentsFn - Function to retrieve available agents
 * @returns {Promise<boolean>} Success status
 */
async function installAgents(selectedAgents, projectPath = process.cwd(), getAvailableAgentsFn) {
  try {
    const agentsDir = await ensureAgentsDirectory(projectPath);
    const allAgents = getAvailableAgentsFn();
    
    const results = await Promise.all(
      selectedAgents.map(name => {
        const agent = allAgents.find(a => a.name === name);
        return installSingleAgent(agent, agentsDir);
      })
    );
    
    return logInstallResults(results);
  } catch (error) {
    console.error(chalk.red('❌ Failed to install agents:'), error.message);
    return false;
  }
}

/**
 * Check if project already has agents installed
 * @param {string} projectPath - Project directory path
 * @returns {Promise<Array>} Array of installed agent names
 */
async function getInstalledAgents(projectPath = process.cwd()) {
  try {
    const agentsDir = path.join(projectPath, '.claude', 'agents');
    
    if (!await fs.pathExists(agentsDir)) {
      return [];
    }
    
    const agentFiles = await fs.readdir(agentsDir);
    return agentFiles
      .filter(file => file.endsWith('.md'))
      .map(file => path.basename(file, '.md'));
  } catch (error) {
    return [];
  }
}

module.exports = {
  installAgents,
  getInstalledAgents,
  // Expose internals for testing
  ensureAgentsDirectory,
  installSingleAgent,
  logInstallResults
};

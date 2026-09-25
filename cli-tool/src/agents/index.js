/**
 * Agents module - re-exports all agent-related functionality
 */
const {
  installAgents,
  getInstalledAgents,
  ensureAgentsDirectory,
  installSingleAgent,
  logInstallResults
} = require('./AgentInstaller');

module.exports = {
  installAgents,
  getInstalledAgents,
  ensureAgentsDirectory,
  installSingleAgent,
  logInstallResults
};

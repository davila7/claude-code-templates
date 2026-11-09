globalThis.process ??= {}; globalThis.process.env ??= {};
const VALID_COMMANDS = [
  "chats",
  "analytics",
  "health-check",
  "plugins",
  "sandbox",
  "agents",
  "chats-mobile",
  "studio",
  "command-stats",
  "hook-stats",
  "mcp-stats",
  "skills-manager",
  "2025-year-in-review",
  "teams",
  "catalog-browser",
  // 1.31.0+: a removed flag was run (metadata.flag says which one)
  "removed-command",
  // 1.31.0+: --workflow (components come inline, so they are not downloads)
  "workflow",
  // 1.33.0+: --search (only that it ran and how many results; never the words)
  "search",
  // reserved for 1.34 (--check-updates / --update), accepted ahead of the CLI release
  "check-updates",
  "update"
];
const COMPONENT_TYPES = [
  "agent",
  "command",
  "mcp",
  "setting",
  "hook",
  "skill",
  "loop",
  "mod",
  // CLI after 1.32.1: --plugin (catalog plugins installed through the aitmpl marketplace)
  "plugin",
  "template"
];
const OUTCOMES = ["success", "failure", "partial"];
function validateCommandData(data) {
  const { command } = data;
  if (!command) {
    return { valid: false, error: "Command name is required" };
  }
  if (typeof command !== "string" || !VALID_COMMANDS.includes(command)) {
    return { valid: false, error: "Invalid command name" };
  }
  return { valid: true, error: null };
}
function validateOutcomeData(data) {
  const { componentType, componentName, outcome } = data;
  if (!componentType || !componentName || !outcome) {
    return { valid: false, error: "componentType, componentName, and outcome are required" };
  }
  if (typeof componentType !== "string" || !COMPONENT_TYPES.includes(componentType)) {
    return { valid: false, error: "Invalid component type" };
  }
  if (typeof outcome !== "string" || !OUTCOMES.includes(outcome)) {
    return { valid: false, error: "Invalid outcome. Must be: success, failure, or partial" };
  }
  if (typeof componentName !== "string" || componentName.length > 255) {
    return { valid: false, error: "Component name too long" };
  }
  return { valid: true, error: null };
}

export { COMPONENT_TYPES as C, validateOutcomeData as a, validateCommandData as v };

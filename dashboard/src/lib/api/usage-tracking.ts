// Validation lists for the CLI usage endpoints (/api/track-command-usage,
// /api/track-installation-outcome and /api/track-download-supabase), kept
// apart from the routes so tests/usage-tracking.test.ts can check them
// against what cli-tool actually sends. Old CLI versions keep sending the
// names of commands that were removed later, so never drop a name.

export const VALID_COMMANDS = [
  'chats',
  'analytics',
  'health-check',
  'plugins',
  'sandbox',
  'agents',
  'chats-mobile',
  'studio',
  'command-stats',
  'hook-stats',
  'mcp-stats',
  'skills-manager',
  '2025-year-in-review',
  'teams',
  'catalog-browser',
  // 1.31.0+: a removed flag was run (metadata.flag says which one)
  'removed-command',
  // 1.31.0+: --workflow (components come inline, so they are not downloads)
  'workflow',
  // 1.33.0+: --search (only that it ran and how many results; never the words)
  'search',
  // reserved for 1.34 (--check-updates / --update), accepted ahead of the CLI release
  'check-updates',
  'update',
] as const;

// Component types the CLI installs and reports through trackDownload() and
// trackInstallationOutcome() in cli-tool/src/index.js.
export const COMPONENT_TYPES = [
  'agent',
  'command',
  'mcp',
  'setting',
  'hook',
  'skill',
  'loop',
  'mod',
  // CLI after 1.32.1: --plugin (catalog plugins installed through the aitmpl marketplace)
  'plugin',
  'template',
] as const;

export const OUTCOMES = ['success', 'failure', 'partial'] as const;

type Validation = { valid: true; error: null } | { valid: false; error: string };

export function validateCommandData(data: { command?: unknown }): Validation {
  const { command } = data;

  if (!command) {
    return { valid: false, error: 'Command name is required' };
  }

  if (typeof command !== 'string' || !(VALID_COMMANDS as readonly string[]).includes(command)) {
    return { valid: false, error: 'Invalid command name' };
  }

  return { valid: true, error: null };
}

export function validateOutcomeData(data: {
  componentType?: unknown;
  componentName?: unknown;
  outcome?: unknown;
}): Validation {
  const { componentType, componentName, outcome } = data;

  if (!componentType || !componentName || !outcome) {
    return { valid: false, error: 'componentType, componentName, and outcome are required' };
  }

  if (typeof componentType !== 'string' || !(COMPONENT_TYPES as readonly string[]).includes(componentType)) {
    return { valid: false, error: 'Invalid component type' };
  }

  if (typeof outcome !== 'string' || !(OUTCOMES as readonly string[]).includes(outcome)) {
    return { valid: false, error: 'Invalid outcome. Must be: success, failure, or partial' };
  }

  if (typeof componentName !== 'string' || componentName.length > 255) {
    return { valid: false, error: 'Component name too long' };
  }

  return { valid: true, error: null };
}

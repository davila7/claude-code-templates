/**
 * Detects whether the CLI was launched by an AI coding agent, for the
 * anonymous download analytics in tracking-service.js.
 *
 * Only a short agent name is reported, never the value of an environment
 * variable that could identify a person or session (Claude Code also exports
 * the account email, account id and session id; none of those are read here).
 *
 * The env checks follow @vercel/detect-agent 1.2.7 (Apache-2.0), inlined so the
 * CLI keeps its dependency list small. The result is self-reported: anyone can
 * set these variables, so it is a statistic, not proof.
 */

const fs = require('fs');

const KNOWN_AGENTS = [
  'claude', 'cowork', 'cursor', 'cursor-cli', 'codex', 'gemini', 'github-copilot',
  'opencode', 'augment-cli', 'antigravity', 'devin', 'replit', 'v0', 'other'
];

// AI_AGENT spellings seen in the wild, mapped to a name in KNOWN_AGENTS.
// Claude Code sets AI_AGENT=claude-code_<version>_agent.
const AI_AGENT_ALIASES = {
  'claude-code': 'claude',
  'claude': 'claude',
  'cowork': 'cowork',
  'cursor': 'cursor',
  'cursor-cli': 'cursor-cli',
  'codex': 'codex',
  'gemini': 'gemini',
  'gemini-cli': 'gemini',
  'github-copilot': 'github-copilot',
  'github-copilot-cli': 'github-copilot',
  'copilot': 'github-copilot',
  'opencode': 'opencode',
  'augment-cli': 'augment-cli',
  'antigravity': 'antigravity',
  'devin': 'devin',
  'replit': 'replit',
  'v0': 'v0'
};

function normalizeAiAgent(value) {
  const name = String(value).trim().toLowerCase().split('_')[0];
  if (!name) return null;
  return AI_AGENT_ALIASES[name] || 'other';
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {(path: string) => boolean} exists
 * @returns {string|null} a name from KNOWN_AGENTS, or null when no agent is detected
 */
function detectAgentName(env = process.env, exists = fs.existsSync) {
  if (env.AI_AGENT && env.AI_AGENT.trim()) return normalizeAiAgent(env.AI_AGENT);
  if (env.CURSOR_TRACE_ID) return 'cursor';
  if (env.CURSOR_AGENT || env.CURSOR_EXTENSION_HOST_ROLE === 'agent-exec') return 'cursor-cli';
  if (env.GEMINI_CLI) return 'gemini';
  if (env.CODEX_SANDBOX || env.CODEX_CI || env.CODEX_THREAD_ID) return 'codex';
  if (env.ANTIGRAVITY_AGENT) return 'antigravity';
  if (env.AUGMENT_AGENT) return 'augment-cli';
  if (env.OPENCODE === '1' || env.OPENCODE_CLIENT) return 'opencode';
  if (env.CLAUDECODE || env.CLAUDE_CODE) return env.CLAUDE_CODE_IS_COWORK ? 'cowork' : 'claude';
  if (env.REPL_ID) return 'replit';
  if (env.COPILOT_MODEL || env.COPILOT_ALLOW_ALL || env.COPILOT_GITHUB_TOKEN) return 'github-copilot';
  try {
    if (exists('/opt/.devin')) return 'devin';
  } catch (_) {
    // fall through
  }
  return null;
}

/**
 * Claude Code's launch surface (cli, sdk-ts, sdk-py, claude-desktop, ...).
 * Only kept when it looks like a short slug.
 */
function detectEntrypoint(env = process.env) {
  const value = (env.CLAUDE_CODE_ENTRYPOINT || '').trim().toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(value) ? value : null;
}

/**
 * @returns {{ agent: string|null, entrypoint: string|null, isTty: boolean }}
 */
function detectClient(env = process.env, stdout = process.stdout, exists = fs.existsSync) {
  return {
    agent: detectAgentName(env, exists),
    entrypoint: detectEntrypoint(env),
    isTty: Boolean(stdout && stdout.isTTY)
  };
}

module.exports = { detectClient, detectAgentName, detectEntrypoint, KNOWN_AGENTS };

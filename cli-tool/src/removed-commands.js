const chalk = require('chalk');
const { trackingService } = require('./tracking-service');

// Flags removed in 1.31.0. They stay registered (hidden from --help) so that
// running one prints what replaced it instead of commander's "unknown option".
const REMOVED_IN = '1.31.0';
const LAST_VERSION_WITH_THEM = '1.30.0';

const STACK_VIEWER = 'npx claude-code-templates@latest --mod ui/stack-viewer, then /stack in Claude Code';

const REMOVED_COMMANDS = [
  { flag: '--plugins', use: `Run /plugin inside Claude Code, or install the stack viewer mod: ${STACK_VIEWER}.` },
  { flag: '--skills-manager', use: `Install the stack viewer mod: ${STACK_VIEWER}.` },
  { flag: '--command-stats', use: `Install the stack viewer mod: ${STACK_VIEWER}.` },
  { flag: '--commands-stats', use: `Install the stack viewer mod: ${STACK_VIEWER}.` },
  { flag: '--hook-stats', use: `Run /hooks inside Claude Code, or install the stack viewer mod: ${STACK_VIEWER}.` },
  { flag: '--hooks-stats', use: `Run /hooks inside Claude Code, or install the stack viewer mod: ${STACK_VIEWER}.` },
  { flag: '--mcp-stats', use: `Run /mcp inside Claude Code, or install the stack viewer mod: ${STACK_VIEWER}.` },
  { flag: '--mcps-stats', use: `Run /mcp inside Claude Code, or install the stack viewer mod: ${STACK_VIEWER}.` },
  { flag: '--agents', use: 'Run npx claude-code-templates@latest --analytics: it is the same dashboard.' },
  { flag: '--chats-mobile', use: 'Run npx claude-code-templates@latest --chats.' },
  { flag: '--teams' },
  { flag: '--2025' },
  // No "still need it" line: 1.30.0 would publish the conversation history
  // on an unauthenticated public URL, which is why --tunnel was removed.
  { flag: '--tunnel', noFallback: true, use: 'The dashboards now listen on 127.0.0.1 only. To reach one from another machine, forward the port over SSH: ssh -L 3333:localhost:3333 <host> (9876 for --chats).' },
  { flag: '--studio' },
  { flag: '--sandbox', takesValue: true, use: 'The sandbox launchers are still in the repository: https://github.com/davila7/claude-code-templates/tree/main/cli-tool/components/sandbox' },
  // Options of --sandbox: reported on their own only when --sandbox is absent.
  { flag: '--e2b-api-key', takesValue: true, partOf: '--sandbox', noFallback: true, use: 'It only worked with --sandbox, which was removed too.' },
  { flag: '--anthropic-api-key', takesValue: true, partOf: '--sandbox', noFallback: true, use: 'It only worked with --sandbox, which was removed too.' },
  // Global agents already created are standalone scripts and keep working.
  { flag: '--create-agent', takesValue: true, use: `Install the agent into Claude Code instead: npx claude-code-templates@latest --agent <category/name>. Global agents created before ${REMOVED_IN} keep working.` },
  { flag: '--list-agents', use: 'Global agents created with earlier versions are in ~/.claude-code-templates/agents/ and keep working.' },
  { flag: '--remove-agent', takesValue: true, use: 'To delete a global agent by hand, remove ~/.claude-code-templates/bin/<name> (or /usr/local/bin/<name>) and ~/.claude-code-templates/agents/<name>.md.' },
  { flag: '--update-agent', takesValue: true, use: 'Global agents created with earlier versions keep working as they are. For the latest version, install the agent into Claude Code: npx claude-code-templates@latest --agent <category/name>.' },
  { flag: '--clone-session', takesValue: true }
];

function attributeName(flag) {
  // Same rule commander uses: drop the dashes, camelCase the rest.
  return flag.replace(/^--/, '').split('-').reduce((name, word, index) =>
    index === 0 ? word : name + word.charAt(0).toUpperCase() + word.slice(1), '');
}

/**
 * Register every removed flag on a commander program, hidden from --help.
 * Flags that used to take a value accept an optional one so that
 * `--sandbox` alone and `--sandbox e2b` both reach the removal message.
 */
function registerRemovedOptions(program, Option) {
  for (const entry of REMOVED_COMMANDS) {
    const spec = entry.takesValue ? `${entry.flag} [value]` : entry.flag;
    program.addOption(new Option(spec, `removed in ${REMOVED_IN}`).hideHelp());
  }
}

function isPresent(options, flag) {
  const value = options[attributeName(flag)];
  return value !== undefined && value !== false;
}

/**
 * The removed flags present in parsed commander options, in declaration
 * order. An option of another removed flag (--e2b-api-key of --sandbox) is
 * left out when that flag is present too, so one command gets one message.
 */
function findRemovedCommands(options = {}) {
  return REMOVED_COMMANDS.filter(entry =>
    isPresent(options, entry.flag) && !(entry.partOf && isPresent(options, entry.partOf)));
}

/**
 * Explain each removed flag, count the attempt (flag name only, never its
 * value: --anthropic-api-key carried a secret) and wait for the tracking
 * request so it is not cut off when the process exits.
 */
async function reportRemovedCommands(removed, { log = console.error } = {}) {
  for (const entry of removed) {
    log(chalk.red(`✖ ${entry.flag} was removed in ${REMOVED_IN}.`) + (entry.use ? ` ${entry.use}` : ''));
    if (!entry.noFallback) {
      log(chalk.gray(`  Still need it? npx claude-code-templates@${LAST_VERSION_WITH_THEM} ${entry.flag}${entry.takesValue ? ' <value>' : ''}`));
    }
  }
  await Promise.all(removed.map(entry =>
    trackingService.trackCommandExecution('removed-command', { flag: entry.flag })));
}

module.exports = {
  REMOVED_IN,
  LAST_VERSION_WITH_THEM,
  REMOVED_COMMANDS,
  attributeName,
  registerRemovedOptions,
  findRemovedCommands,
  reportRemovedCommands
};

#!/usr/bin/env node

const { program, Option } = require('commander');
const chalk = require('chalk');
const { createClaudeConfig } = require('../src/index');
const { showBanner } = require('../src/tui');
const { captureCliError } = require('../src/error-reporting');
const { registerRemovedOptions, findRemovedCommands } = require('../src/removed-commands');

const pkg = require('../package.json');

program
  .name('create-claude-config')
  .description('Install Claude Code components (agents, commands, MCPs, hooks, settings, skills, loops, mods, plugins) from aitmpl.com')
  .version(require('../package.json').version)
  .option('-l, --language <language>', 'specify programming language (deprecated, use --template)')
  .option('-f, --framework <framework>', 'specify framework (deprecated, use --template)')
  .option('-t, --template <template>', 'specify template (e.g., common, javascript-typescript, python, ruby)')
  .option('-d, --directory <directory>', 'target directory (default: current directory)')
  .option('-y, --yes', 'skip prompts and use defaults')
  .option('--dry-run', 'show what would be copied without actually copying')
  .option('--analytics', 'launch the local Claude Code analytics dashboard (http://localhost:3333)')
  .option('--chats', 'browse your Claude Code conversations in a local web UI (http://localhost:9876)')
  .option('--verbose', 'enable verbose logging for debugging and development')
  .option('--health-check, --health', 'run comprehensive health check to verify Claude Code setup')
  // commander reads only the first two flags of one option, so the older
  // aliases need options of their own (before 1.31.0 they were rejected).
  .addOption(new Option('--check', 'alias of --health-check').hideHelp())
  .addOption(new Option('--verify', 'alias of --health-check').hideHelp())
  .option('--agent <agent>', 'install specific agent component (supports comma-separated values)')
  .option('--command <command>', 'install specific command component (supports comma-separated values)')
  .option('--mcp <mcp>', 'install specific MCP component (supports comma-separated values)')
  .option('--setting <setting>', 'install specific setting component (supports comma-separated values)')
  .option('--hook <hook>', 'install specific hook component (supports comma-separated values)')
  .option('--skill <skill>', 'install specific skill component (supports comma-separated values)')
  .option('--loop <loop>', 'install specific loop component and its referenced components (supports comma-separated values)')
  .option('--mod <mod>', 'install specific Claude Mod (function-hooks plugin) as a local plugin (supports comma-separated values)')
  .option('--plugin <plugin>', 'install a Claude Code plugin from the aitmpl marketplace with Claude Code itself, pinned to its reviewed commit (supports comma-separated values)')
  .option('--scope <scope>', 'where --plugin enables the plugin: project (.claude/settings.json, default), user (~/.claude/settings.json) or local (.claude/settings.local.json)')
  .addOption(new Option('--function-hook <mod>', 'alias of --mod (kept for older docs)').hideHelp())
  .option('--search <words>', 'search the catalog by text: top 5 matches with their page and install command (installs nothing)')
  .option('--workflow <workflow>', 'install workflow from hash (#hash) OR workflow YAML (base64 encoded) when used with --agent/--command/--mcp')
  .option('--prompt <prompt>', 'execute the provided prompt in Claude Code after installation');

// Flags removed in 1.31.0: hidden, and answered with what replaced them.
registerRemovedOptions(program, Option);

program.action(async (options) => {
  try {
    // Component installs print their own one-line header (src/install-ui.js),
    // and a removed flag prints only its replacement.
    const isComponentInstall = Boolean(options.agent || options.command || options.mcp || options.setting ||
                                       options.hook || options.skill || options.loop || options.mod || options.functionHook || options.plugin);
    const isQuietCommand = isComponentInstall || options.search !== undefined || findRemovedCommands(options).length > 0;

    // No arguments opens the catalog browser, which prints its own header
    // (or plain usage text when there is no terminal).
    const isBareRun = process.argv.length <= 2;
    if (!isQuietCommand && !isBareRun) {
      showBanner(pkg.version);
    }

    await createClaudeConfig(options);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    await captureCliError(error, { command: 'createClaudeConfig' });
    process.exit(1);
  }
});

program.parse(process.argv);

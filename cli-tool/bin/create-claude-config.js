#!/usr/bin/env node

const { program, Option } = require('commander');
const chalk = require('chalk');
const { createClaudeConfig } = require('../src/index');
const { showBanner } = require('../src/tui');
const { captureCliError } = require('../src/error-reporting');

const pkg = require('../package.json');

program
  .name('create-claude-config')
  .description('Setup Claude Code configurations and create global AI agents powered by Claude Code SDK')
  .version(require('../package.json').version)
  .option('-l, --language <language>', 'specify programming language (deprecated, use --template)')
  .option('-f, --framework <framework>', 'specify framework (deprecated, use --template)')
  .option('-t, --template <template>', 'specify template (e.g., common, javascript-typescript, python, ruby)')
  .option('-d, --directory <directory>', 'target directory (default: current directory)')
  .option('-y, --yes', 'skip prompts and use defaults')
  .option('--dry-run', 'show what would be copied without actually copying')
  .option('--command-stats, --commands-stats', 'analyze existing Claude Code commands and offer optimization')
  .option('--hook-stats, --hooks-stats', 'analyze existing automation hooks and offer optimization')
  .option('--mcp-stats, --mcps-stats', 'analyze existing MCP server configurations and offer optimization')
  .option('--analytics', 'launch real-time Claude Code analytics dashboard')
  .option('--chats', 'launch mobile-first chats interface (AI-optimized for mobile devices)')
  .option('--agents', 'launch Claude Code agents dashboard (opens directly to conversations)')
  .option('--chats-mobile', 'launch mobile-first chats interface (AI-optimized for mobile devices)')
  .option('--plugins', 'launch Plugin Dashboard to view marketplaces, installed plugins, and permissions')
  .option('--skills-manager', 'launch Skills Dashboard to view and explore installed Claude Code Skills')
  .option('--teams', 'launch Agent Teams Dashboard to review multi-agent collaboration sessions')
  .option('--2025', 'launch 2025 Year in Review dashboard (showcase your Claude Code usage statistics)')
  .option('--tunnel', 'enable Cloudflare Tunnel for remote access (use with --analytics or --chats)')
  .option('--verbose', 'enable verbose logging for debugging and development')
  .option('--health-check, --health, --check, --verify', 'run comprehensive health check to verify Claude Code setup')
  .option('--agent <agent>', 'install specific agent component (supports comma-separated values)')
  .option('--command <command>', 'install specific command component (supports comma-separated values)')
  .option('--mcp <mcp>', 'install specific MCP component (supports comma-separated values)')
  .option('--setting <setting>', 'install specific setting component (supports comma-separated values)')
  .option('--hook <hook>', 'install specific hook component (supports comma-separated values)')
  .option('--skill <skill>', 'install specific skill component (supports comma-separated values)')
  .option('--loop <loop>', 'install specific loop component and its referenced components (supports comma-separated values)')
  .option('--mod <mod>', 'install specific Claude Mod (function-hooks plugin) as a local plugin (EARLY ACCESS: needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1; supports comma-separated values)')
  .addOption(new Option('--function-hook <mod>', 'alias of --mod (kept for older docs)').hideHelp())
  .option('--workflow <workflow>', 'install workflow from hash (#hash) OR workflow YAML (base64 encoded) when used with --agent/--command/--mcp')
  .option('--prompt <prompt>', 'execute the provided prompt in Claude Code after installation or in sandbox')
  .option('--create-agent <agent>', 'create a global agent accessible from anywhere (e.g., customer-support)')
  .option('--list-agents', 'list all installed global agents')
  .option('--remove-agent <agent>', 'remove a global agent')
  .option('--update-agent <agent>', 'update a global agent to the latest version')
  .option('--studio', 'launch Claude Code Studio interface for local and cloud execution')
  .option('--sandbox <provider>', 'execute Claude Code in isolated sandbox environment (e.g., e2b)')
  .option('--e2b-api-key <key>', 'E2B API key for sandbox execution (alternative to environment variable)')
  .option('--anthropic-api-key <key>', 'Anthropic API key for Claude Code (alternative to environment variable)')
  .option('--clone-session <url>', 'download and import a shared Claude Code session from URL')
  .option('--orcarouter-api-key [key]', 'store an OrcaRouter API key (sk-orca-...) and route Claude Code through OrcaRouter (omit the value to be prompted)')
  .option('--orcarouter-connect', 'sign in with an OrcaRouter account (OAuth 2.0 + PKCE) and store the issued key')
  .option('--orcarouter-status', 'show OrcaRouter authentication options, stored credential (masked) and model catalog status')
  .option('--orcarouter-models [capability]', 'list OrcaRouter models from the live catalog for a capability (chat, chat+image, chat+audio, chat+video, embedding, image, video, rerank)')
  .option('--orcarouter-logout', 'remove the stored OrcaRouter credential')
  .option('--orcarouter-flow <flow>', 'PKCE flow for --orcarouter-connect: loopback (default), oob, or device')
  .option('--orcarouter-no-browser', 'use the out-of-band code flow with --orcarouter-connect (prints a code instead of listening on 127.0.0.1)')
  .option('--orcarouter-force', 'authorize again even when a usable OrcaRouter credential is already stored')
  .option('--orcarouter-credential-file <path>', 'override the OrcaRouter credential store location (mainly for tests)')
  .option('--orcarouter-dashboard', 'open the OrcaRouter provider dashboard (API key + PKCE login + capability-filtered model selector)')
  .option('--orcarouter-dashboard-port <port>', 'port for the OrcaRouter provider dashboard (default 3339)')
  .action(async (options) => {
    try {
      // Only show banner for non-agent-list commands
      const isQuietCommand = options.listAgents || 
                            options.removeAgent || 
                            options.updateAgent;
      
      if (!isQuietCommand) {
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
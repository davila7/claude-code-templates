#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const boxen = require('boxen');
const { createClaudeConfig } = require('../src/index');

const pkg = require('../package.json');

const title = 'Claude Code Templates';
const subtitle = 'Your starting point for Claude Code projects';

const colorGradient = ['#EA580C', '#F97316', '#FB923C', '#FDBA74', '#FED7AA', '#FFEBD6'];

function colorizeTitle(text) {
  const chars = text.split('');
  const steps = colorGradient.length;
  return chars
    .map((char, i) => {
      const color = colorGradient[i % steps];
      return chalk.hex(color)(char);
    })
    .join('');
}

function showBanner() {
  console.clear();
  console.log(chalk.hex('#F97316')('════════════════════════════════════════════════════════════════'));
  console.log('\n');
  console.log('       🔮 ' + colorizeTitle(title));
  console.log('\n');
  console.log('       ' + chalk.hex('#FDBA74')(subtitle));
  console.log('\n');
  console.log(chalk.hex('#F97316')('════════════════════════════════════════════════════════════════\n'));

  console.log(
    chalk.hex('#D97706')('🚀 Setup Claude Code for any project language 🚀') +
    chalk.gray(`\n                             v${pkg.version}\n\n`) +
    chalk.blue('🌐 Templates: ') + chalk.underline('https://aitmpl.com') + '\n' +
    chalk.blue('📖 Documentation: ') + chalk.underline('https://docs.aitmpl.com') + '\n'
  );
}

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
  .option('--tunnel', 'enable Cloudflare Tunnel for remote access (use with --analytics or --chats)')
  .option('--verbose', 'enable verbose logging for debugging and development')
  .option('--health-check, --health, --check, --verify', 'run comprehensive health check to verify Claude Code setup')
  .option('--agent <agent>', 'install specific agent component (supports comma-separated values)')
  .option('--command <command>', 'install specific command component (supports comma-separated values)')
  .option('--mcp <mcp>', 'install specific MCP component (supports comma-separated values)')
  .option('--setting <setting>', 'install specific setting component (supports comma-separated values)')
  .option('--hook <hook>', 'install specific hook component (supports comma-separated values)')
  .option('--workflow <workflow>', 'install workflow from hash (#hash) OR workflow YAML (base64 encoded) when used with --agent/--command/--mcp')
  .option('--prompt <prompt>', 'execute the provided prompt in Claude Code after installation')
  .option('--create-agent <agent>', 'create a global agent accessible from anywhere (e.g., customer-support)')
  .option('--list-agents', 'list all installed global agents')
  .option('--remove-agent <agent>', 'remove a global agent')
  .option('--update-agent <agent>', 'update a global agent to the latest version')
  .action(async (options) => {
    try {
      // Only show banner for non-agent-list commands
      const isQuietCommand = options.listAgents || 
                            options.removeAgent || 
                            options.updateAgent;
      
      if (!isQuietCommand) {
        showBanner();
      }
      
      await createClaudeConfig(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
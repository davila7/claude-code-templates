const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { spawn } = require('child_process');

function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  
  // Clean the text and estimate tokens
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const baseTokens = Math.ceil(cleanText.length / 4);
  
  // Add extra tokens for code blocks and complex structures
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
  const inlineCode = (text.match(/`[^`]+`/g) || []).length;
  const jsonBlocks = (text.match(/\{[\s\S]*?\}/g) || []).length;
  
  const adjustedTokens = baseTokens + (codeBlocks * 5) + (inlineCode * 2) + (jsonBlocks * 3);
  return Math.max(adjustedTokens, 1);
}

async function analyzeHooks(targetDir = process.cwd()) {
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  
  console.log(chalk.blue('🔍 Analyzing automation hooks...'));
  console.log(chalk.gray(`Scanning: ${settingsPath}`));

  if (!await fs.pathExists(settingsPath)) {
    console.log(chalk.yellow('⚠️  No .claude/settings.json file found.'));
    return null;
  }

  try {
    const settingsContent = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);
    
    if (!settings.hooks || Object.keys(settings.hooks).length === 0) {
      console.log(chalk.yellow('⚠️  No automation hooks found in settings.json.'));
      return null;
    }

    const hookAnalysis = {
      totalHooks: 0,
      byType: {},
      hooks: []
    };

    // Analyze each hook type
    for (const [hookType, hooks] of Object.entries(settings.hooks)) {
      if (!Array.isArray(hooks)) continue;
      
      hookAnalysis.byType[hookType] = {
        count: hooks.length,
        hooks: []
      };

      for (const hook of hooks) {
        const hookData = {
          type: hookType,
          name: hook.name || 'Unnamed Hook',
          description: hook.description || '',
          scriptContent: hook.script || hook.command || '',
          enabled: hook.enabled !== false, // Default to true if not specified
          conditions: hook.conditions || [],
          size: JSON.stringify(hook).length,
          lines: (hook.script || hook.command || '').split('\n').length,
          words: (hook.script || hook.command || '').split(/\s+/).filter(word => word.length > 0).length,
          tokens: estimateTokens(JSON.stringify(hook))
        };

        hookAnalysis.byType[hookType].hooks.push(hookData);
        hookAnalysis.hooks.push(hookData);
        hookAnalysis.totalHooks++;
      }
    }

    // Get file stats
    const stats = await fs.stat(settingsPath);
    hookAnalysis.fileSize = stats.size;
    hookAnalysis.lastModified = stats.mtime;

    return hookAnalysis;

  } catch (error) {
    console.error(chalk.red('❌ Error reading settings.json:'), error.message);
    return null;
  }
}

function displayHookStats(analysis) {
  if (!analysis || analysis.totalHooks === 0) {
    console.log(chalk.yellow('\n📊 Hook Analysis Results'));
    console.log(chalk.gray('No automation hooks found to analyze.'));
    return;
  }

  console.log(chalk.blue('\n📊 Hook Analysis Results'));
  console.log(chalk.gray(`File: .claude/settings.json (${analysis.fileSize} bytes)`));
  console.log(chalk.gray(`Last Modified: ${analysis.lastModified.toLocaleDateString()}`));
  console.log(chalk.gray(`Total Hooks: ${analysis.totalHooks}`));

  // Calculate column widths
  const maxNameLength = Math.max(
    ...analysis.hooks.map(hook => hook.name.length),
    'Hook Name'.length
  );
  const nameWidth = Math.min(maxNameLength, 30);

  // Header
  const header = chalk.bold.blue(
    'Hook Name'.padEnd(nameWidth) + ' │ ' +
    'Type'.padEnd(12) + ' │ ' +
    'Status'.padEnd(8) + ' │ ' +
    'Description'
  );

  const separator = '─'.repeat(nameWidth) + '─┼─' +
    '─'.repeat(12) + '─┼─' +
    '─'.repeat(8) + '─┼─' +
    '─'.repeat(40);

  console.log('\n' + header);
  console.log(chalk.gray(separator));

  // Hook rows
  analysis.hooks.forEach(hook => {
    const truncatedName = hook.name.length > nameWidth ? 
      hook.name.substring(0, nameWidth - 3) + '...' : 
      hook.name;
    
    const statusColor = hook.enabled ? chalk.green : chalk.yellow;
    const status = hook.enabled ? 'Enabled' : 'Disabled';
    
    const truncatedDesc = hook.description.length > 40 ? 
      hook.description.substring(0, 37) + '...' : 
      hook.description;

    const row = 
      truncatedName.padEnd(nameWidth) + ' │ ' +
      hook.type.padEnd(12) + ' │ ' +
      statusColor(status.padEnd(8)) + ' │ ' +
      chalk.gray(truncatedDesc);

    console.log(row);
  });

  // Summary by type
  console.log(chalk.blue('\n📈 Hook Summary by Type:'));
  for (const [type, data] of Object.entries(analysis.byType)) {
    const enabledCount = data.hooks.filter(h => h.enabled).length;
    const disabledCount = data.hooks.filter(h => !h.enabled).length;
    
    console.log(chalk.gray(`  ${type}: ${data.count} hooks`) + 
      chalk.green(` (${enabledCount} enabled`) + 
      (disabledCount > 0 ? chalk.yellow(`, ${disabledCount} disabled)`) : chalk.green(')')));
  }

  console.log(chalk.blue('\n🔧 Hook Types Found:'));
  Object.keys(analysis.byType).forEach(type => {
    console.log(chalk.gray(`  • ${type}`));
  });
}

async function runHookStats(options) {
  const targetDir = options.directory || process.cwd();
  
  console.log(chalk.blue('🔧 Claude Code Hook Analysis'));
  console.log(chalk.gray(`Target directory: ${targetDir}`));

  const analysis = await analyzeHooks(targetDir);
  
  if (!analysis) {
    console.log(chalk.yellow('\n💡 No automation hooks found.'));
    console.log(chalk.gray('Would you like to set up Claude Code Templates to add automation hooks?'));
    
    const { setupHooks } = await inquirer.prompt([{
      type: 'confirm',
      name: 'setupHooks',
      message: 'Set up automation hooks with Claude Code Templates?',
      default: true
    }]);

    if (setupHooks) {
      console.log(chalk.blue('\n🚀 Starting Claude Code Templates setup...'));
      
      // Import and run the main setup
      const createClaudeConfig = require('./index');
      await createClaudeConfig({ ...options, directory: targetDir });
    }
    return;
  }

  displayHookStats(analysis);

  // Ask if user wants Claude Code to review and optimize hooks
  console.log(chalk.blue('\n🤖 Optimization Opportunity'));
  console.log(chalk.gray('Claude Code can analyze your automation hooks and suggest optimizations.'));
  
  const { optimizeHooks } = await inquirer.prompt([{
    type: 'confirm',
    name: 'optimizeHooks',
    message: 'Would you like Claude Code to review and optimize your automation hooks?',
    default: true
  }]);

  if (optimizeHooks) {
    console.log(chalk.blue('\n🔍 Launching Claude Code for hook optimization...'));
    
    // Prepare the optimization prompt
    const hookSummary = `I have ${analysis.totalHooks} automation hooks configured in my .claude/settings.json file:

${Object.entries(analysis.byType).map(([type, data]) => 
  `${type}: ${data.count} hooks (${data.hooks.filter(h => h.enabled).length} enabled, ${data.hooks.filter(h => !h.enabled).length} disabled)`
).join('\n')}

Hook details:
${analysis.hooks.map(hook => 
  `- ${hook.name} (${hook.type}): ${hook.enabled ? 'Enabled' : 'Disabled'} - ${hook.tokens} tokens - ${hook.description || 'No description'}`
).join('\n')}

Please review my automation hook configuration and suggest optimizations for:
1. Hook efficiency and performance
2. Missing hooks that could improve my workflow
3. Hooks that might be redundant or conflicting
4. Best practices for hook organization
5. Security considerations for the hooks
6. Hook conditions and triggers optimization

Consider my project structure and suggest hooks that would be most beneficial for my development workflow.`;

    const claudeCommand = `claude "${hookSummary}"`;
    
    try {
      const child = spawn('sh', ['-c', claudeCommand], {
        stdio: 'inherit',
        cwd: targetDir
      });

      child.on('error', (error) => {
        console.error(chalk.red('❌ Error launching Claude Code:'), error.message);
        console.log(chalk.yellow('💡 Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code'));
      });

    } catch (error) {
      console.error(chalk.red('❌ Error launching Claude Code:'), error.message);
      console.log(chalk.yellow('💡 Make sure Claude Code is installed and accessible.'));
    }
  } else {
    console.log(chalk.gray('\n✅ Hook analysis complete. You can run this command again anytime to re-analyze your hooks.'));
  }
}

module.exports = {
  runHookStats,
  analyzeHooks,
  displayHookStats
};
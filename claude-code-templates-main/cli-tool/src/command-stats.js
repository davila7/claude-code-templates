const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { spawn } = require('child_process');

/**
 * Estimates token count for text content
 * Based on approximate tokenization rules: ~4 characters per token for English text
 * @param {string} text - Text to analyze
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  // Remove excessive whitespace and normalize
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  // Basic estimation: ~4 characters per token for English text
  // Adjust for code content which typically has more tokens per character
  const baseTokens = Math.ceil(cleanText.length / 4);
  
  // Adjust for markdown and code content
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
  const inlineCode = (text.match(/`[^`]*`/g) || []).length;
  const markdownElements = (text.match(/[#*_\[\]()]/g) || []).length;
  
  // Add extra tokens for code and markdown formatting
  const adjustedTokens = baseTokens + (codeBlocks * 5) + (inlineCode * 2) + Math.ceil(markdownElements / 2);
  
  return adjustedTokens;
}

/**
 * Analyzes existing Claude Code commands in the current project
 * @param {string} targetDir - Directory to analyze (default: current directory)
 * @returns {Array} Array of command analysis results
 */
async function analyzeCommands(targetDir = process.cwd()) {
  const commandsDir = path.join(targetDir, '.claude', 'commands');
  
  // Check if .claude/commands directory exists
  if (!fs.existsSync(commandsDir)) {
    return {
      exists: false,
      message: 'No .claude/commands directory found in current project'
    };
  }

  try {
    const commandFiles = await fs.readdir(commandsDir);
    const markdownFiles = commandFiles.filter(file => file.endsWith('.md'));
    
    if (markdownFiles.length === 0) {
      return {
        exists: true,
        commands: [],
        message: 'No command files (.md) found in .claude/commands directory'
      };
    }

    const commands = [];
    
    for (const file of markdownFiles) {
      const filePath = path.join(commandsDir, file);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Extract first line as title/description
      const lines = content.split('\n').filter(line => line.trim());
      const title = lines.find(line => line.startsWith('#')) || file;
      
      // Calculate token estimate
      const tokenCount = estimateTokens(content);
      
      commands.push({
        name: file.replace('.md', ''),
        filename: file,
        size: stats.size,
        lastModified: stats.mtime,
        title: title.replace(/^#+\s*/, ''),
        lines: lines.length,
        wordCount: content.split(/\s+/).length,
        tokens: tokenCount
      });
    }

    // Sort by last modified (newest first)
    commands.sort((a, b) => b.lastModified - a.lastModified);

    return {
      exists: true,
      commands,
      total: commands.length,
      totalSize: commands.reduce((sum, cmd) => sum + cmd.size, 0),
      totalTokens: commands.reduce((sum, cmd) => sum + cmd.tokens, 0)
    };
  } catch (error) {
    return {
      exists: true,
      error: `Error analyzing commands: ${error.message}`
    };
  }
}

/**
 * Displays command statistics in a formatted table
 * @param {Object} analysis - Result from analyzeCommands()
 */
function displayCommandStats(analysis) {
  console.log(chalk.cyan('\n📊 Claude Code Command Analysis'));
  
  // Calculate header width dynamically
  const headerWidth = analysis.commands.length > 0 ? 
    Math.min(Math.max(...analysis.commands.map(cmd => cmd.name.length)), 25) + 60 : 80;
  
  console.log(chalk.gray('═'.repeat(headerWidth)));

  if (!analysis.exists) {
    console.log(chalk.yellow('⚠️  ' + analysis.message));
    console.log(chalk.blue('\n💡 Run the setup first: npx claude-code-templates'));
    return false; // Indicate no .claude directory
  }

  if (analysis.error) {
    console.log(chalk.red('❌ ' + analysis.error));
    return false;
  }

  if (analysis.commands.length === 0) {
    console.log(chalk.yellow('⚠️  ' + analysis.message));
    console.log(chalk.blue('\n💡 No commands found to analyze'));
    return false; // Indicate no commands found
  }

  // Summary
  const totalSizeKB = (analysis.totalSize / 1024).toFixed(1);
  const totalTokens = analysis.totalTokens.toLocaleString();
  console.log(chalk.green(`✅ Found ${analysis.total} command file(s) (${totalSizeKB} KB, ~${totalTokens} tokens total)`));
  console.log('');

  // Calculate dynamic column widths based on content
  const maxNameLength = Math.max(
    7, // Minimum width for "Command"
    Math.max(...analysis.commands.map(cmd => cmd.name.length))
  );
  const nameWidth = Math.min(maxNameLength, 25); // Cap at 25 characters
  
  // Table header
  const header = chalk.bold.blue(
    'Command'.padEnd(nameWidth) + ' │ ' +
    'Size'.padEnd(6) + ' │ ' +
    'Lines'.padEnd(5) + ' │ ' +
    'Words'.padEnd(5) + ' │ ' +
    'Tokens (aprox)'.padEnd(13) + ' │ ' +
    'Last Modified'
  );
  console.log(header);
  
  // Create separator line with proper spacing
  const separatorLength = nameWidth + 6 + 5 + 5 + 13 + 13 + 15; // Calculate total width
  console.log(chalk.gray('─'.repeat(separatorLength)));

  // Table rows
  analysis.commands.forEach(cmd => {
    // Truncate command name if too long and add ellipsis
    let displayName = cmd.name;
    if (displayName.length > nameWidth) {
      displayName = displayName.substring(0, nameWidth - 3) + '...';
    }
    
    const sizeFormatted = `${(cmd.size / 1024).toFixed(1)}KB`.padEnd(6);
    const linesFormatted = cmd.lines.toString().padEnd(5);
    const wordsFormatted = cmd.wordCount.toString().padEnd(5);
    const tokensFormatted = cmd.tokens.toString().padEnd(13);
    const dateFormatted = cmd.lastModified.toLocaleDateString();
    
    const row = chalk.white(displayName.padEnd(nameWidth)) + chalk.gray(' │ ') +
                chalk.cyan(sizeFormatted) + chalk.gray(' │ ') +
                chalk.yellow(linesFormatted) + chalk.gray(' │ ') +
                chalk.green(wordsFormatted) + chalk.gray(' │ ') +
                chalk.magenta(tokensFormatted) + chalk.gray(' │ ') +
                chalk.gray(dateFormatted);
    
    console.log(row);
  });

  console.log(chalk.gray('─'.repeat(separatorLength)));
  console.log(chalk.bold(`Total: ${analysis.total} commands, ${totalSizeKB} KB, ~${totalTokens} tokens`));
  return true; // Indicate commands were found and displayed
}

/**
 * Prompts user to setup Claude Code Templates when no commands are found
 * @param {string} targetDir - Project directory
 */
async function promptSetupWhenNoCommands(targetDir) {
  const inquirer = require('inquirer');
  
  console.log(chalk.cyan('\n🚀 Claude Code Templates Setup'));
  console.log(chalk.gray('No Claude Code commands found in this project. You can set up Claude Code Templates to get started.'));
  
  try {
    const { setupNow } = await inquirer.prompt([{
      type: 'confirm',
      name: 'setupNow',
      message: 'Would you like to start the Claude Code Templates setup now?',
      default: true,
      prefix: chalk.blue('🤖')
    }]);

    if (!setupNow) {
      console.log(chalk.yellow('⏭️  Setup skipped. Run "npx claude-code-templates" anytime to set up your project.'));
      return false;
    }

    console.log(chalk.blue('\n🚀 Starting Claude Code Templates setup...'));
    console.log(chalk.gray('This will guide you through language and framework selection.\n'));

    // Import and run the main setup function
    const createClaudeConfig = require('./index');
    await createClaudeConfig({ directory: targetDir });
    
    return true;

  } catch (error) {
    console.error(chalk.red('Error during setup:'), error.message);
    console.log(chalk.blue('💡 You can run setup manually with: npx claude-code-templates'));
    return false;
  }
}

/**
 * Prompts user for command optimization and executes Claude Code if approved
 * @param {Object} analysis - Result from analyzeCommands()
 * @param {string} targetDir - Project directory
 */
async function promptCommandOptimization(analysis, targetDir) {
  if (!analysis.exists || analysis.commands.length === 0) {
    return;
  }

  const inquirer = require('inquirer');
  
  console.log(chalk.cyan('\n🔧 Command Optimization'));
  console.log(chalk.gray('Claude Code can analyze your commands and suggest improvements based on your project structure.'));
  
  try {
    const { optimize } = await inquirer.prompt([{
      type: 'confirm',
      name: 'optimize',
      message: 'Would you like Claude Code to review and optimize your commands?',
      default: true,
      prefix: chalk.blue('🤖')
    }]);

    if (!optimize) {
      console.log(chalk.yellow('⏭️  Skipping optimization. You can run this anytime with --command-stats'));
      return;
    }

    console.log(chalk.blue('\n🚀 Starting Claude Code command optimization...'));
    console.log(chalk.gray('This will analyze your project structure and suggest command improvements.\n'));

    // Create optimization prompt for Claude
    const optimizationPrompt = createOptimizationPrompt(analysis, targetDir);
    
    // Execute Claude Code with optimization prompt
    const claudeCommand = `claude "${optimizationPrompt.replace(/"/g, '\\"')}"`;
    
    const claudeProcess = spawn('sh', ['-c', claudeCommand], {
      cwd: targetDir,
      stdio: 'inherit'
    });

    claudeProcess.on('error', (error) => {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow('\n⚠️  Claude Code CLI not found in PATH.'));
        console.log(chalk.blue('💡 To run optimization manually later, use: claude "Analyze and optimize .claude/commands/ based on project structure"'));
      } else {
        console.error(chalk.red('Error running Claude Code optimization:'), error.message);
      }
    });

    claudeProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ Claude Code optimization completed successfully!'));
      } else if (code !== null) {
        console.log(chalk.yellow(`\n⚠️  Claude Code optimization exited with code ${code}`));
      }
    });

  } catch (error) {
    console.error(chalk.red('Error during optimization setup:'), error.message);
    console.log(chalk.blue('💡 You can run optimization manually with: claude "Analyze .claude/commands/ directory"'));
  }
}

/**
 * Creates detailed optimization prompt for Claude Code
 * @param {Object} analysis - Command analysis results
 * @param {string} targetDir - Project directory
 * @returns {string} Formatted prompt for Claude
 */
function createOptimizationPrompt(analysis, targetDir) {
  const commandList = analysis.commands.map(cmd => `- ${cmd.name}.md (${cmd.lines} lines)`).join('\n');
  
  return `Analyze and optimize the Claude Code commands in this project:

1. **Review project structure**: Use LS to examine the current project (package.json, src/, etc.) and identify technologies/frameworks used

2. **Analyze existing commands**: Review all files in .claude/commands/ directory:
${commandList}

3. **Command optimization**:
   - Check if commands are relevant for this project's tech stack
   - Suggest improvements to existing commands based on project structure
   - Recommend missing commands that would be useful for this project
   - Update command content to match project's specific setup and dependencies

4. **Make improvements**: If you find commands that need updates or see missing useful commands, implement the changes directly to the .claude/commands/ files

Focus on making the commands as useful and specific as possible for this project's actual setup and development workflow.`;
}

/**
 * Main function to run command stats analysis
 * @param {Object} options - CLI options
 */
async function runCommandStats(options = {}) {
  const targetDir = options.directory || process.cwd();
  
  // Analyze existing commands
  const analysis = await analyzeCommands(targetDir);
  
  // Display results
  const hasCommands = displayCommandStats(analysis);
  
  // If no commands found, offer to start setup
  if (!hasCommands) {
    await promptSetupWhenNoCommands(targetDir);
    return;
  }
  
  // Prompt for optimization
  await promptCommandOptimization(analysis, targetDir);
}

module.exports = {
  analyzeCommands,
  displayCommandStats,
  promptCommandOptimization,
  promptSetupWhenNoCommands,
  runCommandStats
};
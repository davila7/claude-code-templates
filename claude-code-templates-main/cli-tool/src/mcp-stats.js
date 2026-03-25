const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { spawn } = require('child_process');

async function analyzeMCPServers(targetDir = process.cwd()) {
  const mcpConfigPath = path.join(targetDir, '.mcp.json');
  
  console.log(chalk.blue('🔍 Analyzing MCP server configurations...'));
  console.log(chalk.gray(`Scanning: ${mcpConfigPath}`));

  if (!await fs.pathExists(mcpConfigPath)) {
    console.log(chalk.yellow('⚠️  No .mcp.json file found.'));
    return null;
  }

  try {
    const mcpContent = await fs.readFile(mcpConfigPath, 'utf8');
    const mcpConfig = JSON.parse(mcpContent);
    
    if (!mcpConfig.mcpServers || Object.keys(mcpConfig.mcpServers).length === 0) {
      console.log(chalk.yellow('⚠️  No MCP servers found in .mcp.json.'));
      return null;
    }

    const mcpAnalysis = {
      totalServers: 0,
      servers: [],
      byCategory: {}
    };

    // Analyze each MCP server
    for (const [serverKey, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
      const serverData = {
        key: serverKey,
        name: serverConfig.name || serverKey,
        description: serverConfig.description || 'No description provided',
        command: serverConfig.command || 'Unknown',
        args: serverConfig.args || [],
        env: serverConfig.env || {},
        enabled: serverConfig.disabled !== true, // Default to enabled unless explicitly disabled
        category: categorizeServer(serverConfig),
        configSize: JSON.stringify(serverConfig).length,
        complexity: calculateComplexity(serverConfig)
      };

      mcpAnalysis.servers.push(serverData);
      mcpAnalysis.totalServers++;

      // Group by category
      if (!mcpAnalysis.byCategory[serverData.category]) {
        mcpAnalysis.byCategory[serverData.category] = [];
      }
      mcpAnalysis.byCategory[serverData.category].push(serverData);
    }

    // Get file stats
    const stats = await fs.stat(mcpConfigPath);
    mcpAnalysis.fileSize = stats.size;
    mcpAnalysis.lastModified = stats.mtime;

    return mcpAnalysis;

  } catch (error) {
    console.error(chalk.red('❌ Error reading .mcp.json:'), error.message);
    return null;
  }
}

function categorizeServer(serverConfig) {
  const name = (serverConfig.name || '').toLowerCase();
  const command = (serverConfig.command || '').toLowerCase();
  const description = (serverConfig.description || '').toLowerCase();
  
  // IDE and Development Tools
  if (name.includes('ide') || name.includes('vscode') || name.includes('jupyter') || 
      command.includes('jupyter') || description.includes('ide')) {
    return 'IDE & Development';
  }
  
  // Database Tools
  if (name.includes('postgres') || name.includes('mysql') || name.includes('sqlite') || 
      name.includes('database') || description.includes('database')) {
    return 'Database';
  }
  
  // Web and API Tools
  if (name.includes('web') || name.includes('search') || name.includes('api') || 
      name.includes('http') || description.includes('web') || description.includes('search')) {
    return 'Web & API';
  }
  
  // File System Tools
  if (name.includes('file') || name.includes('filesystem') || 
      description.includes('file') || description.includes('filesystem')) {
    return 'Filesystem';
  }
  
  // Development Tools
  if (name.includes('git') || name.includes('docker') || name.includes('github') ||
      description.includes('git') || description.includes('docker')) {
    return 'DevOps';
  }
  
  // AI and ML Tools
  if (name.includes('ai') || name.includes('ml') || name.includes('model') ||
      description.includes('ai') || description.includes('machine learning')) {
    return 'AI & ML';
  }
  
  return 'Other';
}

function calculateComplexity(serverConfig) {
  let complexity = 1; // Base complexity
  
  // Add complexity for configuration options
  if (serverConfig.args && serverConfig.args.length > 0) complexity += 1;
  if (serverConfig.env && Object.keys(serverConfig.env).length > 0) complexity += 1;
  if (serverConfig.settings && Object.keys(serverConfig.settings).length > 0) complexity += 1;
  
  // Add complexity for environment variables
  const envCount = Object.keys(serverConfig.env || {}).length;
  if (envCount > 3) complexity += 1;
  if (envCount > 6) complexity += 1;
  
  return Math.min(complexity, 5); // Cap at 5
}

function displayMCPStats(analysis) {
  if (!analysis || analysis.totalServers === 0) {
    console.log(chalk.yellow('\n📊 MCP Server Analysis Results'));
    console.log(chalk.gray('No MCP servers found to analyze.'));
    return;
  }

  console.log(chalk.blue('\n📊 MCP Server Analysis Results'));
  console.log(chalk.gray(`File: .mcp.json (${analysis.fileSize} bytes)`));
  console.log(chalk.gray(`Last Modified: ${analysis.lastModified.toLocaleDateString()}`));
  console.log(chalk.gray(`Total MCP Servers: ${analysis.totalServers}`));

  // Calculate column widths
  const maxNameLength = Math.max(
    ...analysis.servers.map(server => server.name.length),
    'Server Name'.length
  );
  const nameWidth = Math.min(maxNameLength, 25);

  // Header
  const header = chalk.bold.blue(
    'Server Name'.padEnd(nameWidth) + ' │ ' +
    'Category'.padEnd(15) + ' │ ' +
    'Status'.padEnd(8) + ' │ ' +
    'Command'.padEnd(12) + ' │ ' +
    'Complexity'.padEnd(10) + ' │ ' +
    'Description'
  );

  const separator = '─'.repeat(nameWidth) + '─┼─' +
    '─'.repeat(15) + '─┼─' +
    '─'.repeat(8) + '─┼─' +
    '─'.repeat(12) + '─┼─' +
    '─'.repeat(10) + '─┼─' +
    '─'.repeat(30);

  console.log('\n' + header);
  console.log(chalk.gray(separator));

  // Server rows
  analysis.servers.forEach(server => {
    const truncatedName = server.name.length > nameWidth ? 
      server.name.substring(0, nameWidth - 3) + '...' : 
      server.name;
    
    const statusColor = server.enabled ? chalk.green : chalk.yellow;
    const status = server.enabled ? 'Enabled' : 'Disabled';
    
    const truncatedCommand = server.command.length > 12 ? 
      server.command.substring(0, 9) + '...' : 
      server.command;
    
    const complexityStars = '★'.repeat(server.complexity) + '☆'.repeat(5 - server.complexity);
    
    const truncatedDesc = server.description.length > 30 ? 
      server.description.substring(0, 27) + '...' : 
      server.description;

    const row = 
      truncatedName.padEnd(nameWidth) + ' │ ' +
      server.category.padEnd(15) + ' │ ' +
      statusColor(status.padEnd(8)) + ' │ ' +
      chalk.cyan(truncatedCommand.padEnd(12)) + ' │ ' +
      chalk.yellow(complexityStars.padEnd(10)) + ' │ ' +
      chalk.gray(truncatedDesc);

    console.log(row);
  });

  // Summary by category
  console.log(chalk.blue('\n📈 MCP Server Summary by Category:'));
  for (const [category, servers] of Object.entries(analysis.byCategory)) {
    const enabledCount = servers.filter(s => s.enabled).length;
    const disabledCount = servers.filter(s => !s.enabled).length;
    
    console.log(chalk.gray(`  ${category}: ${servers.length} servers`) + 
      chalk.green(` (${enabledCount} enabled`) + 
      (disabledCount > 0 ? chalk.yellow(`, ${disabledCount} disabled)`) : chalk.green(')')));
  }

  // Complexity analysis
  console.log(chalk.blue('\n🔧 Complexity Distribution:'));
  const complexityCount = {};
  analysis.servers.forEach(server => {
    complexityCount[server.complexity] = (complexityCount[server.complexity] || 0) + 1;
  });
  
  for (let i = 1; i <= 5; i++) {
    const count = complexityCount[i] || 0;
    if (count > 0) {
      const stars = '★'.repeat(i) + '☆'.repeat(5 - i);
      console.log(chalk.gray(`  ${chalk.yellow(stars)} (${i}/5): ${count} servers`));
    }
  }
}

async function runMCPStats(options) {
  const targetDir = options.directory || process.cwd();
  
  console.log(chalk.blue('🔌 Claude Code MCP Server Analysis'));
  console.log(chalk.gray(`Target directory: ${targetDir}`));

  const analysis = await analyzeMCPServers(targetDir);
  
  if (!analysis) {
    console.log(chalk.yellow('\n💡 No MCP servers found.'));
    console.log(chalk.gray('Would you like to set up Claude Code Templates to add MCP servers?'));
    
    const { setupMCP } = await inquirer.prompt([{
      type: 'confirm',
      name: 'setupMCP',
      message: 'Set up MCP servers with Claude Code Templates?',
      default: true
    }]);

    if (setupMCP) {
      console.log(chalk.blue('\n🚀 Starting Claude Code Templates setup...'));
      
      // Import and run the main setup
      const createClaudeConfig = require('./index');
      await createClaudeConfig({ ...options, directory: targetDir });
    }
    return;
  }

  displayMCPStats(analysis);

  // Ask if user wants Claude Code to review and optimize MCP configuration
  console.log(chalk.blue('\n🤖 Optimization Opportunity'));
  console.log(chalk.gray('Claude Code can analyze your MCP server configuration and suggest optimizations.'));
  
  const { optimizeMCP } = await inquirer.prompt([{
    type: 'confirm',
    name: 'optimizeMCP',
    message: 'Would you like Claude Code to review and optimize your MCP server configuration?',
    default: true
  }]);

  if (optimizeMCP) {
    console.log(chalk.blue('\n🔍 Launching Claude Code for MCP optimization...'));
    
    // Prepare the optimization prompt
    const mcpSummary = `I have ${analysis.totalServers} MCP servers configured in my .mcp.json file:

${Object.entries(analysis.byCategory).map(([category, servers]) => 
  `${category}: ${servers.length} servers (${servers.filter(s => s.enabled).length} enabled, ${servers.filter(s => !s.enabled).length} disabled)`
).join('\n')}

MCP Server details:
${analysis.servers.map(server => 
  `- ${server.name} (${server.category}): ${server.enabled ? 'Enabled' : 'Disabled'} - Command: ${server.command} - Complexity: ${server.complexity}/5 - ${server.description}`
).join('\n')}

Please review my MCP server configuration and suggest optimizations for:
1. Server selection and relevance to my development workflow
2. Missing MCP servers that could improve my productivity
3. Server configuration optimization (command, args, environment variables)
4. Performance considerations and resource usage
5. Security best practices for MCP server configurations
6. Redundant or conflicting servers
7. Integration opportunities between different MCP servers

Consider my project structure and development needs to suggest the most beneficial MCP server setup.`;

    const claudeCommand = `claude "${mcpSummary}"`;
    
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
    console.log(chalk.gray('\n✅ MCP analysis complete. You can run this command again anytime to re-analyze your MCP configuration.'));
  }
}

module.exports = {
  runMCPStats,
  analyzeMCPServers,
  displayMCPStats
};
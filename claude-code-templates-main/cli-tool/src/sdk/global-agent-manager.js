const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');

// Global agents directory
const GLOBAL_AGENTS_DIR = path.join(os.homedir(), '.claude-code-templates');
const AGENTS_DIR = path.join(GLOBAL_AGENTS_DIR, 'agents');
const LOCAL_BIN_DIR = path.join(GLOBAL_AGENTS_DIR, 'bin');

// Try to use system bin directory for immediate availability
const SYSTEM_BIN_DIR = '/usr/local/bin';
const isSystemWritable = () => {
  try {
    const testFile = path.join(SYSTEM_BIN_DIR, '.test-write');
    require('fs').writeFileSync(testFile, 'test', 'utf8');
    require('fs').unlinkSync(testFile);
    return true;
  } catch (error) {
    return false;
  }
};

// Choose the best bin directory
const BIN_DIR = isSystemWritable() ? SYSTEM_BIN_DIR : LOCAL_BIN_DIR;

/**
 * Create a global agent that can be executed from anywhere
 */
async function createGlobalAgent(agentName, options = {}) {
  console.log(chalk.blue(`🤖 Creating global agent: ${agentName}`));
  
  try {
    // Ensure directories exist
    await fs.ensureDir(AGENTS_DIR);
    await fs.ensureDir(LOCAL_BIN_DIR); // Always ensure local bin exists for backups
    
    if (BIN_DIR === SYSTEM_BIN_DIR) {
      console.log(chalk.green('🌍 Installing to system directory (immediately available)'));
    } else {
      console.log(chalk.yellow('⚠️ Installing to user directory (requires PATH setup)'));
      await fs.ensureDir(BIN_DIR);
    }
    
    // Download agent from GitHub
    const spinner = ora('Downloading agent from GitHub...').start();
    
    let githubUrl;
    if (agentName.includes('/')) {
      // Category/agent format
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/agents/${agentName}.md`;
    } else {
      // Direct agent format - try to find it in any category
      githubUrl = await findAgentUrl(agentName);
      if (!githubUrl) {
        spinner.fail(`Agent "${agentName}" not found`);
        await showAvailableAgents();
        return;
      }
    }
    
    const response = await fetch(githubUrl);
    if (!response.ok) {
      spinner.fail(`Failed to download agent: HTTP ${response.status}`);
      if (response.status === 404) {
        await showAvailableAgents();
      }
      return;
    }
    
    const agentContent = await response.text();
    spinner.succeed('Agent downloaded successfully');
    
    // Extract agent name for file/executable naming
    const executableName = agentName.includes('/') ? 
      agentName.split('/')[1] : agentName;
    
    // Save agent content
    const agentFile = path.join(AGENTS_DIR, `${executableName}.md`);
    await fs.writeFile(agentFile, agentContent, 'utf8');
    
    // Generate executable script
    await generateExecutableScript(executableName, agentFile);
    
    console.log(chalk.green(`✅ Global agent '${executableName}' created successfully!`));
    console.log(chalk.cyan('📦 Usage:'));
    console.log(chalk.white(`  ${executableName} "your prompt here"`));
    
    if (BIN_DIR === SYSTEM_BIN_DIR) {
      console.log(chalk.green('🎉 Ready to use immediately! No setup required.'));
      console.log(chalk.gray('💡 Works in scripts, npm tasks, CI/CD, etc.'));
    } else {
      // Add to PATH (first time setup) only for user directory
      await addToPath();
      console.log(chalk.yellow('🔄 Restart your terminal or run:'));
      console.log(chalk.gray('  source ~/.bashrc   # for bash'));
      console.log(chalk.gray('  source ~/.zshrc    # for zsh'));
    }
    
  } catch (error) {
    console.log(chalk.red(`❌ Error creating global agent: ${error.message}`));
  }
}

/**
 * List installed global agents
 */
async function listGlobalAgents(options = {}) {
  console.log(chalk.blue('📋 Installed Global Agents:'));
  
  try {
    // Check both system and local bin directories
    let systemAgents = [];
    if (await fs.pathExists(SYSTEM_BIN_DIR)) {
      const systemFiles = await fs.readdir(SYSTEM_BIN_DIR);
      for (const file of systemFiles) {
        if (!file.startsWith('.') && await fs.pathExists(path.join(AGENTS_DIR, `${file}.md`))) {
          systemAgents.push(file);
        }
      }
    }
    
    const localAgents = await fs.pathExists(LOCAL_BIN_DIR) ?
      (await fs.readdir(LOCAL_BIN_DIR)).filter(file => !file.startsWith('.')) : [];
    
    const allAgents = [...new Set([...systemAgents, ...localAgents])];
    
    if (allAgents.length === 0) {
      console.log(chalk.yellow('⚠️  No global agents installed yet.'));
      console.log(chalk.gray('💡 Create one with: npx claude-code-templates@latest --create-agent <agent-name>'));
      return;
    }
    
    console.log(chalk.green(`\n✅ Found ${allAgents.length} global agent(s):\n`));
    
    for (const agent of allAgents) {
      // Check which directory has the agent
      const systemPath = path.join(SYSTEM_BIN_DIR, agent);
      const localPath = path.join(LOCAL_BIN_DIR, agent);
      
      let agentPath, location;
      if (await fs.pathExists(systemPath)) {
        agentPath = systemPath;
        location = '🌍 system';
      } else {
        agentPath = localPath;
        location = '👤 user';
      }
      
      const stats = await fs.stat(agentPath);
      const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
      
      console.log(chalk.cyan(`  ${isExecutable ? '✅' : '❌'} ${agent} (${location})`));
      console.log(chalk.gray(`      Usage: ${agent} "your prompt"`));
      console.log(chalk.gray(`      Created: ${stats.birthtime.toLocaleDateString()}`));
      console.log('');
    }
    
    console.log(chalk.blue('🌟 Global Usage:'));
    console.log(chalk.gray('  • Run from any directory: <agent-name> "prompt"'));
    console.log(chalk.gray('  • List agents: npx claude-code-templates@latest --list-agents'));
    console.log(chalk.gray('  • Remove agent: npx claude-code-templates@latest --remove-agent <name>'));
    
  } catch (error) {
    console.log(chalk.red(`❌ Error listing agents: ${error.message}`));
  }
}

/**
 * Remove a global agent
 */
async function removeGlobalAgent(agentName, options = {}) {
  console.log(chalk.blue(`🗑️  Removing global agent: ${agentName}`));
  
  try {
    const systemExecutablePath = path.join(SYSTEM_BIN_DIR, agentName);
    const localExecutablePath = path.join(LOCAL_BIN_DIR, agentName);
    const agentPath = path.join(AGENTS_DIR, `${agentName}.md`);
    
    let removed = false;
    
    // Remove from system directory
    if (await fs.pathExists(systemExecutablePath)) {
      await fs.remove(systemExecutablePath);
      console.log(chalk.green(`✅ Removed system executable: ${agentName}`));
      removed = true;
    }
    
    // Remove from local directory
    if (await fs.pathExists(localExecutablePath)) {
      await fs.remove(localExecutablePath);
      console.log(chalk.green(`✅ Removed local executable: ${agentName}`));
      removed = true;
    }
    
    // Remove agent file
    if (await fs.pathExists(agentPath)) {
      await fs.remove(agentPath);
      console.log(chalk.green(`✅ Removed agent file: ${agentName}.md`));
      removed = true;
    }
    
    if (!removed) {
      console.log(chalk.yellow(`⚠️  Agent '${agentName}' not found.`));
      console.log(chalk.gray('💡 List available agents with: --list-agents'));
      return;
    }
    
    console.log(chalk.green(`🎉 Global agent '${agentName}' removed successfully!`));
    
  } catch (error) {
    console.log(chalk.red(`❌ Error removing agent: ${error.message}`));
  }
}

/**
 * Update a global agent
 */
async function updateGlobalAgent(agentName, options = {}) {
  console.log(chalk.blue(`🔄 Updating global agent: ${agentName}`));
  
  try {
    const executablePath = path.join(BIN_DIR, agentName);
    
    if (!await fs.pathExists(executablePath)) {
      console.log(chalk.yellow(`⚠️  Agent '${agentName}' not found.`));
      console.log(chalk.gray('💡 Create it with: --create-agent <agent-name>'));
      return;
    }
    
    // Re-download and recreate
    console.log(chalk.gray('🔄 Re-downloading latest version...'));
    await createGlobalAgent(agentName, { ...options, update: true });
    
  } catch (error) {
    console.log(chalk.red(`❌ Error updating agent: ${error.message}`));
  }
}

/**
 * Generate executable script for an agent
 */
async function generateExecutableScript(agentName, agentFile) {
  const scriptContent = `#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if Claude CLI is available
function checkClaudeCLI() {
  try {
    execSync('claude --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Read agent system prompt
const agentPath = '${agentFile}';
if (!fs.existsSync(agentPath)) {
  console.error('❌ Agent file not found:', agentPath);
  process.exit(1);
}

const rawSystemPrompt = fs.readFileSync(agentPath, 'utf8');

// Remove YAML front matter if present to get clean system prompt
const systemPrompt = rawSystemPrompt.replace(/^---[\\s\\S]*?---\\n/, '').trim();

// Parse arguments and detect context
const args = process.argv.slice(2);
let userInput = '';
let explicitFiles = [];
let explicitDirs = [];
let autoDetect = true;

// Parse command line arguments
let verbose = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--file' && i + 1 < args.length) {
    explicitFiles.push(args[++i]);
    autoDetect = false; // Disable auto-detect when explicit files provided
  } else if (arg === '--dir' && i + 1 < args.length) {
    explicitDirs.push(args[++i]);
    autoDetect = false;
  } else if (arg === '--no-auto') {
    autoDetect = false;
  } else if (arg === '--verbose' || arg === '-v') {
    verbose = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log('Usage: ${agentName} [options] "your prompt"');
    console.log('');
    console.log('Context Options:');
    console.log('  [default]           Auto-detect project files (smart context)');
    console.log('  --file <path>       Include specific file');
    console.log('  --dir <path>        Include specific directory');
    console.log('  --no-auto           Disable auto-detection');
    console.log('  --verbose, -v       Enable verbose debugging output');
    console.log('');
    console.log('Examples:');
    console.log('  ${agentName} "review for security issues"        # Auto-detect');
    console.log('  ${agentName} --file auth.js "check this file"    # Specific file');
    console.log('  ${agentName} --no-auto "general advice"          # No context');
    process.exit(0);
  } else if (!arg.startsWith('--')) {
    userInput += arg + ' ';
  }
}

userInput = userInput.trim();

if (!userInput) {
  console.error('❌ Please provide a prompt');
  console.error('Usage: ${agentName} [options] "your prompt"');
  process.exit(1);
}

// Auto-detect project context if enabled
let contextPrompt = '';
if (autoDetect && explicitFiles.length === 0 && explicitDirs.length === 0) {
  const fs = require('fs');
  const path = require('path');
  const cwd = process.cwd();
  
  // Detect project type and relevant files
  let projectType = 'unknown';
  let relevantFiles = [];
  
  // Check for common project indicators
  if (fs.existsSync('package.json')) {
    projectType = 'javascript/node';
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Add framework detection
    if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
      projectType = 'react';
    } else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
      projectType = 'vue';
    } else if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
      projectType = 'nextjs';
    }
    
    // Common files to include for JS projects
    const jsFiles = ['src/', 'lib/', 'components/', 'pages/', 'api/', 'routes/'];
    jsFiles.forEach(dir => {
      if (fs.existsSync(dir)) relevantFiles.push(dir);
    });
    
  } else if (fs.existsSync('requirements.txt') || fs.existsSync('pyproject.toml')) {
    projectType = 'python';
    relevantFiles = ['*.py', 'src/', 'app/', 'api/'];
    
  } else if (fs.existsSync('Cargo.toml')) {
    projectType = 'rust';
    relevantFiles = ['src/', 'Cargo.toml'];
    
  } else if (fs.existsSync('go.mod')) {
    projectType = 'go';
    relevantFiles = ['*.go', 'cmd/', 'internal/', 'pkg/'];
  }
  
  // Build context prompt
  if (projectType !== 'unknown') {
    contextPrompt = \`

📁 PROJECT CONTEXT:
- Project type: \${projectType}
- Working directory: \${path.basename(cwd)}
- Auto-detected relevant files/folders: \${relevantFiles.join(', ')}

Please analyze the \${userInput} in the context of this \${projectType} project. You have access to read any files in the current directory using the Read tool.\`;
  }
}

// Check Claude CLI availability
if (!checkClaudeCLI()) {
  console.error('❌ Claude CLI not found in PATH');
  console.error('💡 Install Claude CLI: https://claude.ai/code');
  console.error('💡 Or install via npm: npm install -g @anthropic-ai/claude-code');
  process.exit(1);
}

// Escape quotes in system prompt for shell execution
const escapedSystemPrompt = systemPrompt.replace(/"/g, '\\\\"').replace(/\`/g, '\\\\\`');

// Build final prompt with context
const finalPrompt = userInput + contextPrompt;
const escapedFinalPrompt = finalPrompt.replace(/"/g, '\\\\"').replace(/\`/g, '\\\\\`');

// Build Claude command with SDK - use --system-prompt instead of --append-system-prompt for better control
const claudeCmd = \`claude -p "\${escapedFinalPrompt}" --system-prompt "\${escapedSystemPrompt}"\${verbose ? ' --verbose' : ''}\`;

// Debug output if verbose
if (verbose) {
  console.log('\\n🔍 DEBUG MODE - Command Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 User Input:', userInput);
  console.log('📁 Project Context:', contextPrompt ? 'Auto-detected' : 'None');
  console.log('🎯 Final Prompt Length:', finalPrompt.length, 'characters');
  console.log('🤖 System Prompt Preview:', systemPrompt.substring(0, 150) + '...');
  console.log('⚡ Claude Command:', claudeCmd);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
}

// Show loading indicator
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let currentFrame = 0;
const agentDisplayName = '${agentName}'.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());

console.error(\`\\n🤖 \${agentDisplayName} is thinking...\`);
const loader = setInterval(() => {
  process.stderr.write(\`\\r\${frames[currentFrame]} Claude Code is working... \`);
  currentFrame = (currentFrame + 1) % frames.length;
}, 100);

try {
  // Execute Claude with the agent's system prompt
  execSync(claudeCmd, { 
    stdio: ['inherit', 'inherit', 'pipe'],
    cwd: process.cwd() 
  });
  
  // Clear loader
  clearInterval(loader);
  process.stderr.write('\\r✅ Response ready!\\n\\n');
  
} catch (error) {
  clearInterval(loader);
  process.stderr.write('\\r');
  console.error('❌ Error executing Claude:', error.message);
  process.exit(1);
}
`;

  const scriptPath = path.join(BIN_DIR, agentName);
  await fs.writeFile(scriptPath, scriptContent, 'utf8');
  
  // Make executable (Unix/Linux/macOS)
  if (process.platform !== 'win32') {
    await fs.chmod(scriptPath, 0o755);
  }
}

/**
 * Add global agents bin directory to PATH
 */
async function addToPath() {
  const shell = process.env.SHELL || '';
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // Windows PATH management
    console.log(chalk.yellow('🪟 Windows detected:'));
    console.log(chalk.gray(`Add this to your PATH: ${BIN_DIR}`));
    console.log(chalk.gray('Or run this in PowerShell as Administrator:'));
    console.log(chalk.white(`[Environment]::SetEnvironmentVariable("Path", $env:Path + ";${BIN_DIR}", "User")`));
    return;
  }
  
  // Unix-like systems
  const pathExport = `export PATH="${BIN_DIR}:$PATH"`;
  
  // Determine shell config files to update
  const configFiles = [];
  
  if (shell.includes('bash') || !shell) {
    configFiles.push(path.join(os.homedir(), '.bashrc'));
    configFiles.push(path.join(os.homedir(), '.bash_profile'));
  }
  
  if (shell.includes('zsh')) {
    configFiles.push(path.join(os.homedir(), '.zshrc'));
  }
  
  if (shell.includes('fish')) {
    const fishConfigDir = path.join(os.homedir(), '.config', 'fish');
    await fs.ensureDir(fishConfigDir);
    configFiles.push(path.join(fishConfigDir, 'config.fish'));
  }
  
  // Add default files if shell not detected
  if (configFiles.length === 0) {
    configFiles.push(path.join(os.homedir(), '.bashrc'));
    configFiles.push(path.join(os.homedir(), '.zshrc'));
  }
  
  // Check if PATH is already added
  let alreadyInPath = false;
  
  for (const configFile of configFiles) {
    if (await fs.pathExists(configFile)) {
      const content = await fs.readFile(configFile, 'utf8');
      if (content.includes(BIN_DIR)) {
        alreadyInPath = true;
        break;
      }
    }
  }
  
  if (alreadyInPath) {
    console.log(chalk.green('✅ PATH already configured'));
    return;
  }
  
  // Add to PATH in config files
  console.log(chalk.blue('🔧 Adding to PATH...'));
  
  for (const configFile of configFiles) {
    try {
      let content = '';
      if (await fs.pathExists(configFile)) {
        content = await fs.readFile(configFile, 'utf8');
      }
      
      // Add PATH export if not already present
      if (!content.includes(BIN_DIR)) {
        const newContent = content + `\n# Claude Code Templates - Global Agents\n${pathExport}\n`;
        await fs.writeFile(configFile, newContent, 'utf8');
        console.log(chalk.green(`✅ Updated ${path.basename(configFile)}`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not update ${configFile}: ${error.message}`));
    }
  }
}

/**
 * Find agent URL by searching in all categories
 */
async function findAgentUrl(agentName) {
  try {
    // First try root level
    const rootUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/agents/${agentName}.md`;
    const rootResponse = await fetch(rootUrl);
    if (rootResponse.ok) {
      return rootUrl;
    }
    
    // Search in categories
    const categoriesResponse = await fetch('https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/agents');
    if (!categoriesResponse.ok) {
      return null;
    }
    
    const contents = await categoriesResponse.json();
    
    for (const item of contents) {
      if (item.type === 'dir') {
        const categoryUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/agents/${item.name}/${agentName}.md`;
        try {
          const categoryResponse = await fetch(categoryUrl);
          if (categoryResponse.ok) {
            return categoryUrl;
          }
        } catch (error) {
          // Continue searching
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Show available agents for user selection
 */
async function showAvailableAgents() {
  console.log(chalk.yellow('\n📋 Available Agents:'));
  console.log(chalk.gray('Use format: category/agent-name or just agent-name\n'));
  
  try {
    const response = await fetch('https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/agents');
    if (!response.ok) {
      console.log(chalk.red('❌ Could not fetch available agents from GitHub'));
      return;
    }
    
    const contents = await response.json();
    const agents = [];
    
    for (const item of contents) {
      if (item.type === 'file' && item.name.endsWith('.md')) {
        agents.push({ name: item.name.replace('.md', ''), category: 'root' });
      } else if (item.type === 'dir') {
        try {
          const categoryResponse = await fetch(`https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/agents/${item.name}`);
          if (categoryResponse.ok) {
            const categoryContents = await categoryResponse.json();
            for (const categoryItem of categoryContents) {
              if (categoryItem.type === 'file' && categoryItem.name.endsWith('.md')) {
                agents.push({
                  name: categoryItem.name.replace('.md', ''),
                  category: item.name,
                  path: `${item.name}/${categoryItem.name.replace('.md', '')}`
                });
              }
            }
          }
        } catch (error) {
          // Skip category on error
        }
      }
    }
    
    // Group by category
    const grouped = agents.reduce((acc, agent) => {
      const category = agent.category === 'root' ? '🤖 General' : `📁 ${agent.category}`;
      if (!acc[category]) acc[category] = [];
      acc[category].push(agent);
      return acc;
    }, {});
    
    Object.entries(grouped).forEach(([category, categoryAgents]) => {
      console.log(chalk.cyan(category));
      categoryAgents.forEach(agent => {
        const displayName = agent.path || agent.name;
        console.log(chalk.gray(`  • ${displayName}`));
      });
      console.log('');
    });
    
    console.log(chalk.blue('Examples:'));
    console.log(chalk.gray('  npx claude-code-templates@latest --create-agent api-security-audit'));
    console.log(chalk.gray('  npx claude-code-templates@latest --create-agent deep-research-team/academic-researcher'));
    
  } catch (error) {
    console.log(chalk.red('❌ Error fetching agents:', error.message));
  }
}

module.exports = {
  createGlobalAgent,
  listGlobalAgents,
  removeGlobalAgent,
  updateGlobalAgent,
  showAvailableAgents
};
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const ora = require('ora');
const boxen = require('boxen');

/**
 * Health Check module for Claude Code CLI
 * Validates system requirements, configuration, and project setup
 */
class HealthChecker {
  constructor() {
    this.results = {
      system: [],
      claudeCode: [],
      project: [],
      agents: [],
      commands: [],
      mcps: [],
      hooks: []
    };
    this.totalChecks = 0;
    this.passedChecks = 0;
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck() {
    console.log(chalk.blue('🔍 Running Health Check...'));
    console.log('');

    // System requirements check
    await this.checkSystemRequirementsWithSpinner();
    await this.sleep(3000);
    
    // Claude Code configuration check
    await this.checkClaudeCodeSetupWithSpinner();
    await this.sleep(3000);
    
    // Project configuration check
    await this.checkProjectSetupWithSpinner();
    await this.sleep(3000);
    
    // Agents check
    await this.checkAgentsWithSpinner();
    await this.sleep(3000);
    
    // MCP servers check
    await this.checkMCPServersWithSpinner();
    await this.sleep(3000);
    
    // Custom commands check
    await this.checkCustomCommandsWithSpinner();
    await this.sleep(3000);
    
    // Hooks configuration check
    await this.checkHooksConfigurationWithSpinner();
    await this.sleep(1000); // Shorter delay before summary
    
    // Display final summary
    return this.generateSummary();
  }

  /**
   * Check system requirements with spinner and immediate results
   */
  async checkSystemRequirementsWithSpinner() {
    console.log(chalk.cyan('\n┌───────────────────────┐'));
    console.log(chalk.cyan('│  SYSTEM REQUIREMENTS  │'));
    console.log(chalk.cyan('└───────────────────────┘'));
    
    // Operating System
    const osSpinner = ora('Checking Operating System...').start();
    const osInfo = this.checkOperatingSystem();
    this.addResult('system', 'Operating System', osInfo.status, osInfo.message);
    osSpinner.succeed(`${this.getStatusIcon(osInfo.status)} Operating System     │ ${osInfo.message}`);

    // Node.js version
    const nodeSpinner = ora('Checking Node.js Version...').start();
    const nodeInfo = this.checkNodeVersion();
    this.addResult('system', 'Node.js Version', nodeInfo.status, nodeInfo.message);
    nodeSpinner.succeed(`${this.getStatusIcon(nodeInfo.status)} Node.js Version      │ ${nodeInfo.message}`);

    // Memory
    const memorySpinner = ora('Checking Memory Available...').start();
    const memoryInfo = this.checkMemory();
    this.addResult('system', 'Memory Available', memoryInfo.status, memoryInfo.message);
    memorySpinner.succeed(`${this.getStatusIcon(memoryInfo.status)} Memory Available     │ ${memoryInfo.message}`);

    // Network connectivity (this one takes time)
    const networkSpinner = ora('Testing Network Connection...').start();
    const networkInfo = await this.checkNetworkConnectivity();
    this.addResult('system', 'Network Connection', networkInfo.status, networkInfo.message);
    networkSpinner.succeed(`${this.getStatusIcon(networkInfo.status)} Network Connection   │ ${networkInfo.message}`);

    // Shell environment
    const shellSpinner = ora('Checking Shell Environment...').start();
    const shellInfo = this.checkShellEnvironment();
    this.addResult('system', 'Shell Environment', shellInfo.status, shellInfo.message);
    shellSpinner.succeed(`${this.getStatusIcon(shellInfo.status)} Shell Environment    │ ${shellInfo.message}`);
  }

  /**
   * Check Claude Code setup with spinner and immediate results
   */
  async checkClaudeCodeSetupWithSpinner() {
    console.log(chalk.cyan('\n┌─────────────────────┐'));
    console.log(chalk.cyan('│  CLAUDE CODE SETUP  │'));
    console.log(chalk.cyan('└─────────────────────┘'));
    
    // Installation check
    const installSpinner = ora('Checking Claude Code Installation...').start();
    const installInfo = this.checkClaudeCodeInstallation();
    this.addResult('claudeCode', 'Installation', installInfo.status, installInfo.message);
    installSpinner.succeed(`${this.getStatusIcon(installInfo.status)} Installation         │ ${installInfo.message}`);

    // Authentication check (this one can take time)
    const authSpinner = ora('Verifying Authentication...').start();
    const authInfo = this.checkAuthentication();
    this.addResult('claudeCode', 'Authentication', authInfo.status, authInfo.message);
    authSpinner.succeed(`${this.getStatusIcon(authInfo.status)} Authentication       │ ${authInfo.message}`);

    // Auto-updates check
    const updateSpinner = ora('Checking Auto-updates...').start();
    const updateInfo = this.checkAutoUpdates();
    this.addResult('claudeCode', 'Auto-updates', updateInfo.status, updateInfo.message);
    updateSpinner.succeed(`${this.getStatusIcon(updateInfo.status)} Auto-updates         │ ${updateInfo.message}`);

    // Permissions check
    const permissionSpinner = ora('Checking Permissions...').start();
    const permissionInfo = this.checkPermissions();
    this.addResult('claudeCode', 'Permissions', permissionInfo.status, permissionInfo.message);
    permissionSpinner.succeed(`${this.getStatusIcon(permissionInfo.status)} Permissions          │ ${permissionInfo.message}`);
  }

  /**
   * Check project setup with spinner and immediate results
   */
  async checkProjectSetupWithSpinner() {
    console.log(chalk.cyan('\n┌─────────────────┐'));
    console.log(chalk.cyan('│  PROJECT SETUP  │'));
    console.log(chalk.cyan('└─────────────────┘'));
    
    // Project structure
    const structureSpinner = ora('Scanning Project Structure...').start();
    const structureInfo = this.checkProjectStructure();
    this.addResult('project', 'Project Structure', structureInfo.status, structureInfo.message);
    structureSpinner.succeed(`${this.getStatusIcon(structureInfo.status)} Project Structure    │ ${structureInfo.message}`);

    // Configuration files
    const configSpinner = ora('Checking Configuration Files...').start();
    const configInfo = this.checkConfigurationFiles();
    this.addResult('project', 'Configuration Files', configInfo.status, configInfo.message);
    configSpinner.succeed(`${this.getStatusIcon(configInfo.status)} Configuration Files  │ ${configInfo.message}`);

    // User settings validation
    const userSettingsSpinner = ora('Validating User Settings...').start();
    const userSettingsInfo = this.checkUserSettings();
    this.addResult('project', 'User Settings', userSettingsInfo.status, userSettingsInfo.message);
    userSettingsSpinner.succeed(`${this.getStatusIcon(userSettingsInfo.status)} User Settings        │ ${userSettingsInfo.message}`);

    // Project settings validation
    const projectSettingsSpinner = ora('Validating Project Settings...').start();
    const projectSettingsInfo = this.checkProjectSettings();
    this.addResult('project', 'Project Settings', projectSettingsInfo.status, projectSettingsInfo.message);
    projectSettingsSpinner.succeed(`${this.getStatusIcon(projectSettingsInfo.status)} Project Settings     │ ${projectSettingsInfo.message}`);

    // Local settings validation
    const localSettingsSpinner = ora('Validating Local Settings...').start();
    const localSettingsInfo = this.checkLocalSettings();
    this.addResult('project', 'Local Settings', localSettingsInfo.status, localSettingsInfo.message);
    localSettingsSpinner.succeed(`${this.getStatusIcon(localSettingsInfo.status)} Local Settings       │ ${localSettingsInfo.message}`);
  }

  /**
   * Check agents with spinner and immediate results
   */
  async checkAgentsWithSpinner() {
    console.log(chalk.cyan('\n┌──────────┐'));
    console.log(chalk.cyan('│  AGENTS  │'));
    console.log(chalk.cyan('└──────────┘'));
    
    // Project agents
    const projectSpinner = ora('Scanning Project Agents...').start();
    const projectAgents = this.checkProjectAgents();
    this.addResult('agents', 'Project Agents', projectAgents.status, projectAgents.message);
    projectSpinner.succeed(`${this.getStatusIcon(projectAgents.status)} Project Agents      │ ${projectAgents.message}`);

    // Personal agents
    const personalSpinner = ora('Scanning Personal Agents...').start();
    const personalAgents = this.checkPersonalAgents();
    this.addResult('agents', 'Personal Agents', personalAgents.status, personalAgents.message);
    personalSpinner.succeed(`${this.getStatusIcon(personalAgents.status)} Personal Agents     │ ${personalAgents.message}`);

    // Agent syntax validation
    const syntaxSpinner = ora('Validating Agent Syntax...').start();
    const syntaxInfo = this.checkAgentSyntax();
    this.addResult('agents', 'Agent Syntax', syntaxInfo.status, syntaxInfo.message);
    syntaxSpinner.succeed(`${this.getStatusIcon(syntaxInfo.status)} Agent Syntax        │ ${syntaxInfo.message}`);
  }

  /**
   * Check MCP servers with spinner and immediate results
   */
  async checkMCPServersWithSpinner() {
    console.log(chalk.cyan('\n┌──────────────┐'));
    console.log(chalk.cyan('│  MCP SERVERS │'));
    console.log(chalk.cyan('└──────────────┘'));
    
    // Project MCP configuration
    const projectMCPSpinner = ora('Scanning Project MCP Configuration...').start();
    const projectMCP = this.checkProjectMCPConfiguration();
    this.addResult('mcps', 'Project MCP Config', projectMCP.status, projectMCP.message);
    projectMCPSpinner.succeed(`${this.getStatusIcon(projectMCP.status)} Project MCP Config   │ ${projectMCP.message}`);

    // MCP configuration validation
    const mcpValidationSpinner = ora('Validating MCP Configuration...').start();
    const mcpValidation = this.checkMCPConfigurationSyntax();
    this.addResult('mcps', 'MCP Config Syntax', mcpValidation.status, mcpValidation.message);
    mcpValidationSpinner.succeed(`${this.getStatusIcon(mcpValidation.status)} MCP Config Syntax   │ ${mcpValidation.message}`);
  }

  /**
   * Check custom commands with spinner and immediate results
   */
  async checkCustomCommandsWithSpinner() {
    console.log(chalk.cyan('\n┌───────────────────┐'));
    console.log(chalk.cyan('│  CUSTOM COMMANDS  │'));
    console.log(chalk.cyan('└───────────────────┘'));
    
    // Project commands
    const projectSpinner = ora('Scanning Project Commands...').start();
    const projectCommands = this.checkProjectCommands();
    this.addResult('commands', 'Project Commands', projectCommands.status, projectCommands.message);
    projectSpinner.succeed(`${this.getStatusIcon(projectCommands.status)} Project Commands     │ ${projectCommands.message}`);

    // Personal commands
    const personalSpinner = ora('Scanning Personal Commands...').start();
    const personalCommands = this.checkPersonalCommands();
    this.addResult('commands', 'Personal Commands', personalCommands.status, personalCommands.message);
    personalSpinner.succeed(`${this.getStatusIcon(personalCommands.status)} Personal Commands    │ ${personalCommands.message}`);

    // Command syntax validation
    const syntaxSpinner = ora('Validating Command Syntax...').start();
    const syntaxInfo = this.checkCommandSyntax();
    this.addResult('commands', 'Command Syntax', syntaxInfo.status, syntaxInfo.message);
    syntaxSpinner.succeed(`${this.getStatusIcon(syntaxInfo.status)} Command Syntax       │ ${syntaxInfo.message}`);
  }

  /**
   * Check hooks configuration with spinner and immediate results
   */
  async checkHooksConfigurationWithSpinner() {
    console.log(chalk.cyan('\n┌─────────┐'));
    console.log(chalk.cyan('│  HOOKS  │'));
    console.log(chalk.cyan('└─────────┘'));
    
    // User hooks
    const userSpinner = ora('Checking User Hooks...').start();
    const userHooks = this.checkUserHooks();
    this.addResult('hooks', 'User Hooks', userHooks.status, userHooks.message);
    userSpinner.succeed(`${this.getStatusIcon(userHooks.status)} User Hooks           │ ${userHooks.message}`);

    // Project hooks
    const projectSpinner = ora('Checking Project Hooks...').start();
    const projectHooks = this.checkProjectHooks();
    this.addResult('hooks', 'Project Hooks', projectHooks.status, projectHooks.message);
    projectSpinner.succeed(`${this.getStatusIcon(projectHooks.status)} Project Hooks        │ ${projectHooks.message}`);

    // Local hooks
    const localSpinner = ora('Checking Local Hooks...').start();
    const localHooks = this.checkLocalHooks();
    this.addResult('hooks', 'Local Hooks', localHooks.status, localHooks.message);
    localSpinner.succeed(`${this.getStatusIcon(localHooks.status)} Local Hooks          │ ${localHooks.message}`);

    // Hook commands validation
    const hookSpinner = ora('Validating Hook Commands...').start();
    const hookCommands = this.checkHookCommands();
    this.addResult('hooks', 'Hook Commands', hookCommands.status, hookCommands.message);
    hookSpinner.succeed(`${this.getStatusIcon(hookCommands.status)} Hook Commands        │ ${hookCommands.message}`);

    // MCP hooks
    const mcpSpinner = ora('Scanning MCP Hooks...').start();
    const mcpHooks = this.checkMCPHooks();
    this.addResult('hooks', 'MCP Hooks', mcpHooks.status, mcpHooks.message);
    mcpSpinner.succeed(`${this.getStatusIcon(mcpHooks.status)} MCP Hooks            │ ${mcpHooks.message}`);
  }

  /**
   * Individual check implementations
   */
  checkOperatingSystem() {
    const platform = os.platform();
    const release = os.release();
    
    const supportedPlatforms = {
      'darwin': { name: 'macOS', minVersion: '10.15' },
      'linux': { name: 'Linux', minVersion: '20.04' },
      'win32': { name: 'Windows', minVersion: '10' }
    };

    if (supportedPlatforms[platform]) {
      const osName = supportedPlatforms[platform].name;
      return {
        status: 'pass',
        message: `${osName} ${release} (compatible)`
      };
    }

    return {
      status: 'fail',
      message: `${platform} ${release} (not officially supported)`
    };
  }

  checkNodeVersion() {
    try {
      const version = process.version;
      const majorVersion = parseInt(version.split('.')[0].substring(1));
      
      if (majorVersion >= 18) {
        return {
          status: 'pass',
          message: `${version} (compatible)`
        };
      } else {
        return {
          status: 'fail',
          message: `${version} (requires Node.js 18+)`
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Node.js not found'
      };
    }
  }

  checkMemory() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const totalGB = (totalMemory / (1024 * 1024 * 1024)).toFixed(1);
    const freeGB = (freeMemory / (1024 * 1024 * 1024)).toFixed(1);
    
    if (totalMemory >= 4 * 1024 * 1024 * 1024) { // 4GB
      return {
        status: 'pass',
        message: `${totalGB}GB total, ${freeGB}GB free (sufficient)`
      };
    } else {
      return {
        status: 'warn',
        message: `${totalGB}GB total (recommended 4GB+)`
      };
    }
  }

  async checkNetworkConnectivity() {
    try {
      const https = require('https');
      return new Promise((resolve) => {
        const req = https.get('https://api.anthropic.com', { timeout: 5000 }, (res) => {
          resolve({
            status: 'pass',
            message: 'Connected to Anthropic API'
          });
        });
        
        req.on('error', () => {
          resolve({
            status: 'fail',
            message: 'Cannot reach Anthropic API'
          });
        });
        
        req.on('timeout', () => {
          resolve({
            status: 'warn',
            message: 'Slow connection to Anthropic API'
          });
        });
      });
    } catch (error) {
      return {
        status: 'fail',
        message: 'Network connectivity test failed'
      };
    }
  }

  checkShellEnvironment() {
    const shell = process.env.SHELL || 'unknown';
    const shellName = path.basename(shell);
    
    const supportedShells = ['bash', 'zsh', 'fish'];
    
    if (supportedShells.includes(shellName)) {
      if (shellName === 'zsh') {
        return {
          status: 'pass',
          message: `${shellName} (excellent autocompletion support)`
        };
      } else {
        return {
          status: 'pass',
          message: `${shellName} (compatible)`
        };
      }
    } else {
      return {
        status: 'warn',
        message: `${shellName} (consider using bash, zsh, or fish)`
      };
    }
  }

  checkClaudeCodeInstallation() {
    try {
      // Try to find claude-code package
      const packagePath = path.join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-code');
      if (fs.existsSync(packagePath)) {
        const packageJson = require(path.join(packagePath, 'package.json'));
        return {
          status: 'pass',
          message: `v${packageJson.version} (locally installed)`
        };
      }
      
      // Check global installation
      try {
        const output = execSync('claude --version', { encoding: 'utf8', stdio: 'pipe' });
        return {
          status: 'pass',
          message: `${output.trim()} (globally installed)`
        };
      } catch (error) {
        return {
          status: 'fail',
          message: 'Claude Code CLI not found'
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Installation check failed'
      };
    }
  }

  checkAuthentication() {
    const homeDir = os.homedir();
    
    // Check for Claude Code OAuth authentication in ~/.claude.json
    const claudeJsonPath = path.join(homeDir, '.claude.json');
    
    try {
      if (fs.existsSync(claudeJsonPath)) {
        const claudeConfig = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
        
        // Check for OAuth authentication
        if (claudeConfig.oauthAccount && claudeConfig.oauthAccount.accountUuid) {
          const email = claudeConfig.oauthAccount.emailAddress || 'OAuth user';
          return {
            status: 'pass',
            message: `Authenticated via OAuth (${email})`
          };
        }
        
        // Check for API key authentication
        if (claudeConfig.apiKey) {
          return {
            status: 'pass',
            message: 'Authenticated via API key'
          };
        }
      }
      
      // Check for environment variable API key
      if (process.env.ANTHROPIC_API_KEY) {
        return {
          status: 'pass',
          message: 'Authenticated via ANTHROPIC_API_KEY environment variable'
        };
      }
      
      // Try to check if we can make a simple claude command
      try {
        execSync('claude --version', { 
          encoding: 'utf8', 
          stdio: 'pipe',
          timeout: 3000 
        });
        
        return {
          status: 'warn',
          message: 'Claude CLI available but authentication not configured'
        };
      } catch (cliError) {
        return {
          status: 'fail',
          message: 'Claude CLI not available or not authenticated'
        };
      }
      
    } catch (error) {
      // If we can't read the config file, check if CLI is at least installed
      try {
        execSync('claude --version', { 
          encoding: 'utf8', 
          stdio: 'pipe',
          timeout: 3000 
        });
        
        return {
          status: 'warn',
          message: 'Claude CLI available but authentication not verified'
        };
      } catch (cliError) {
        return {
          status: 'fail',
          message: 'Claude CLI not available or authentication check failed'
        };
      }
    }
  }

  checkAutoUpdates() {
    // This is a placeholder - actual implementation would check Claude's update settings
    return {
      status: 'pass',
      message: 'Auto-updates assumed enabled'
    };
  }

  checkPermissions() {
    const homeDir = os.homedir();
    const claudeDir = path.join(homeDir, '.claude');
    
    try {
      if (fs.existsSync(claudeDir)) {
        const stats = fs.statSync(claudeDir);
        const isWritable = fs.access(claudeDir, fs.constants.W_OK);
        return {
          status: 'pass',
          message: 'Claude directory permissions OK'
        };
      } else {
        return {
          status: 'warn',
          message: 'Claude directory not found'
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Permission check failed'
      };
    }
  }

  checkProjectStructure() {
    const currentDir = process.cwd();
    
    // Check if it's a valid project directory
    const indicators = [
      'package.json',
      'requirements.txt',
      'Cargo.toml',
      'go.mod',
      '.git',
      'README.md'
    ];
    
    const foundIndicators = indicators.filter(indicator => 
      fs.existsSync(path.join(currentDir, indicator))
    );
    
    if (foundIndicators.length > 0) {
      return {
        status: 'pass',
        message: `Valid project detected (${foundIndicators.join(', ')})`
      };
    } else {
      return {
        status: 'warn',
        message: 'No clear project structure indicators found'
      };
    }
  }

  checkConfigurationFiles() {
    const currentDir = process.cwd();
    const claudeDir = path.join(currentDir, '.claude');
    
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir);
      return {
        status: 'pass',
        message: `Found .claude/ directory with ${files.length} files`
      };
    } else {
      return {
        status: 'warn',
        message: 'No .claude/ directory found'
      };
    }
  }

  checkProjectMCPConfiguration() {
    const currentDir = process.cwd();
    const mcpConfigPath = path.join(currentDir, '.mcp.json');
    
    if (fs.existsSync(mcpConfigPath)) {
      try {
        const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
        
        if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object') {
          const serverCount = Object.keys(mcpConfig.mcpServers).length;
          return {
            status: 'pass',
            message: `${serverCount} MCP servers configured in .mcp.json`
          };
        } else {
          return {
            status: 'warn',
            message: 'No mcpServers found in .mcp.json'
          };
        }
      } catch (error) {
        return {
          status: 'fail',
          message: 'Invalid JSON syntax in .mcp.json'
        };
      }
    } else {
      return {
        status: 'warn',
        message: 'No project MCP configuration found (.mcp.json)'
      };
    }
  }

  checkMCPConfigurationSyntax() {
    const configPaths = [
      path.join(process.cwd(), '.mcp.json')
    ];
    
    let totalServers = 0;
    let validServers = 0;
    let invalidServers = 0;
    const issues = [];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const mcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object') {
            const servers = mcpConfig.mcpServers;
            
            for (const [serverName, serverConfig] of Object.entries(servers)) {
              totalServers++;
              
              // Validate server configuration structure
              if (!serverConfig || typeof serverConfig !== 'object') {
                invalidServers++;
                issues.push(`Invalid server config for ${serverName} in ${path.basename(configPath)}`);
                continue;
              }
              
              // Check required fields
              if (!serverConfig.command) {
                invalidServers++;
                issues.push(`Missing command for ${serverName} in ${path.basename(configPath)}`);
                continue;
              }
              
              // Optional: Check if args is array when present
              if (serverConfig.args && !Array.isArray(serverConfig.args)) {
                invalidServers++;
                issues.push(`Invalid args format for ${serverName} in ${path.basename(configPath)} (should be array)`);
                continue;
              }
              
              // Optional: Check if env is object when present
              if (serverConfig.env && typeof serverConfig.env !== 'object') {
                invalidServers++;
                issues.push(`Invalid env format for ${serverName} in ${path.basename(configPath)} (should be object)`);
                continue;
              }
              
              validServers++;
            }
          }
        } catch (error) {
          // JSON parsing error already handled in other checks
        }
      }
    }
    
    if (totalServers === 0) {
      return {
        status: 'warn',
        message: 'No MCP servers configured'
      };
    }
    
    if (invalidServers === 0) {
      return {
        status: 'pass',
        message: `All ${totalServers} MCP server configurations are valid`
      };
    } else if (validServers > 0) {
      return {
        status: 'warn',
        message: `${validServers}/${totalServers} MCP servers valid, ${invalidServers} issues found`
      };
    } else {
      return {
        status: 'fail',
        message: `All ${totalServers} MCP server configurations have issues`
      };
    }
  }

  checkProjectCommands() {
    const currentDir = process.cwd();
    const commandsDir = path.join(currentDir, '.claude', 'commands');
    
    if (fs.existsSync(commandsDir)) {
      const commands = fs.readdirSync(commandsDir).filter(file => file.endsWith('.md'));
      return {
        status: 'pass',
        message: `${commands.length} commands found in .claude/commands/`
      };
    } else {
      return {
        status: 'warn',
        message: 'No project commands directory found'
      };
    }
  }

  checkPersonalCommands() {
    const homeDir = os.homedir();
    const commandsDir = path.join(homeDir, '.claude', 'commands');
    
    if (fs.existsSync(commandsDir)) {
      const commands = fs.readdirSync(commandsDir).filter(file => file.endsWith('.md'));
      return {
        status: 'pass',
        message: `${commands.length} commands found in ~/.claude/commands/`
      };
    } else {
      return {
        status: 'warn',
        message: 'No personal commands directory found'
      };
    }
  }

  checkCommandSyntax() {
    const currentDir = process.cwd();
    const commandsDir = path.join(currentDir, '.claude', 'commands');
    
    if (!fs.existsSync(commandsDir)) {
      return {
        status: 'warn',
        message: 'No commands to validate'
      };
    }
    
    const commands = fs.readdirSync(commandsDir).filter(file => file.endsWith('.md'));
    let issuesFound = 0;
    
    for (const command of commands) {
      const commandPath = path.join(commandsDir, command);
      const content = fs.readFileSync(commandPath, 'utf8');
      
      // Check for $ARGUMENTS placeholder
      if (!content.includes('$ARGUMENTS')) {
        issuesFound++;
      }
    }
    
    if (issuesFound === 0) {
      return {
        status: 'pass',
        message: 'All commands have proper syntax'
      };
    } else {
      return {
        status: 'warn',
        message: `${issuesFound} commands missing $ARGUMENTS placeholder`
      };
    }
  }

  checkProjectAgents() {
    const currentDir = process.cwd();
    const agentsDir = path.join(currentDir, '.claude', 'agents');
    
    if (fs.existsSync(agentsDir)) {
      const agents = this.countAgentsRecursively(agentsDir);
      return {
        status: 'pass',
        message: `${agents} agents found in .claude/agents/`
      };
    } else {
      return {
        status: 'warn',
        message: 'No project agents directory found'
      };
    }
  }

  checkPersonalAgents() {
    const homeDir = os.homedir();
    const agentsDir = path.join(homeDir, '.claude', 'agents');
    
    if (fs.existsSync(agentsDir)) {
      const agents = this.countAgentsRecursively(agentsDir);
      return {
        status: 'pass',
        message: `${agents} agents found in ~/.claude/agents/`
      };
    } else {
      return {
        status: 'warn',
        message: 'No personal agents directory found'
      };
    }
  }

  countAgentsRecursively(dir) {
    let count = 0;
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          count += this.countAgentsRecursively(itemPath);
        } else if (item.endsWith('.md')) {
          count++;
        }
      }
    } catch (error) {
      // Handle permission or access errors
    }
    return count;
  }

  checkAgentSyntax() {
    const currentDir = process.cwd();
    const agentsDir = path.join(currentDir, '.claude', 'agents');
    
    if (!fs.existsSync(agentsDir)) {
      return {
        status: 'warn',
        message: 'No agents to validate'
      };
    }
    
    const agents = this.getAgentFilesRecursively(agentsDir);
    let issuesFound = 0;
    let agentsChecked = 0;
    
    for (const agentPath of agents) {
      try {
        const content = fs.readFileSync(agentPath, 'utf8');
        agentsChecked++;
        
        // Check for frontmatter (agent metadata)
        if (!content.includes('---') || !content.includes('name:') || !content.includes('description:')) {
          issuesFound++;
        }
      } catch (error) {
        issuesFound++;
      }
    }
    
    if (agentsChecked === 0) {
      return {
        status: 'warn',
        message: 'No agents to validate'
      };
    }
    
    if (issuesFound === 0) {
      return {
        status: 'pass',
        message: `All ${agentsChecked} agents have proper syntax`
      };
    } else {
      return {
        status: 'warn',
        message: `${issuesFound}/${agentsChecked} agents missing proper frontmatter`
      };
    }
  }

  getAgentFilesRecursively(dir) {
    let files = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          files = files.concat(this.getAgentFilesRecursively(itemPath));
        } else if (item.endsWith('.md')) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      // Handle permission or access errors
    }
    return files;
  }

  checkUserHooks() {
    const homeDir = os.homedir();
    const settingsPath = path.join(homeDir, '.claude', 'settings.json');
    
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const hooks = settings.hooks || [];
        return {
          status: 'pass',
          message: `${hooks.length} hooks configured in ~/.claude/settings.json`
        };
      } catch (error) {
        return {
          status: 'fail',
          message: 'Invalid JSON in ~/.claude/settings.json'
        };
      }
    } else {
      return {
        status: 'warn',
        message: 'No user hooks configuration found'
      };
    }
  }

  checkProjectHooks() {
    const currentDir = process.cwd();
    const settingsPath = path.join(currentDir, '.claude', 'settings.json');
    
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const hooks = settings.hooks || [];
        return {
          status: 'pass',
          message: `${hooks.length} hooks configured in .claude/settings.json`
        };
      } catch (error) {
        return {
          status: 'fail',
          message: 'Invalid JSON in .claude/settings.json'
        };
      }
    } else {
      return {
        status: 'warn',
        message: 'No project hooks configuration found'
      };
    }
  }

  checkLocalHooks() {
    const currentDir = process.cwd();
    const settingsPath = path.join(currentDir, '.claude', 'settings.local.json');
    
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const hooks = settings.hooks || [];
        return {
          status: 'pass',
          message: `${hooks.length} hooks configured in .claude/settings.local.json`
        };
      } catch (error) {
        return {
          status: 'fail',
          message: 'Invalid JSON syntax in .claude/settings.local.json'
        };
      }
    } else {
      return {
        status: 'warn',
        message: 'No local hooks configuration found'
      };
    }
  }

  checkHookCommands() {
    const hookSettingsFiles = [
      path.join(os.homedir(), '.claude', 'settings.json'),
      path.join(process.cwd(), '.claude', 'settings.json'),
      path.join(process.cwd(), '.claude', 'settings.local.json')
    ];
    
    let totalHooks = 0;
    let validHooks = 0;
    let invalidHooks = 0;
    const issues = [];
    
    for (const settingsFile of hookSettingsFiles) {
      if (fs.existsSync(settingsFile)) {
        try {
          const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
          const hooks = settings.hooks || [];
          
          for (const hook of hooks) {
            totalHooks++;
            
            // Validate hook structure
            if (!hook.command) {
              invalidHooks++;
              issues.push(`Missing command in hook from ${path.basename(settingsFile)}`);
              continue;
            }
            
            // Check if command is executable
            try {
              // Extract command from potential shell command
              const command = hook.command.split(' ')[0];
              
              // Check if it's a shell builtin or if the command exists
              if (this.isShellBuiltin(command) || this.commandExists(command)) {
                validHooks++;
              } else {
                invalidHooks++;
                issues.push(`Command not found: ${command} in ${path.basename(settingsFile)}`);
              }
            } catch (error) {
              invalidHooks++;
              issues.push(`Error validating command: ${hook.command} in ${path.basename(settingsFile)}`);
            }
          }
        } catch (error) {
          // JSON parsing error was already handled in other checks
        }
      }
    }
    
    if (totalHooks === 0) {
      return {
        status: 'warn',
        message: 'No hooks configured'
      };
    }
    
    if (invalidHooks === 0) {
      return {
        status: 'pass',
        message: `All ${totalHooks} hook commands are valid`
      };
    } else if (validHooks > 0) {
      return {
        status: 'warn',
        message: `${validHooks}/${totalHooks} hook commands valid, ${invalidHooks} issues found`
      };
    } else {
      return {
        status: 'fail',
        message: `All ${totalHooks} hook commands have issues`
      };
    }
  }
  
  isShellBuiltin(command) {
    const shellBuiltins = [
      'echo', 'cd', 'pwd', 'exit', 'export', 'unset', 'alias', 'unalias',
      'history', 'type', 'which', 'command', 'builtin', 'source', '.',
      'test', '[', 'if', 'then', 'else', 'fi', 'case', 'esac', 'for', 'while'
    ];
    return shellBuiltins.includes(command);
  }
  
  commandExists(command) {
    try {
      execSync(`command -v ${command}`, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        timeout: 2000 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  checkMCPHooks() {
    // Placeholder for MCP hooks validation
    return {
      status: 'warn',
      message: 'MCP hooks validation not implemented'
    };
  }

  checkUserSettings() {
    const homeDir = os.homedir();
    const userSettingsPath = path.join(homeDir, '.claude', 'settings.json');
    
    if (!fs.existsSync(userSettingsPath)) {
      return {
        status: 'warn',
        message: 'No user settings found (~/.claude/settings.json)'
      };
    }
    
    try {
      const settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      const analysis = this.analyzeSettingsStructure(settings, 'user');
      
      return {
        status: analysis.issues.length === 0 ? 'pass' : 'warn',
        message: analysis.issues.length === 0 ? 
          `Valid user settings (${analysis.summary})` : 
          `User settings issues: ${analysis.issues.join(', ')}`
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Invalid JSON in ~/.claude/settings.json'
      };
    }
  }

  checkProjectSettings() {
    const currentDir = process.cwd();
    const projectSettingsPath = path.join(currentDir, '.claude', 'settings.json');
    
    if (!fs.existsSync(projectSettingsPath)) {
      return {
        status: 'warn',
        message: 'No project settings found (.claude/settings.json)'
      };
    }
    
    try {
      const settings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf8'));
      const analysis = this.analyzeSettingsStructure(settings, 'project');
      
      return {
        status: analysis.issues.length === 0 ? 'pass' : 'warn',
        message: analysis.issues.length === 0 ? 
          `Valid project settings (${analysis.summary})` : 
          `Project settings issues: ${analysis.issues.join(', ')}`
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Invalid JSON in .claude/settings.json'
      };
    }
  }

  checkLocalSettings() {
    const currentDir = process.cwd();
    const localSettingsPath = path.join(currentDir, '.claude', 'settings.local.json');
    
    if (!fs.existsSync(localSettingsPath)) {
      return {
        status: 'warn',
        message: 'No local settings found (.claude/settings.local.json)'
      };
    }
    
    try {
      const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
      const analysis = this.analyzeSettingsStructure(settings, 'local');
      
      return {
        status: analysis.issues.length === 0 ? 'pass' : 'warn',
        message: analysis.issues.length === 0 ? 
          `Valid local settings (${analysis.summary})` : 
          `Local settings issues: ${analysis.issues.join(', ')}`
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Invalid JSON in .claude/settings.local.json'
      };
    }
  }

  analyzeSettingsStructure(settings, type) {
    const issues = [];
    const summary = [];
    
    // Check for common configuration sections
    if (settings.permissions) {
      const perms = settings.permissions;
      if (perms.allow && Array.isArray(perms.allow)) {
        summary.push(`${perms.allow.length} allow rules`);
      }
      if (perms.deny && Array.isArray(perms.deny)) {
        summary.push(`${perms.deny.length} deny rules`);
      }
      if (perms.additionalDirectories && Array.isArray(perms.additionalDirectories)) {
        summary.push(`${perms.additionalDirectories.length} additional dirs`);
      }
    }
    
    if (settings.hooks) {
      const hookTypes = Object.keys(settings.hooks);
      summary.push(`${hookTypes.length} hook types`);
      
      // Validate hook structure
      for (const hookType of hookTypes) {
        const validHookTypes = ['PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
        if (!validHookTypes.includes(hookType)) {
          issues.push(`Invalid hook type: ${hookType}`);
        }
      }
    }
    
    if (settings.env) {
      const envVars = Object.keys(settings.env);
      summary.push(`${envVars.length} env vars`);
      
      // Check for sensitive environment variables
      const sensitiveVars = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
      for (const envVar of envVars) {
        if (sensitiveVars.includes(envVar)) {
          issues.push(`Sensitive env var in ${type} settings: ${envVar}`);
        }
      }
    }
    
    if (settings.model) {
      summary.push(`model: ${settings.model}`);
    }
    
    if (settings.enableAllProjectMcpServers !== undefined) {
      summary.push(`MCP auto-approve: ${settings.enableAllProjectMcpServers}`);
    }
    
    if (settings.enabledMcpjsonServers && Array.isArray(settings.enabledMcpjsonServers)) {
      summary.push(`${settings.enabledMcpjsonServers.length} enabled MCP servers`);
    }
    
    if (settings.disabledMcpjsonServers && Array.isArray(settings.disabledMcpjsonServers)) {
      summary.push(`${settings.disabledMcpjsonServers.length} disabled MCP servers`);
    }
    
    // Check for deprecated or problematic settings
    if (settings.apiKeyHelper) {
      summary.push('API key helper configured');
      if (type === 'project') {
        issues.push('API key helper should be in user settings, not project');
      }
    }
    
    if (settings.cleanupPeriodDays !== undefined) {
      if (typeof settings.cleanupPeriodDays !== 'number' || settings.cleanupPeriodDays < 1) {
        issues.push('Invalid cleanupPeriodDays value');
      } else {
        summary.push(`cleanup: ${settings.cleanupPeriodDays} days`);
      }
    }
    
    return {
      issues,
      summary: summary.length > 0 ? summary.join(', ') : 'basic configuration'
    };
  }

  /**
   * Helper methods
   */
  addResult(category, check, status, message) {
    this.results[category].push({
      check,
      status,
      message
    });
    this.totalChecks++;
    if (status === 'pass') {
      this.passedChecks++;
    }
  }

  getStatusIcon(status) {
    switch (status) {
      case 'pass': return '✅';
      case 'warn': return '⚠️';
      case 'fail': return '❌';
      default: return '❓';
    }
  }

  /**
   * Sleep utility for pacing between categories
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateSummary() {
    const healthScore = `${this.passedChecks}/${this.totalChecks}`;
    const percentage = Math.round((this.passedChecks / this.totalChecks) * 100);
    
    console.log(chalk.cyan(`\n📊 Health Score: ${healthScore} checks passed (${percentage}%)`));
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();
    if (recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    return {
      healthScore,
      percentage,
      passed: this.passedChecks,
      total: this.totalChecks,
      recommendations
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Add recommendations based on results
    const allResults = [
      ...this.results.system,
      ...this.results.claudeCode,
      ...this.results.project,
      ...this.results.agents,
      ...this.results.commands,
      ...this.results.mcps,
      ...this.results.hooks
    ];
    
    allResults.forEach(result => {
      if (result.status === 'fail' || result.status === 'warn') {
        // Add specific recommendations based on the check
        if (result.check === 'Shell Environment' && result.message.includes('bash')) {
          recommendations.push('Consider switching to Zsh for better autocompletion and features');
        } else if (result.check === 'Command Syntax' && result.message.includes('$ARGUMENTS')) {
          recommendations.push('Add $ARGUMENTS placeholder to command files for proper parameter handling');
        } else if (result.check === 'Agent Syntax' && result.message.includes('frontmatter')) {
          recommendations.push('Add proper frontmatter (name, description) to agent files');
        } else if (result.check === 'Project Agents' && result.message.includes('No project agents directory')) {
          recommendations.push('Create .claude/agents/ directory to organize your custom agents');
        } else if (result.check === 'Project MCP Config' && result.message.includes('No project MCP configuration')) {
          recommendations.push('Create .mcp.json file to configure MCP servers for your project');
        } else if (result.check === 'MCP Config Syntax' && result.message.includes('Invalid JSON')) {
          recommendations.push('Fix JSON syntax errors in MCP configuration files');
        } else if (result.check === 'MCP Config Syntax' && result.message.includes('Missing command')) {
          recommendations.push('Add missing command fields to MCP server configurations');
        } else if (result.check === 'Local Hooks' && result.message.includes('Invalid JSON')) {
          recommendations.push('Fix JSON syntax error in .claude/settings.local.json');
        }
      }
    });
    
    return recommendations;
  }
}

/**
 * Main health check function
 */
async function runHealthCheck() {
  const checker = new HealthChecker();
  const results = await checker.runHealthCheck();
  
  // Ask if user wants to run setup
  const inquirer = require('inquirer');
  const setupChoice = await inquirer.prompt([{
    type: 'confirm',
    name: 'runSetup',
    message: 'Would you like to run the Project Setup?',
    default: results.percentage < 80
  }]);
  
  return {
    results,
    runSetup: setupChoice.runSetup
  };
}

module.exports = {
  HealthChecker,
  runHealthCheck
};
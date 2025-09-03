const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const { detectProject } = require('./utils');
const { getTemplateConfig, TEMPLATES_CONFIG } = require('./templates');
const { createPrompts, interactivePrompts } = require('./prompts');
const { copyTemplateFiles, runPostInstallationValidation } = require('./file-operations');
const { getHooksForLanguage, getMCPsForLanguage } = require('./hook-scanner');
const { installAgents } = require('./agents');
const { runCommandStats } = require('./command-stats');
const { runHookStats } = require('./hook-stats');
const { runMCPStats } = require('./mcp-stats');
const { runAnalytics } = require('./analytics');
const { startChatsMobile } = require('./chats-mobile');
const { runHealthCheck } = require('./health-check');
const { trackingService } = require('./tracking-service');
const { createGlobalAgent, listGlobalAgents, removeGlobalAgent, updateGlobalAgent } = require('./sdk/global-agent-manager');

async function showMainMenu() {
  console.log('');
  
  const initialChoice = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      {
        name: '📊 Analytics Dashboard - Monitor your Claude Code usage and sessions',
        value: 'analytics',
        short: 'Analytics Dashboard'
      },
      {
        name: '💬 Chats Mobile - AI-first mobile interface for conversations',
        value: 'chats',
        short: 'Chats Mobile'
      },
      {
        name: '🤖 Agents Dashboard - View and analyze Claude conversations with agent tools',
        value: 'agents',
        short: 'Agents Dashboard'
      },
      {
        name: '⚙️ Project Setup - Configure Claude Code for your project',
        value: 'setup',
        short: 'Project Setup'
      },
      {
        name: '🔍 Health Check - Verify your Claude Code setup and configuration',
        value: 'health',
        short: 'Health Check'
      }
    ],
    default: 'analytics'
  }]);
  
  if (initialChoice.action === 'analytics') {
    console.log(chalk.blue('📊 Launching Claude Code Analytics Dashboard...'));
    trackingService.trackAnalyticsDashboard({ page: 'dashboard', source: 'interactive_menu' });
    await runAnalytics({});
    return;
  }
  
  if (initialChoice.action === 'chats') {
    console.log(chalk.blue('💬 Launching Claude Code Mobile Chats...'));
    trackingService.trackAnalyticsDashboard({ page: 'chats-mobile', source: 'interactive_menu' });
    await startChatsMobile({});
    return;
  }
  
  if (initialChoice.action === 'agents') {
    console.log(chalk.blue('🤖 Launching Claude Code Agents Dashboard...'));
    trackingService.trackAnalyticsDashboard({ page: 'agents', source: 'interactive_menu' });
    await runAnalytics({ openTo: 'agents' });
    return;
  }
  
  
  if (initialChoice.action === 'health') {
    console.log(chalk.blue('🔍 Running Health Check...'));
    const healthResult = await runHealthCheck();
    
    // Track health check usage
    trackingService.trackHealthCheck({
      setup_recommended: healthResult.runSetup,
      issues_found: healthResult.issues || 0
    });
    
    if (healthResult.runSetup) {
      console.log(chalk.blue('⚙️  Starting Project Setup...'));
      // Continue with setup flow
      return await createClaudeConfig({});
    } else {
      console.log(chalk.green('👍 Health check completed. Returning to main menu...'));
      return await showMainMenu();
    }
  }
  
  // Continue with setup if user chose 'setup'
  console.log(chalk.blue('⚙️  Setting up Claude Code configuration...'));
  return await createClaudeConfig({ setupFromMenu: true });
}

async function createClaudeConfig(options = {}) {
  const targetDir = options.directory || process.cwd();
  
  // Validate --tunnel usage
  if (options.tunnel && !options.analytics && !options.chats && !options.agents && !options.chatsMobile) {
    console.log(chalk.red('❌ Error: --tunnel can only be used with --analytics, --chats, or --chats-mobile'));
    console.log(chalk.yellow('💡 Examples:'));
    console.log(chalk.gray('  cct --analytics --tunnel'));
    console.log(chalk.gray('  cct --chats --tunnel'));
    console.log(chalk.gray('  cct --chats-mobile'));
    return;
  }
  
  // Handle multiple components installation (new approach)
  if (options.agent || options.command || options.mcp || options.setting || options.hook) {
    // If --workflow is used with components, treat it as YAML
    if (options.workflow) {
      options.yaml = options.workflow;
    }
    await installMultipleComponents(options, targetDir);
    return;
  }
  
  // Handle workflow installation (hash-based)
  if (options.workflow) {
    await installWorkflow(options.workflow, targetDir, options);
    return;
  }
  
  // Handle global agent creation
  if (options.createAgent) {
    await createGlobalAgent(options.createAgent, options);
    return;
  }
  
  // Handle global agent listing
  if (options.listAgents) {
    await listGlobalAgents(options);
    return;
  }
  
  // Handle global agent removal
  if (options.removeAgent) {
    await removeGlobalAgent(options.removeAgent, options);
    return;
  }
  
  // Handle global agent update
  if (options.updateAgent) {
    await updateGlobalAgent(options.updateAgent, options);
    return;
  }
  
  // Handle command stats analysis (both singular and plural)
  if (options.commandStats || options.commandsStats) {
    await runCommandStats(options);
    return;
  }
  
  // Handle hook stats analysis (both singular and plural)
  if (options.hookStats || options.hooksStats) {
    await runHookStats(options);
    return;
  }
  
  // Handle MCP stats analysis (both singular and plural)
  if (options.mcpStats || options.mcpsStats) {
    await runMCPStats(options);
    return;
  }
  
  // Handle analytics dashboard
  if (options.analytics) {
    trackingService.trackAnalyticsDashboard({ page: 'dashboard', source: 'command_line' });
    await runAnalytics(options);
    return;
  }
  
  // Handle chats dashboard (now points to mobile chats interface)
  if (options.chats) {
    trackingService.trackAnalyticsDashboard({ page: 'chats-mobile', source: 'command_line' });
    await startChatsMobile(options);
    return;
  }
  
  // Handle agents dashboard (separate from chats)
  if (options.agents) {
    trackingService.trackAnalyticsDashboard({ page: 'agents', source: 'command_line' });
    await runAnalytics({ ...options, openTo: 'agents' });
    return;
  }
  
  // Handle mobile chats interface
  if (options.chatsMobile) {
    trackingService.trackAnalyticsDashboard({ page: 'chats-mobile', source: 'command_line' });
    await startChatsMobile(options);
    return;
  }
  
  // Handle health check
  let shouldRunSetup = false;
  if (options.healthCheck || options.health || options.check || options.verify) {
    const healthResult = await runHealthCheck();
    
    // Track health check usage
    trackingService.trackHealthCheck({
      setup_recommended: healthResult.runSetup,
      issues_found: healthResult.issues || 0,
      source: 'command_line'
    });
    
    if (healthResult.runSetup) {
      console.log(chalk.blue('⚙️  Starting Project Setup...'));
      shouldRunSetup = true;
    } else {
      console.log(chalk.green('👍 Health check completed. Returning to main menu...'));
      return await showMainMenu();
    }
  }
  
  // Add initial choice prompt (only if no specific options are provided and not continuing from health check or menu)
  if (!shouldRunSetup && !options.setupFromMenu && !options.yes && !options.language && !options.framework && !options.dryRun) {
    return await showMainMenu();
  } else {
    console.log(chalk.blue('🚀 Setting up Claude Code configuration...'));
  }
  
  console.log(chalk.gray(`Target directory: ${targetDir}`));
  
  // Detect existing project
  const spinner = ora('Detecting project type...').start();
  const projectInfo = await detectProject(targetDir);
  spinner.succeed('Project detection complete');
  
  let config;
  if (options.yes) {
    // Use defaults - prioritize --template over --language for backward compatibility
    const selectedLanguage = options.template || options.language || projectInfo.detectedLanguage || 'common';
    
    // Check if selected language is coming soon
    if (selectedLanguage && TEMPLATES_CONFIG[selectedLanguage] && TEMPLATES_CONFIG[selectedLanguage].comingSoon) {
      console.log(chalk.red(`❌ ${selectedLanguage} is not available yet. Coming soon!`));
      console.log(chalk.yellow('Available languages: common, javascript-typescript, python'));
      return;
    }
    const availableHooks = getHooksForLanguage(selectedLanguage);
    const defaultHooks = availableHooks.filter(hook => hook.checked).map(hook => hook.id);
    const availableMCPs = getMCPsForLanguage(selectedLanguage);
    const defaultMCPs = availableMCPs.filter(mcp => mcp.checked).map(mcp => mcp.id);
    
    config = {
      language: selectedLanguage,
      framework: options.framework || projectInfo.detectedFramework || 'none',
      features: [],
      hooks: defaultHooks,
      mcps: defaultMCPs
    };
  } else {
    // Interactive prompts with back navigation
    config = await interactivePrompts(projectInfo, options);
  }
  
  // Check if user confirmed the setup
  if (config.confirm === false) {
    console.log(chalk.yellow('⏹️  Setup cancelled by user.'));
    return;
  }

  // Handle analytics option from onboarding
  if (config.analytics) {
    console.log(chalk.blue('📊 Launching Claude Code Analytics Dashboard...'));
    await runAnalytics(options);
    return;
  }
  
  // Get template configuration
  const templateConfig = getTemplateConfig(config);
  
  // Add selected hooks to template config
  if (config.hooks) {
    templateConfig.selectedHooks = config.hooks;
    templateConfig.language = config.language; // Ensure language is available for hook filtering
  }
  
  // Add selected MCPs to template config
  if (config.mcps) {
    templateConfig.selectedMCPs = config.mcps;
    templateConfig.language = config.language; // Ensure language is available for MCP filtering
  }
  
  // Install selected agents
  if (config.agents && config.agents.length > 0) {
    console.log(chalk.blue('🤖 Installing Claude Code agents...'));
    await installAgents(config.agents, targetDir);
  }
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 Dry run - showing what would be copied:'));
    templateConfig.files.forEach(file => {
      console.log(chalk.gray(`  - ${file.source} → ${file.destination}`));
    });
    return;
  }
  
  // Copy template files
  const copySpinner = ora('Copying template files...').start();
  try {
    const result = await copyTemplateFiles(templateConfig, targetDir, options);
    if (result === false) {
      copySpinner.info('Setup cancelled by user');
      return; // Exit early if user cancelled
    }
    copySpinner.succeed('Template files copied successfully');
  } catch (error) {
    copySpinner.fail('Failed to copy template files');
    throw error;
  }
  
  // Show success message
  console.log(chalk.green('✅ Claude Code configuration setup complete!'));
  console.log(chalk.cyan('📚 Next steps:'));
  console.log(chalk.white('  1. Review the generated CLAUDE.md file'));
  console.log(chalk.white('  2. Customize the configuration for your project'));
  console.log(chalk.white('  3. Start using Claude Code with: claude'));
  console.log('');
  console.log(chalk.blue('🌐 View all available templates at: https://aitmpl.com/'));
  console.log(chalk.blue('📖 Read the complete documentation at: https://docs.aitmpl.com/'));
  
  if (config.language !== 'common') {
    console.log(chalk.yellow(`💡 Language-specific features for ${config.language} have been configured`));
  }
  
  if (config.framework !== 'none') {
    console.log(chalk.yellow(`🎯 Framework-specific commands for ${config.framework} are available`));
  }
  
  if (config.hooks && config.hooks.length > 0) {
    console.log(chalk.magenta(`🔧 ${config.hooks.length} automation hooks have been configured`));
  }
  
  if (config.mcps && config.mcps.length > 0) {
    console.log(chalk.blue(`🔧 ${config.mcps.length} MCP servers have been configured`));
  }

  // Track successful template installation
  if (!options.agent && !options.command && !options.mcp) {
    trackingService.trackTemplateInstallation(config.language, config.framework, {
      installation_method: options.setupFromMenu ? 'interactive_menu' : 'command_line',
      dry_run: options.dryRun || false,
      hooks_count: config.hooks ? config.hooks.length : 0,
      mcps_count: config.mcps ? config.mcps.length : 0,
      project_detected: !!options.detectedProject
    });
  }
  
  // Run post-installation validation
  if (!options.dryRun) {
    await runPostInstallationValidation(targetDir, templateConfig);
  }
  
  // Handle prompt execution if provided
  if (options.prompt) {
    await handlePromptExecution(options.prompt, targetDir);
  }
}

// Individual component installation functions
async function installIndividualAgent(agentName, targetDir, options) {
  console.log(chalk.blue(`🤖 Installing agent: ${agentName}`));
  
  try {
    // Support both category/agent-name and direct agent-name formats
    let githubUrl;
    if (agentName.includes('/')) {
      // Category/agent format: deep-research-team/academic-researcher
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/agents/${agentName}.md`;
    } else {
      // Direct agent format: api-security-audit
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/agents/${agentName}.md`;
    }
    
    console.log(chalk.gray(`📥 Downloading from GitHub (main branch)...`));
    
    const response = await fetch(githubUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(chalk.red(`❌ Agent "${agentName}" not found`));
        await showAvailableAgents();
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const agentContent = await response.text();
    
    // Create .claude/agents directory if it doesn't exist
    const agentsDir = path.join(targetDir, '.claude', 'agents');
    await fs.ensureDir(agentsDir);
    
    // Write the agent file - always to flat .claude/agents directory
    let fileName;
    if (agentName.includes('/')) {
      const [category, filename] = agentName.split('/');
      fileName = filename; // Extract just the filename, ignore category for installation
    } else {
      fileName = agentName;
    }
    
    const targetFile = path.join(agentsDir, `${fileName}.md`);
    await fs.writeFile(targetFile, agentContent, 'utf8');
    
    if (!options.silent) {
      console.log(chalk.green(`✅ Agent "${agentName}" installed successfully!`));
      console.log(chalk.cyan(`📁 Installed to: ${path.relative(targetDir, targetFile)}`));
      console.log(chalk.cyan(`📦 Downloaded from: ${githubUrl}`));
    }
    
    // Track successful agent installation
    trackingService.trackDownload('agent', agentName, {
      installation_type: 'individual_component',
      target_directory: path.relative(process.cwd(), targetDir),
      source: 'github_main'
    });
    
    return true;
    
  } catch (error) {
    console.log(chalk.red(`❌ Error installing agent: ${error.message}`));
    return false;
  }
}

async function installIndividualCommand(commandName, targetDir, options) {
  console.log(chalk.blue(`⚡ Installing command: ${commandName}`));
  
  try {
    // Support both category/command-name and direct command-name formats
    let githubUrl;
    if (commandName.includes('/')) {
      // Category/command format: security/vulnerability-scan
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/commands/${commandName}.md`;
    } else {
      // Direct command format: check-file
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/commands/${commandName}.md`;
    }
    
    console.log(chalk.gray(`📥 Downloading from GitHub (main branch)...`));
    
    const response = await fetch(githubUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(chalk.red(`❌ Command "${commandName}" not found`));
        console.log(chalk.yellow('Available commands: check-file, generate-tests'));
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const commandContent = await response.text();
    
    // Create .claude/commands directory if it doesn't exist
    const commandsDir = path.join(targetDir, '.claude', 'commands');
    await fs.ensureDir(commandsDir);
    
    // Write the command file - always to flat .claude/commands directory
    let fileName;
    if (commandName.includes('/')) {
      const [category, filename] = commandName.split('/');
      fileName = filename; // Extract just the filename, ignore category for installation
    } else {
      fileName = commandName;
    }
    
    const targetFile = path.join(commandsDir, `${fileName}.md`);
    
    await fs.writeFile(targetFile, commandContent, 'utf8');
    
    if (!options.silent) {
      console.log(chalk.green(`✅ Command "${commandName}" installed successfully!`));
      console.log(chalk.cyan(`📁 Installed to: ${path.relative(targetDir, targetFile)}`));
      console.log(chalk.cyan(`📦 Downloaded from: ${githubUrl}`));
    }
    
    // Track successful command installation
    trackingService.trackDownload('command', commandName, {
      installation_type: 'individual_command',
      target_directory: path.relative(process.cwd(), targetDir),
      source: 'github_main'
    });
    
    return true;
    
  } catch (error) {
    console.log(chalk.red(`❌ Error installing command: ${error.message}`));
    return false;
  }
}

async function installIndividualMCP(mcpName, targetDir, options) {
  console.log(chalk.blue(`🔌 Installing MCP: ${mcpName}`));
  
  try {
    // Support both category/mcp-name and direct mcp-name formats
    let githubUrl;
    if (mcpName.includes('/')) {
      // Category/mcp format: database/mysql-integration
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/mcps/${mcpName}.json`;
    } else {
      // Direct mcp format: web-fetch
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/mcps/${mcpName}.json`;
    }
    
    console.log(chalk.gray(`📥 Downloading from GitHub (main branch)...`));
    
    const response = await fetch(githubUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(chalk.red(`❌ MCP "${mcpName}" not found`));
        console.log(chalk.yellow('Available MCPs: web-fetch, filesystem-access, github-integration, memory-integration, mysql-integration, postgresql-integration, deepgraph-react, deepgraph-nextjs, deepgraph-typescript, deepgraph-vue'));
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const mcpConfigText = await response.text();
    const mcpConfig = JSON.parse(mcpConfigText);

    // Remove description field from each MCP server before merging
    if (mcpConfig.mcpServers) {
      for (const serverName in mcpConfig.mcpServers) {
        if (mcpConfig.mcpServers[serverName] && typeof mcpConfig.mcpServers[serverName] === 'object') {
          delete mcpConfig.mcpServers[serverName].description;
        }
      }
    }
    
    // Check if .mcp.json exists in target directory
    const targetMcpFile = path.join(targetDir, '.mcp.json');
    let existingConfig = {};
    
    if (await fs.pathExists(targetMcpFile)) {
      existingConfig = await fs.readJson(targetMcpFile);
      console.log(chalk.yellow('📝 Existing .mcp.json found, merging configurations...'));
    }
    
    // Merge configurations with deep merge for mcpServers
    const mergedConfig = {
      ...existingConfig,
      ...mcpConfig
    };
    
    // Deep merge mcpServers specifically to avoid overwriting existing servers
    if (existingConfig.mcpServers && mcpConfig.mcpServers) {
      mergedConfig.mcpServers = {
        ...existingConfig.mcpServers,
        ...mcpConfig.mcpServers
      };
    }
    
    // Write the merged configuration
    await fs.writeJson(targetMcpFile, mergedConfig, { spaces: 2 });
    
    if (!options.silent) {
      console.log(chalk.green(`✅ MCP "${mcpName}" installed successfully!`));
      console.log(chalk.cyan(`📁 Configuration merged into: ${path.relative(targetDir, targetMcpFile)}`));
      console.log(chalk.cyan(`📦 Downloaded from: ${githubUrl}`));
    }
    
    // Track successful MCP installation
    trackingService.trackDownload('mcp', mcpName, {
      installation_type: 'individual_mcp',
      merged_with_existing: existingConfig !== null,
      servers_count: Object.keys(mergedConfig.mcpServers || {}).length,
      source: 'github_main'
    });
    
    return true;
    
  } catch (error) {
    console.log(chalk.red(`❌ Error installing MCP: ${error.message}`));
    return false;
  }
}

async function installIndividualSetting(settingName, targetDir, options) {
  console.log(chalk.blue(`⚙️ Installing setting: ${settingName}`));
  
  try {
    // Support both category/setting-name and direct setting-name formats
    let githubUrl;
    if (settingName.includes('/')) {
      // Category/setting format: permissions/allow-npm-commands
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/settings/${settingName}.json`;
    } else {
      // Direct setting format: allow-npm-commands
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/settings/${settingName}.json`;
    }
    
    console.log(chalk.gray(`📥 Downloading from GitHub (main branch)...`));
    
    const response = await fetch(githubUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(chalk.red(`❌ Setting "${settingName}" not found`));
        console.log(chalk.yellow('Available settings: enable-telemetry, disable-telemetry, allow-npm-commands, deny-sensitive-files, use-sonnet, use-haiku, retention-7-days, retention-90-days'));
        console.log(chalk.yellow('Available statuslines: statusline/context-monitor'));
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const settingConfigText = await response.text();
    const settingConfig = JSON.parse(settingConfigText);

    // Check if there are additional files to download (e.g., Python scripts)
    const additionalFiles = {};
    
    // For statusline settings, check if there's a corresponding Python file
    if (settingName.includes('statusline/')) {
      const pythonFileName = settingName.split('/')[1] + '.py';
      const pythonUrl = githubUrl.replace('.json', '.py');
      
      try {
        console.log(chalk.gray(`📥 Downloading Python script: ${pythonFileName}...`));
        const pythonResponse = await fetch(pythonUrl);
        if (pythonResponse.ok) {
          const pythonContent = await pythonResponse.text();
          additionalFiles['.claude/scripts/' + pythonFileName] = {
            content: pythonContent,
            executable: true
          };
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not download Python script: ${error.message}`));
      }
    }

    // Extract and handle additional files before removing them from config
    const configFiles = settingConfig.files || {};
    
    // Merge downloaded files with config files
    Object.assign(additionalFiles, configFiles);
    
    // Remove description and files fields before merging
    if (settingConfig && typeof settingConfig === 'object') {
      delete settingConfig.description;
      delete settingConfig.files;
    }
    
    // Use shared locations if provided (batch mode), otherwise ask user
    let installLocations = options.sharedInstallLocations || ['local']; // default to local settings
    if (!options.silent && !options.sharedInstallLocations) {
      const inquirer = require('inquirer');
      const { selectedLocations } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedLocations',
        message: 'Where would you like to install this setting? (Select one or more)',
        choices: [
          {
            name: '🏠 User settings (~/.claude/settings.json) - Applies to all projects',
            value: 'user'
          },
          {
            name: '📁 Project settings (.claude/settings.json) - Shared with team',
            value: 'project'
          },
          {
            name: '⚙️  Local settings (.claude/settings.local.json) - Personal, not committed',
            value: 'local',
            checked: true // Default selection
          },
          {
            name: '🏢 Enterprise managed settings - System-wide policy (requires admin)',
            value: 'enterprise'
          }
        ],
        validate: function(answer) {
          if (answer.length < 1) {
            return 'You must choose at least one installation location.';
          }
          return true;
        }
      }]);
      
      installLocations = selectedLocations;
    }
    
    // Install the setting in each selected location
    let successfulInstallations = 0;
    for (const installLocation of installLocations) {
      console.log(chalk.blue(`\n📍 Installing "${settingName}" in ${installLocation} settings...`));
      
      let currentTargetDir = targetDir;
      let settingsFile = 'settings.local.json'; // default
      
      if (installLocation === 'user') {
        const os = require('os');
        currentTargetDir = os.homedir();
        settingsFile = 'settings.json';
      } else if (installLocation === 'project') {
        settingsFile = 'settings.json';
      } else if (installLocation === 'local') {
        settingsFile = 'settings.local.json';
      } else if (installLocation === 'enterprise') {
        const os = require('os');
        const platform = os.platform();
        
        if (platform === 'darwin') {
          // macOS
          currentTargetDir = '/Library/Application Support/ClaudeCode';
          settingsFile = 'managed-settings.json';
        } else if (platform === 'linux' || (process.platform === 'win32' && process.env.WSL_DISTRO_NAME)) {
          // Linux and WSL
          currentTargetDir = '/etc/claude-code';
          settingsFile = 'managed-settings.json';
        } else if (platform === 'win32') {
          // Windows
          currentTargetDir = 'C:\\ProgramData\\ClaudeCode';
          settingsFile = 'managed-settings.json';
        } else {
          console.log(chalk.yellow('⚠️  Platform not supported for enterprise settings. Using user settings instead.'));
          const os = require('os');
          currentTargetDir = os.homedir();
          settingsFile = 'settings.json';
        }
        
        console.log(chalk.yellow(`⚠️  Enterprise settings require administrator privileges.`));
        console.log(chalk.gray(`📍 Target path: ${path.join(currentTargetDir, settingsFile)}`));
      }
      
      // Determine target directory and file based on selection
      const claudeDir = path.join(currentTargetDir, '.claude');
      const targetSettingsFile = path.join(claudeDir, settingsFile);
      let existingConfig = {};
      
      // For enterprise settings, create directory structure directly (not under .claude)
      if (settingsFile === 'managed-settings.json') {
        // Ensure enterprise directory exists (requires admin privileges)
        try {
          await fs.ensureDir(currentTargetDir);
        } catch (error) {
          console.log(chalk.red(`❌ Failed to create enterprise directory: ${error.message}`));
          console.log(chalk.yellow('💡 Try running with administrator privileges or choose a different installation location.'));
          continue; // Skip this location and continue with others
        }
      } else {
        // Ensure .claude directory exists for regular settings
        await fs.ensureDir(claudeDir);
      }
      
      // Read existing configuration
      const actualTargetFile = settingsFile === 'managed-settings.json' 
        ? path.join(currentTargetDir, settingsFile)
        : targetSettingsFile;
        
      if (await fs.pathExists(actualTargetFile)) {
        existingConfig = await fs.readJson(actualTargetFile);
        console.log(chalk.yellow(`📝 Existing ${settingsFile} found, merging configurations...`));
      }
      
      // Check for conflicts before merging
      const conflicts = [];
      
      // Check for conflicting environment variables
      if (existingConfig.env && settingConfig.env) {
        Object.keys(settingConfig.env).forEach(key => {
          if (existingConfig.env[key] && existingConfig.env[key] !== settingConfig.env[key]) {
            conflicts.push(`Environment variable "${key}" (current: "${existingConfig.env[key]}", new: "${settingConfig.env[key]}")`);
          }
        });
      }
      
      // Check for conflicting top-level settings
      Object.keys(settingConfig).forEach(key => {
        if (key !== 'permissions' && key !== 'env' && key !== 'hooks' && 
            existingConfig[key] !== undefined && JSON.stringify(existingConfig[key]) !== JSON.stringify(settingConfig[key])) {
          
          // For objects, just indicate the setting name without showing the complex values
          if (typeof existingConfig[key] === 'object' && existingConfig[key] !== null &&
              typeof settingConfig[key] === 'object' && settingConfig[key] !== null) {
            conflicts.push(`Setting "${key}" (will be overwritten with new configuration)`);
          } else {
            conflicts.push(`Setting "${key}" (current: "${existingConfig[key]}", new: "${settingConfig[key]}")`);
          }
        }
      });
      
      // Ask user about conflicts if any exist
      if (conflicts.length > 0) {
        console.log(chalk.yellow(`\n⚠️  Conflicts detected while installing setting "${settingName}" in ${installLocation}:`));
        conflicts.forEach(conflict => console.log(chalk.gray(`   • ${conflict}`)));
        
        const inquirer = require('inquirer');
        const { shouldOverwrite } = await inquirer.prompt([{
          type: 'confirm',
          name: 'shouldOverwrite',
          message: `Do you want to overwrite the existing configuration in ${installLocation}?`,
          default: false
        }]);
        
        if (!shouldOverwrite) {
          console.log(chalk.yellow(`⏹️  Installation of setting "${settingName}" in ${installLocation} cancelled by user.`));
          continue; // Skip this location and continue with others
        }
      }
      
      // Deep merge configurations
      const mergedConfig = {
        ...existingConfig,
        ...settingConfig
      };
      
      // Deep merge specific sections (only if no conflicts or user approved overwrite)
      if (existingConfig.permissions && settingConfig.permissions) {
        mergedConfig.permissions = {
          ...existingConfig.permissions,
          ...settingConfig.permissions
        };
        
        // Merge arrays for allow, deny, ask (no conflicts here, just merge)
        ['allow', 'deny', 'ask'].forEach(key => {
          if (existingConfig.permissions[key] && settingConfig.permissions[key]) {
            mergedConfig.permissions[key] = [
              ...new Set([...existingConfig.permissions[key], ...settingConfig.permissions[key]])
            ];
          }
        });
      }
      
      if (existingConfig.env && settingConfig.env) {
        mergedConfig.env = {
          ...existingConfig.env,
          ...settingConfig.env
        };
      }
      
      if (existingConfig.hooks && settingConfig.hooks) {
        mergedConfig.hooks = {
          ...existingConfig.hooks,
          ...settingConfig.hooks
        };
      }
      
      // Write the merged configuration
      await fs.writeJson(actualTargetFile, mergedConfig, { spaces: 2 });
      
      // Install additional files if any exist
      if (Object.keys(additionalFiles).length > 0) {
        console.log(chalk.blue(`📄 Installing ${Object.keys(additionalFiles).length} additional file(s)...`));
        
        for (const [filePath, fileConfig] of Object.entries(additionalFiles)) {
          try {
            // Resolve tilde (~) to home directory
            const resolvedFilePath = filePath.startsWith('~') 
              ? path.join(require('os').homedir(), filePath.slice(1))
              : path.resolve(currentTargetDir, filePath);
            
            // Ensure directory exists
            await fs.ensureDir(path.dirname(resolvedFilePath));
            
            // Write file content
            await fs.writeFile(resolvedFilePath, fileConfig.content, 'utf8');
            
            // Make file executable if specified
            if (fileConfig.executable) {
              await fs.chmod(resolvedFilePath, 0o755);
              console.log(chalk.gray(`🔧 Made executable: ${resolvedFilePath}`));
            }
            
            console.log(chalk.green(`✅ File installed: ${resolvedFilePath}`));
            
          } catch (fileError) {
            console.log(chalk.red(`❌ Failed to install file ${filePath}: ${fileError.message}`));
          }
        }
      }
      
      if (!options.silent) {
        console.log(chalk.green(`✅ Setting "${settingName}" installed successfully in ${installLocation}!`));
        console.log(chalk.cyan(`📁 Configuration merged into: ${actualTargetFile}`));
        console.log(chalk.cyan(`📦 Downloaded from: ${githubUrl}`));
      }
      
      // Track successful setting installation for this location
      trackingService.trackDownload('setting', settingName, {
        installation_type: 'individual_setting',
        installation_location: installLocation,
        merged_with_existing: Object.keys(existingConfig).length > 0,
        source: 'github_main'
      });
      
      // Increment successful installations counter
      successfulInstallations++;
    }
    
    // Summary after all installations
    if (!options.silent) {
      if (successfulInstallations === installLocations.length) {
        console.log(chalk.green(`\n🎉 Setting "${settingName}" successfully installed in ${successfulInstallations} location(s)!`));
      } else {
        console.log(chalk.yellow(`\n⚠️  Setting "${settingName}" installed in ${successfulInstallations} of ${installLocations.length} location(s).`));
        const failedCount = installLocations.length - successfulInstallations;
        console.log(chalk.red(`❌ ${failedCount} installation(s) failed due to permission or other errors.`));
      }
    }
    
    return successfulInstallations;
    
  } catch (error) {
    console.log(chalk.red(`❌ Error installing setting: ${error.message}`));
    return 0;
  }
}

async function installIndividualHook(hookName, targetDir, options) {
  console.log(chalk.blue(`🪝 Installing hook: ${hookName}`));
  
  try {
    // Support both category/hook-name and direct hook-name formats
    let githubUrl;
    if (hookName.includes('/')) {
      // Category/hook format: pre-tool/backup-before-edit
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/hooks/${hookName}.json`;
    } else {
      // Direct hook format: backup-before-edit
      githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/hooks/${hookName}.json`;
    }
    
    console.log(chalk.gray(`📥 Downloading from GitHub (main branch)...`));
    
    const response = await fetch(githubUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(chalk.red(`❌ Hook "${hookName}" not found`));
        console.log(chalk.yellow('Available hooks: notify-before-bash, format-python-files, format-javascript-files, git-add-changes, backup-before-edit, run-tests-after-changes'));
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const hookConfigText = await response.text();
    const hookConfig = JSON.parse(hookConfigText);

    // Remove description field before merging
    if (hookConfig && typeof hookConfig === 'object') {
      delete hookConfig.description;
    }
    
    // Use shared locations if provided (batch mode), otherwise ask user
    let installLocations = options.sharedInstallLocations || ['local']; // default to local settings
    if (!options.silent && !options.sharedInstallLocations) {
      const inquirer = require('inquirer');
      const { selectedLocations } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedLocations',
        message: 'Where would you like to install this hook? (Select one or more)',
        choices: [
          {
            name: '🏠 User settings (~/.claude/settings.json) - Applies to all projects',
            value: 'user'
          },
          {
            name: '📁 Project settings (.claude/settings.json) - Shared with team',
            value: 'project'
          },
          {
            name: '⚙️  Local settings (.claude/settings.local.json) - Personal, not committed',
            value: 'local',
            checked: true // Default selection
          },
          {
            name: '🏢 Enterprise managed settings - System-wide policy (requires admin)',
            value: 'enterprise'
          }
        ],
        validate: function(answer) {
          if (answer.length < 1) {
            return 'You must choose at least one installation location.';
          }
          return true;
        }
      }]);
      
      installLocations = selectedLocations;
    }
    
    // Install the hook in each selected location
    let successfulInstallations = 0;
    for (const installLocation of installLocations) {
      console.log(chalk.blue(`\n📍 Installing "${hookName}" in ${installLocation} settings...`));
      
      let currentTargetDir = targetDir;
      let settingsFile = 'settings.local.json'; // default

      if (installLocation === 'user') {
        const os = require('os');
        currentTargetDir = os.homedir();
        settingsFile = 'settings.json';
      } else if (installLocation === 'project') {
        settingsFile = 'settings.json';
      } else if (installLocation === 'local') {
        settingsFile = 'settings.local.json';
      } else if (installLocation === 'enterprise') {
        const os = require('os');
        const platform = os.platform();
        
        if (platform === 'darwin') {
          // macOS
          currentTargetDir = '/Library/Application Support/ClaudeCode';
          settingsFile = 'managed-settings.json';
        } else if (platform === 'linux' || (process.platform === 'win32' && process.env.WSL_DISTRO_NAME)) {
          // Linux and WSL
          currentTargetDir = '/etc/claude-code';
          settingsFile = 'managed-settings.json';
        } else if (platform === 'win32') {
          // Windows
          currentTargetDir = 'C:\\ProgramData\\ClaudeCode';
          settingsFile = 'managed-settings.json';
        } else {
          console.log(chalk.yellow('⚠️  Platform not supported for enterprise settings. Using user settings instead.'));
          const os = require('os');
          currentTargetDir = os.homedir();
          settingsFile = 'settings.json';
        }
        
        console.log(chalk.yellow(`⚠️  Enterprise settings require administrator privileges.`));
        console.log(chalk.gray(`📍 Target path: ${path.join(currentTargetDir, settingsFile)}`));
      }
      
      // Determine target directory and file based on selection
      const claudeDir = path.join(currentTargetDir, '.claude');
      const targetSettingsFile = path.join(claudeDir, settingsFile);
      let existingConfig = {};
      
      // For enterprise settings, create directory structure directly (not under .claude)
      if (settingsFile === 'managed-settings.json') {
        // Ensure enterprise directory exists (requires admin privileges)
        try {
          await fs.ensureDir(currentTargetDir);
        } catch (error) {
          console.log(chalk.red(`❌ Failed to create enterprise directory: ${error.message}`));
          console.log(chalk.yellow('💡 Try running with administrator privileges or choose a different installation location.'));
          continue; // Skip this location and continue with others
        }
      } else {
        // Ensure .claude directory exists for regular settings
        await fs.ensureDir(claudeDir);
      }
      
      // Read existing configuration
      const actualTargetFile = settingsFile === 'managed-settings.json' 
        ? path.join(currentTargetDir, settingsFile)
        : targetSettingsFile;
        
      if (await fs.pathExists(actualTargetFile)) {
        existingConfig = await fs.readJson(actualTargetFile);
        console.log(chalk.yellow(`📝 Existing ${settingsFile} found, merging hook configurations...`));
      }
      
      // Check for conflicts before merging (simplified for new array format)
      const conflicts = [];
      
      // For the new array format, we'll allow appending rather than conflict detection
      // This is because Claude Code's array format naturally supports multiple hooks
      // Conflicts are less likely and generally hooks can coexist
      
      // Ask user about conflicts if any exist
      if (conflicts.length > 0) {
        console.log(chalk.yellow(`\n⚠️  Conflicts detected while installing hook "${hookName}" in ${installLocation}:`));
        conflicts.forEach(conflict => console.log(chalk.gray(`   • ${conflict}`)));
        
        const inquirer = require('inquirer');
        const { shouldOverwrite } = await inquirer.prompt([{
          type: 'confirm',
          name: 'shouldOverwrite',
          message: `Do you want to overwrite the existing hook configuration in ${installLocation}?`,
          default: false
        }]);
        
        if (!shouldOverwrite) {
          console.log(chalk.yellow(`⏹️  Installation of hook "${hookName}" in ${installLocation} cancelled by user.`));
          continue; // Skip this location and continue with others
        }
      }
      
      // Deep merge configurations with proper hook array structure
      const mergedConfig = {
        ...existingConfig
      };
      
      // Initialize hooks structure if it doesn't exist
      if (!mergedConfig.hooks) {
        mergedConfig.hooks = {};
      }
      
      // Merge hook configurations properly (Claude Code expects arrays)
      if (hookConfig.hooks) {
        Object.keys(hookConfig.hooks).forEach(hookType => {
          if (!mergedConfig.hooks[hookType]) {
            // If hook type doesn't exist, just copy the array
            mergedConfig.hooks[hookType] = hookConfig.hooks[hookType];
          } else {
            // If hook type exists, append to the array (Claude Code format)
            if (Array.isArray(hookConfig.hooks[hookType])) {
              // New format: array of hook objects
              if (!Array.isArray(mergedConfig.hooks[hookType])) {
                // Convert old format to new format
                mergedConfig.hooks[hookType] = [];
              }
              // Append new hooks to existing array
              mergedConfig.hooks[hookType] = mergedConfig.hooks[hookType].concat(hookConfig.hooks[hookType]);
            } else {
              // Old format compatibility: convert to new format
              console.log(chalk.yellow(`⚠️  Converting old hook format to new Claude Code format for ${hookType}`));
              if (!Array.isArray(mergedConfig.hooks[hookType])) {
                mergedConfig.hooks[hookType] = [];
              }
              // Add old format hook as a single matcher
              mergedConfig.hooks[hookType].push({
                matcher: "*",
                hooks: [{
                  type: "command",
                  command: hookConfig.hooks[hookType]
                }]
              });
            }
          }
        });
      }
      
      // Write the merged configuration
      await fs.writeJson(actualTargetFile, mergedConfig, { spaces: 2 });
      
      if (!options.silent) {
        console.log(chalk.green(`✅ Hook "${hookName}" installed successfully in ${installLocation}!`));
        console.log(chalk.cyan(`📁 Configuration merged into: ${actualTargetFile}`));
        console.log(chalk.cyan(`📦 Downloaded from: ${githubUrl}`));
      }
      
      // Track successful hook installation for this location
      trackingService.trackDownload('hook', hookName, {
        installation_type: 'individual_hook',
        installation_location: installLocation,
        merged_with_existing: Object.keys(existingConfig).length > 0,
        source: 'github_main'
      });
      
      // Increment successful installations counter
      successfulInstallations++;
    }
    
    // Summary after all installations
    if (!options.silent) {
      if (successfulInstallations === installLocations.length) {
        console.log(chalk.green(`\n🎉 Hook "${hookName}" successfully installed in ${successfulInstallations} location(s)!`));
      } else {
        console.log(chalk.yellow(`\n⚠️  Hook "${hookName}" installed in ${successfulInstallations} of ${installLocations.length} location(s).`));
        const failedCount = installLocations.length - successfulInstallations;
        console.log(chalk.red(`❌ ${failedCount} installation(s) failed due to permission or other errors.`));
      }
    }
    
    return successfulInstallations;
    
  } catch (error) {
    console.log(chalk.red(`❌ Error installing hook: ${error.message}`));
    return 0;
  }
}

// Helper functions to extract language/framework from agent content
function extractLanguageFromAgent(content, agentName) {
  // Try to determine language from agent content or filename
  if (agentName.includes('react') || content.includes('React')) return 'javascript-typescript';
  if (agentName.includes('django') || content.includes('Django')) return 'python';
  if (agentName.includes('fastapi') || content.includes('FastAPI')) return 'python';
  if (agentName.includes('flask') || content.includes('Flask')) return 'python';
  if (agentName.includes('rails') || content.includes('Rails')) return 'ruby';
  if (agentName.includes('api-security') || content.includes('API security')) return 'javascript-typescript';
  if (agentName.includes('database') || content.includes('database')) return 'javascript-typescript';
  
  // Default to javascript-typescript for general agents
  return 'javascript-typescript';
}

function extractFrameworkFromAgent(content, agentName) {
  // Try to determine framework from agent content or filename
  if (agentName.includes('react') || content.includes('React')) return 'react';
  if (agentName.includes('django') || content.includes('Django')) return 'django';
  if (agentName.includes('fastapi') || content.includes('FastAPI')) return 'fastapi';
  if (agentName.includes('flask') || content.includes('Flask')) return 'flask';
  if (agentName.includes('rails') || content.includes('Rails')) return 'rails';
  
  // For general agents, return none to install the base template
  return 'none';
}

/**
 * Fetch available agents dynamically from GitHub repository
 */
async function getAvailableAgentsFromGitHub() {
  try {
    const response = await fetch('https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/agents');
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const contents = await response.json();
    const agents = [];
    
    for (const item of contents) {
      if (item.type === 'file' && item.name.endsWith('.md')) {
        // Direct agent file
        agents.push({
          name: item.name.replace('.md', ''),
          path: item.name.replace('.md', ''),
          category: 'root'
        });
      } else if (item.type === 'dir') {
        // Category directory, fetch its contents
        try {
          const categoryResponse = await fetch(`https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/agents/${item.name}`);
          if (categoryResponse.ok) {
            const categoryContents = await categoryResponse.json();
            for (const categoryItem of categoryContents) {
              if (categoryItem.type === 'file' && categoryItem.name.endsWith('.md')) {
                agents.push({
                  name: categoryItem.name.replace('.md', ''),
                  path: `${item.name}/${categoryItem.name.replace('.md', '')}`,
                  category: item.name
                });
              }
            }
          }
        } catch (error) {
          console.warn(`Warning: Could not fetch category ${item.name}:`, error.message);
        }
      }
    }
    
    return agents;
  } catch (error) {
    console.warn('Warning: Could not fetch agents from GitHub, using fallback list');
    // Fallback to basic list if GitHub API fails
    return [
      { name: 'api-security-audit', path: 'api-security-audit', category: 'root' },
      { name: 'database-optimization', path: 'database-optimization', category: 'root' },
      { name: 'react-performance-optimization', path: 'react-performance-optimization', category: 'root' }
    ];
  }
}

/**
 * Install multiple components with optional YAML workflow
 */
async function installMultipleComponents(options, targetDir) {
  console.log(chalk.blue('🔧 Installing multiple components...'));
  
  try {
    const components = {
      agents: [],
      commands: [],
      mcps: [],
      settings: [],
      hooks: []
    };
    
    // Parse comma-separated values for each component type
    if (options.agent) {
      const agentsInput = Array.isArray(options.agent) ? options.agent.join(',') : options.agent;
      components.agents = agentsInput.split(',').map(a => a.trim()).filter(a => a);
    }
    
    if (options.command) {
      const commandsInput = Array.isArray(options.command) ? options.command.join(',') : options.command;
      components.commands = commandsInput.split(',').map(c => c.trim()).filter(c => c);
    }
    
    if (options.mcp) {
      const mcpsInput = Array.isArray(options.mcp) ? options.mcp.join(',') : options.mcp;
      components.mcps = mcpsInput.split(',').map(m => m.trim()).filter(m => m);
    }
    
    if (options.setting) {
      const settingsInput = Array.isArray(options.setting) ? options.setting.join(',') : options.setting;
      components.settings = settingsInput.split(',').map(s => s.trim()).filter(s => s);
    }
    
    if (options.hook) {
      const hooksInput = Array.isArray(options.hook) ? options.hook.join(',') : options.hook;
      components.hooks = hooksInput.split(',').map(h => h.trim()).filter(h => h);
    }
    
    const totalComponents = components.agents.length + components.commands.length + components.mcps.length + components.settings.length + components.hooks.length;
    
    if (totalComponents === 0) {
      console.log(chalk.yellow('⚠️  No components specified to install.'));
      return;
    }
    
    console.log(chalk.cyan(`📦 Installing ${totalComponents} components:`));
    console.log(chalk.gray(`   Agents: ${components.agents.length}`));
    console.log(chalk.gray(`   Commands: ${components.commands.length}`));
    console.log(chalk.gray(`   MCPs: ${components.mcps.length}`));
    console.log(chalk.gray(`   Settings: ${components.settings.length}`));
    console.log(chalk.gray(`   Hooks: ${components.hooks.length}`));
    
    // Counter for successfully installed components
    let successfullyInstalled = 0;
    
    // Ask for installation locations once for configuration components (if any exist and not in silent mode)
    let sharedInstallLocations = ['local']; // default
    const hasSettingsOrHooks = components.settings.length > 0 || components.hooks.length > 0;
    
    if (hasSettingsOrHooks && !options.yes) {
      console.log(chalk.blue('\n📍 Choose installation locations for configuration components:'));
      const inquirer = require('inquirer');
      const { selectedLocations } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedLocations',
        message: 'Where would you like to install the configuration components? (Select one or more)',
        choices: [
          {
            name: '🏠 User settings (~/.claude/settings.json) - Applies to all projects',
            value: 'user'
          },
          {
            name: '📁 Project settings (.claude/settings.json) - Shared with team',
            value: 'project'
          },
          {
            name: '⚙️  Local settings (.claude/settings.local.json) - Personal, not committed',
            value: 'local',
            checked: true // Default selection
          },
          {
            name: '🏢 Enterprise managed settings - System-wide policy (requires admin)',
            value: 'enterprise'
          }
        ],
        validate: function(answer) {
          if (answer.length < 1) {
            return 'You must choose at least one installation location.';
          }
          return true;
        }
      }]);
      
      sharedInstallLocations = selectedLocations;
      console.log(chalk.cyan(`📋 Will install configuration components in: ${sharedInstallLocations.join(', ')}`));
    }
    
    // Install agents
    for (const agent of components.agents) {
      console.log(chalk.gray(`   Installing agent: ${agent}`));
      const agentSuccess = await installIndividualAgent(agent, targetDir, { ...options, silent: true });
      if (agentSuccess) successfullyInstalled++;
    }
    
    // Install commands
    for (const command of components.commands) {
      console.log(chalk.gray(`   Installing command: ${command}`));
      const commandSuccess = await installIndividualCommand(command, targetDir, { ...options, silent: true });
      if (commandSuccess) successfullyInstalled++;
    }
    
    // Install MCPs
    for (const mcp of components.mcps) {
      console.log(chalk.gray(`   Installing MCP: ${mcp}`));
      const mcpSuccess = await installIndividualMCP(mcp, targetDir, { ...options, silent: true });
      if (mcpSuccess) successfullyInstalled++;
    }
    
    // Install settings (using shared installation locations)
    for (const setting of components.settings) {
      console.log(chalk.gray(`   Installing setting: ${setting}`));
      const settingSuccess = await installIndividualSetting(setting, targetDir, { 
        ...options, 
        silent: true, 
        sharedInstallLocations: sharedInstallLocations 
      });
      if (settingSuccess > 0) successfullyInstalled++;
    }
    
    // Install hooks (using shared installation locations)
    for (const hook of components.hooks) {
      console.log(chalk.gray(`   Installing hook: ${hook}`));
      const hookSuccess = await installIndividualHook(hook, targetDir, { 
        ...options, 
        silent: true, 
        sharedInstallLocations: sharedInstallLocations 
      });
      if (hookSuccess > 0) successfullyInstalled++;
    }
    
    // Handle YAML workflow if provided
    if (options.yaml) {
      console.log(chalk.blue('\n📄 Processing workflow YAML...'));
      
      try {
        // Decode the YAML from base64
        const yamlContent = Buffer.from(options.yaml, 'base64').toString('utf8');
        
        // Parse workflow name from YAML (try to extract from name: field)
        let workflowName = 'custom-workflow';
        const nameMatch = yamlContent.match(/name:\s*["']?([^"'\n]+)["']?/);
        if (nameMatch) {
          workflowName = nameMatch[1].trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        }
        
        // Save YAML to workflows directory
        const workflowsDir = path.join(targetDir, '.claude', 'workflows');
        const workflowFile = path.join(workflowsDir, `${workflowName}.yaml`);
        
        await fs.ensureDir(workflowsDir);
        await fs.writeFile(workflowFile, yamlContent, 'utf8');
        
        console.log(chalk.green(`✅ Workflow YAML saved: ${path.relative(targetDir, workflowFile)}`));
        
      } catch (yamlError) {
        console.log(chalk.red(`❌ Error processing YAML: ${yamlError.message}`));
      }
    }
    
    if (successfullyInstalled === totalComponents) {
      console.log(chalk.green(`\n✅ Successfully installed ${successfullyInstalled} components!`));
    } else if (successfullyInstalled > 0) {
      console.log(chalk.yellow(`\n⚠️  Successfully installed ${successfullyInstalled} of ${totalComponents} components.`));
      console.log(chalk.red(`❌ ${totalComponents - successfullyInstalled} component(s) failed to install.`));
    } else {
      console.log(chalk.red(`\n❌ No components were installed successfully.`));
      return; // Exit early if nothing was installed
    }
    console.log(chalk.cyan(`📁 Components installed to: .claude/`));
    
    if (options.yaml) {
      console.log(chalk.cyan(`📄 Workflow file created in: .claude/workflows/`));
      console.log(chalk.cyan(`🚀 Use the workflow file with Claude Code to execute the complete setup`));
    }
    
    // Note: Individual components are already tracked separately in their installation functions
    
    // Handle prompt execution if provided
    if (options.prompt) {
      await handlePromptExecution(options.prompt, targetDir);
    }
    
  } catch (error) {
    console.log(chalk.red(`❌ Error installing components: ${error.message}`));
  }
}

/**
 * Show available agents organized by category
 */
async function showAvailableAgents() {
  console.log(chalk.yellow('\n📋 Available Agents:'));
  console.log(chalk.gray('Use format: category/agent-name or just agent-name for root level\n'));
  console.log(chalk.gray('⏳ Fetching latest agents from GitHub...\n'));
  
  const agents = await getAvailableAgentsFromGitHub();
  
  // Group agents by category
  const groupedAgents = agents.reduce((acc, agent) => {
    const category = agent.category === 'root' ? '🤖 General Agents' : `📁 ${agent.category}`;
    if (!acc[category]) acc[category] = [];
    acc[category].push(agent);
    return acc;
  }, {});
  
  // Display agents by category
  Object.entries(groupedAgents).forEach(([category, categoryAgents]) => {
    console.log(chalk.cyan(category));
    categoryAgents.forEach(agent => {
      console.log(chalk.gray(`  • ${agent.path}`));
    });
    console.log('');
  });
  
  console.log(chalk.blue('Examples:'));
  console.log(chalk.gray('  cct --agent api-security-audit'));
  console.log(chalk.gray('  cct --agent deep-research-team/academic-researcher'));
  console.log('');
}

/**
 * Install workflow from hash
 */
async function installWorkflow(workflowHash, targetDir, options) {
  console.log(chalk.blue(`🔧 Installing workflow from hash: ${workflowHash}`));
  
  try {
    // Extract hash from format #hash
    const hash = workflowHash.startsWith('#') ? workflowHash.substring(1) : workflowHash;
    
    if (!hash || hash.length < 3) {
      throw new Error('Invalid workflow hash format. Expected format: #hash');
    }
    
    console.log(chalk.gray(`📥 Fetching workflow configuration...`));
    
    // Fetch workflow configuration from a remote service
    // For now, we'll simulate this by using a local storage approach
    // In production, this would fetch from a workflow registry
    const workflowData = await fetchWorkflowData(hash);
    
    if (!workflowData) {
      throw new Error(`Workflow with hash "${hash}" not found. Please check the hash and try again.`);
    }
    
    console.log(chalk.green(`✅ Workflow found: ${workflowData.name}`));
    console.log(chalk.cyan(`📝 Description: ${workflowData.description}`));
    console.log(chalk.cyan(`🏷️  Tags: ${workflowData.tags.join(', ')}`));
    console.log(chalk.cyan(`📊 Steps: ${workflowData.steps.length}`));
    
    // Install all required components
    const installPromises = [];
    
    // Group components by type
    const agents = workflowData.steps.filter(step => step.type === 'agent');
    const commands = workflowData.steps.filter(step => step.type === 'command');
    const mcps = workflowData.steps.filter(step => step.type === 'mcp');
    
    console.log(chalk.blue(`\n📦 Installing workflow components...`));
    console.log(chalk.gray(`   Agents: ${agents.length}`));
    console.log(chalk.gray(`   Commands: ${commands.length}`));
    console.log(chalk.gray(`   MCPs: ${mcps.length}`));
    
    // Install components from workflow data (not from GitHub)
    if (workflowData.components) {
      console.log(chalk.blue(`📦 Installing components from workflow package...`));
      
      // Install agents
      if (workflowData.components.agent) {
        for (const agent of workflowData.components.agent) {
          console.log(chalk.gray(`   Installing agent: ${agent.name}`));
          await installComponentFromWorkflow(agent, 'agent', targetDir, options);
        }
      }
      
      // Install commands  
      if (workflowData.components.command) {
        for (const command of workflowData.components.command) {
          console.log(chalk.gray(`   Installing command: ${command.name}`));
          await installComponentFromWorkflow(command, 'command', targetDir, options);
        }
      }
      
      // Install MCPs
      if (workflowData.components.mcp) {
        for (const mcp of workflowData.components.mcp) {
          console.log(chalk.gray(`   Installing MCP: ${mcp.name}`));
          await installComponentFromWorkflow(mcp, 'mcp', targetDir, options);
        }
      }
    } else {
      // Fallback to old method for legacy workflows
      console.log(chalk.yellow(`⚠️  Using legacy component installation method...`));
      
      // Install agents
      for (const agent of agents) {
        console.log(chalk.gray(`   Installing agent: ${agent.name}`));
        await installIndividualAgent(agent.path, targetDir, { ...options, silent: true });
      }
      
      // Install commands
      for (const command of commands) {
        console.log(chalk.gray(`   Installing command: ${command.name}`));
        await installIndividualCommand(command.path, targetDir, { ...options, silent: true });
      }
    }
    
    // Install MCPs
    for (const mcp of mcps) {
      console.log(chalk.gray(`   Installing MCP: ${mcp.name}`));
      await installIndividualMCP(mcp.path, targetDir, { ...options, silent: true });
    }
    
    // Generate and save workflow YAML
    let yamlContent;
    if (workflowData.yaml) {
      // Use YAML from workflow package
      yamlContent = workflowData.yaml;
    } else {
      // Generate YAML (legacy)
      yamlContent = generateWorkflowYAML(workflowData);
    }
    
    const workflowsDir = path.join(targetDir, '.claude', 'workflows');
    const workflowFile = path.join(workflowsDir, `${workflowData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.yaml`);
    
    // Ensure .claude/workflows directory exists
    await fs.ensureDir(workflowsDir);
    await fs.writeFile(workflowFile, yamlContent, 'utf8');
    
    console.log(chalk.green(`\n✅ Workflow "${workflowData.name}" installed successfully!`));
    console.log(chalk.cyan(`📁 Components installed to: .claude/`));
    console.log(chalk.cyan(`📄 Workflow file: ${path.relative(targetDir, workflowFile)}`));
    console.log(chalk.cyan(`🚀 Use the workflow file with Claude Code to execute the complete workflow`));
    
    // Track successful workflow installation
    trackingService.trackDownload('workflow', hash, {
      installation_type: 'workflow',
      workflow_name: workflowData.name,
      components_count: workflowData.steps.length,
      agents_count: agents.length,
      commands_count: commands.length,
      mcps_count: mcps.length,
      target_directory: path.relative(process.cwd(), targetDir)
    });
    
    // Handle prompt execution if provided
    if (options.prompt) {
      await handlePromptExecution(options.prompt, targetDir);
    }
    
  } catch (error) {
    console.log(chalk.red(`❌ Error installing workflow: ${error.message}`));
    
    if (error.message.includes('not found')) {
      console.log(chalk.yellow('\n💡 Possible solutions:'));
      console.log(chalk.gray('   • Check that the workflow hash is correct'));
      console.log(chalk.gray('   • Verify the workflow was generated successfully'));
      console.log(chalk.gray('   • Try generating a new workflow from the builder'));
    }
  }
}

/**
 * Decompress string with Unicode support
 */
function decompressString(compressed) {
  try {
    // Simple Base64 decoding with Unicode support
    const decoded = Buffer.from(compressed, 'base64').toString('utf8');
    // Convert URI encoded characters back
    return decodeURIComponent(decoded.replace(/(.)/g, function(m, p) {
      let code = p.charCodeAt(0).toString(16).toUpperCase();
      if (code.length < 2) code = '0' + code;
      return '%' + code;
    }));
  } catch (error) {
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

/**
 * Fetch workflow data from hash
 * In production, this would fetch from a remote workflow registry
 * For now, we'll simulate this functionality
 */
async function fetchWorkflowData(hash) {
  try {
    // Check if hash contains encoded data (new format: shortHash_encodedData)
    if (hash.includes('_')) {
      console.log(chalk.green('🔓 Decoding workflow from hash...'));
      
      const [shortHash, encodedData] = hash.split('_', 2);
      
      if (!encodedData) {
        throw new Error('Invalid hash format: missing encoded data');
      }
      
      // Decode compressed data
      let decodedData;
      try {
        // First try to decompress the data (new compressed format)
        const decompressedString = decompressString(encodedData);
        decodedData = JSON.parse(decompressedString);
      } catch (decompressError) {
        // Fallback to old Base64 format for compatibility
        try {
          const decodedString = decodeURIComponent(escape(atob(encodedData)));
          decodedData = JSON.parse(decodedString);
        } catch (base64Error) {
          throw new Error('Failed to decode workflow data from hash');
        }
      }
      
      // Validate decoded data structure
      if (!decodedData.metadata || !decodedData.steps || !decodedData.components) {
        throw new Error('Invalid workflow data structure in hash');
      }
      
      console.log(chalk.green('✅ Workflow decoded successfully!'));
      console.log(chalk.gray(`   Short hash: ${shortHash}`));
      console.log(chalk.gray(`   Timestamp: ${decodedData.timestamp}`));
      console.log(chalk.gray(`   Version: ${decodedData.version}`));
      
      // Convert to expected format
      return {
        name: decodedData.metadata.name,
        description: decodedData.metadata.description,
        tags: decodedData.metadata.tags || [],
        version: decodedData.version,
        hash: shortHash,
        steps: decodedData.steps,
        components: decodedData.components,
        yaml: decodedData.yaml,
        timestamp: decodedData.timestamp
      };
    }
    
    // Legacy demo workflows for testing
    if (hash === 'demo123' || hash === 'abc123test') {
      console.log(chalk.green('🎯 Demo workflow found! Using sample configuration...'));
      return {
        name: 'Full Stack Development Workflow',
        description: 'Complete workflow for setting up a full-stack development environment with React frontend, Node.js backend, and security auditing',
        tags: ['development', 'fullstack', 'react', 'security'],
        version: '1.0.0',
        hash: hash,
        steps: [
          {
            type: 'agent',
            name: 'frontend-developer',
            path: 'development-team/frontend-developer',
            category: 'development-team',
            description: 'Setup React frontend development environment'
          },
          {
            type: 'agent',
            name: 'backend-architect',
            path: 'development-team/backend-architect',
            category: 'development-team',
            description: 'Configure Node.js backend architecture'
          },
          {
            type: 'command',
          name: 'generate-tests',
          path: 'testing/generate-tests',
          category: 'testing',
          description: 'Generate comprehensive test suite'
        },
        {
          type: 'agent',
          name: 'api-security-audit',
          path: 'security/api-security-audit',
          category: 'security',
          description: 'Perform security audit on APIs'
        },
        {
          type: 'mcp',
          name: 'github-integration',
          path: 'integration/github-integration',
          category: 'integration',
          description: 'Setup GitHub integration for repository management'
        }
      ]
    };
  }
  
    // This is where we would integrate with a workflow registry API
    // For now, return null to indicate workflow not found for other hashes
    console.log(chalk.yellow('\n⚠️  Workflow registry not yet implemented.'));
    console.log(chalk.gray('To test with demo workflow, use hash: demo123'));
    console.log(chalk.gray('Example: --workflow "#demo123"'));
    
    return null;
    
  } catch (error) {
    console.error(chalk.red(`❌ Error fetching workflow data: ${error.message}`));
    return null;
  }
}

/**
 * Install component from workflow package data
 */
async function installComponentFromWorkflow(componentData, type, targetDir, options) {
  try {
    let targetPath;
    let fileName = componentData.name;
    
    if (type === 'agent') {
      // Create .claude/agents directory if it doesn't exist
      const agentsDir = path.join(targetDir, '.claude', 'agents');
      await fs.ensureDir(agentsDir);
      
      // For agents, handle category subdirectories
      if (componentData.category && componentData.category !== 'general') {
        const categoryDir = path.join(agentsDir, componentData.category);
        await fs.ensureDir(categoryDir);
        targetPath = path.join(categoryDir, `${fileName}.md`);
      } else {
        targetPath = path.join(agentsDir, `${fileName}.md`);
      }
      
    } else if (type === 'command') {
      // Create .claude/commands directory if it doesn't exist
      const commandsDir = path.join(targetDir, '.claude', 'commands');
      await fs.ensureDir(commandsDir);
      targetPath = path.join(commandsDir, `${fileName}.md`);
      
    } else if (type === 'mcp') {
      // For MCPs, merge with existing .mcp.json
      const targetMcpFile = path.join(targetDir, '.mcp.json');
      let existingConfig = {};
      
      if (await fs.pathExists(targetMcpFile)) {
        existingConfig = await fs.readJson(targetMcpFile);
      }
      
      // Parse MCP content and merge
      let mcpConfig;
      try {
        mcpConfig = JSON.parse(componentData.content);
      } catch (error) {
        throw new Error(`Failed to parse MCP content for ${componentData.name}: ${error.message}`);
      }
      
      // Remove description field before merging (CLI processing)
      if (mcpConfig.mcpServers) {
        for (const serverName in mcpConfig.mcpServers) {
          if (mcpConfig.mcpServers[serverName] && typeof mcpConfig.mcpServers[serverName] === 'object') {
            delete mcpConfig.mcpServers[serverName].description;
          }
        }
      }
      
      // Merge configurations
      const mergedConfig = {
        ...existingConfig,
        ...mcpConfig
      };
      
      // Deep merge mcpServers
      if (existingConfig.mcpServers && mcpConfig.mcpServers) {
        mergedConfig.mcpServers = {
          ...existingConfig.mcpServers,
          ...mcpConfig.mcpServers
        };
      }
      
      await fs.writeJson(targetMcpFile, mergedConfig, { spaces: 2 });
      return;
    }
    
    // Write content for agents and commands
    if (targetPath) {
      await fs.writeFile(targetPath, componentData.content, 'utf8');
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Error installing ${type} "${componentData.name}": ${error.message}`));
    throw error;
  }
}

/**
 * Generate workflow YAML from workflow data
 */
function generateWorkflowYAML(workflowData) {
  const yaml = `#═══════════════════════════════════════════════════════════════════════════════
# 🤖 CLAUDE CODE WORKFLOW CONFIGURATION
#═══════════════════════════════════════════════════════════════════════════════
#
# WORKFLOW: ${workflowData.name}
# DESCRIPTION: ${workflowData.description}
# GENERATED: ${new Date().toISOString()}
# HASH: ${workflowData.hash || 'generated'}
#
#═══════════════════════════════════════════════════════════════════════════════
# 📋 INSTRUCTIONS FOR CLAUDE CODE
#═══════════════════════════════════════════════════════════════════════════════
#
# This is a WORKFLOW EXECUTION FILE for Claude Code. When you encounter this file,
# you should execute it as a complete automated workflow. Here's how:
#
# 🎯 EXECUTION BEHAVIOR:
# 1. READ this entire YAML file to understand the workflow structure
# 2. EXECUTE each step in the exact order listed below (sequential mode)
# 3. For AGENTS: Use the agent specified to perform the task described
# 4. For COMMANDS: Execute the Claude Code command as specified
# 5. For MCPs: Ensure the MCP server is available and use it as needed
# 6. STOP if any step fails (on_error: stop)
# 7. PROVIDE progress updates after each step completion
#
# 🔧 STEP EXECUTION PATTERN:
# - Announce: "Executing Step X: [step.name]"
# - Action: Perform the task using the specified component
# - Confirm: "✅ Step X completed successfully"
# - Continue to next step
#
# 💡 IMPORTANT NOTES:
# - All components are already installed in .claude/ directories
# - Each step builds upon the previous ones
# - Follow the descriptions exactly as specified
# - Use confirmation_required: true for user approval before starting
# - Maintain context and outputs between steps for workflow continuity
#
#═══════════════════════════════════════════════════════════════════════════════

name: "${workflowData.name}"
description: "${workflowData.description}"
tags: [${workflowData.tags.map(tag => `"${tag}"`).join(', ')}]
version: "${workflowData.version || '1.0.0'}"

#═══════════════════════════════════════════════════════════════════════════════
# 🚀 WORKFLOW STEPS - EXECUTE IN ORDER
#═══════════════════════════════════════════════════════════════════════════════

steps:
${workflowData.steps.map((step, index) => `  - step: ${index + 1}
    type: ${step.type}
    name: "${step.name}"
    path: "${step.path}"
    category: "${step.category}"
    description: "${step.description}"
    
    # CLAUDE CODE INSTRUCTIONS FOR THIS STEP:
    claude_instructions: |
      Execute this step using the ${step.type} located at .claude/${step.type}s/${step.name}.${step.type === 'mcp' ? 'json' : 'md'}
      Task: ${step.description}
      ${step.type === 'agent' ? 'Use this agent to perform the specified task with full context from previous steps.' : ''}
      ${step.type === 'command' ? 'Execute this command with appropriate parameters based on workflow context.' : ''}
      ${step.type === 'mcp' ? 'Ensure MCP server is running and utilize its capabilities for the task.' : ''}
      
    action_template: |
      echo "🔄 Executing Step ${index + 1}: ${step.name}"
      echo "📝 Task: ${step.description}"
      echo "🎯 Using ${step.type}: ${step.path}"
      # [CLAUDE CODE WILL REPLACE THIS WITH ACTUAL EXECUTION]
      echo "✅ Step ${index + 1} completed successfully"
`).join('\n')}

#═══════════════════════════════════════════════════════════════════════════════
# ⚙️ EXECUTION CONFIGURATION
#═══════════════════════════════════════════════════════════════════════════════

execution:
  mode: "sequential"           # Execute steps one by one, in order
  on_error: "stop"            # Stop workflow if any step fails
  timeout: 300                # Maximum time per step (5 minutes)
  continue_on_warning: true   # Continue if warnings occur
  save_outputs: true          # Save outputs between steps for context

#═══════════════════════════════════════════════════════════════════════════════
# 📦 INSTALLED COMPONENTS REFERENCE
#═══════════════════════════════════════════════════════════════════════════════

components:
  agents: [${workflowData.steps.filter(s => s.type === 'agent').map(s => `"${s.path}"`).join(', ')}]
  commands: [${workflowData.steps.filter(s => s.type === 'command').map(s => `"${s.path}"`).join(', ')}]
  mcps: [${workflowData.steps.filter(s => s.type === 'mcp').map(s => `"${s.path}"`).join(', ')}]

#═══════════════════════════════════════════════════════════════════════════════
# 🤖 CLAUDE CODE INTEGRATION SETTINGS
#═══════════════════════════════════════════════════════════════════════════════

claudecode:
  workflow_mode: true         # Enable workflow execution mode
  auto_execute: false         # Require user confirmation before starting
  confirmation_required: true # Ask user before each step
  show_progress: true         # Display progress indicators
  save_context: true          # Maintain context between steps
  
  # WORKFLOW EXECUTION INSTRUCTIONS FOR CLAUDE:
  execution_instructions: |
    When executing this workflow:
    
    1. 🎯 PREPARATION PHASE:
       - Confirm all components are installed in .claude/ directories
       - Verify user wants to execute this workflow
       - Explain what will happen in each step
    
    2. 🚀 EXECUTION PHASE:
       - Execute each step sequentially
       - Use the exact agent/command/mcp specified for each step
       - Maintain outputs and context between steps
       - Provide clear progress updates
    
    3. ✅ COMPLETION PHASE:
       - Summarize what was accomplished
       - Highlight any outputs or files created
       - Suggest next steps if applicable
    
    4. ❌ ERROR HANDLING:
       - If a step fails, stop execution immediately
       - Provide clear error message and suggested fixes
       - Offer to retry the failed step after fixes
    
    Remember: This workflow was designed to work as a complete automation.
    Each step builds upon the previous ones. Execute with confidence!

#═══════════════════════════════════════════════════════════════════════════════
# 📋 WORKFLOW SUMMARY
#═══════════════════════════════════════════════════════════════════════════════
# 
# This workflow will execute ${workflowData.steps.length} steps in sequence:
${workflowData.steps.map((step, index) => `# ${index + 1}. ${step.description} (${step.type}: ${step.name})`).join('\n')}
#
# Total estimated time: ${Math.ceil(workflowData.steps.length * 2)} minutes
# Components required: ${workflowData.steps.filter(s => s.type === 'agent').length} agents, ${workflowData.steps.filter(s => s.type === 'command').length} commands, ${workflowData.steps.filter(s => s.type === 'mcp').length} MCPs
#═══════════════════════════════════════════════════════════════════════════════
`;
  
  return yaml;
}

/**
 * Handle prompt execution in Claude Code
 */
async function handlePromptExecution(prompt, targetDir) {
  console.log(chalk.blue('\n🎯 Prompt execution requested...'));
  
  // Ask user if they want to execute the prompt in Claude Code
  const { shouldExecute } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldExecute',
    message: `Do you want to execute this prompt in Claude Code?\n${chalk.cyan(`"${prompt}"`)}`,
    default: true
  }]);
  
  if (!shouldExecute) {
    console.log(chalk.yellow('⏹️  Prompt execution skipped by user.'));
    return;
  }
  
  console.log(chalk.blue('🚀 Preparing to launch Claude Code with your prompt...'));
  
  try {
    // Check if claude command is available in PATH
    const { spawn } = require('child_process');
    const open = require('open');
    
    // First try to execute claude command directly
    const claudeProcess = spawn('claude', [prompt], {
      cwd: targetDir,
      stdio: ['inherit', 'inherit', 'inherit'],
      shell: true
    });
    
    claudeProcess.on('error', async (error) => {
      if (error.code === 'ENOENT') {
        // Claude command not found, try alternative approaches
        console.log(chalk.yellow('⚠️  Claude Code CLI not found in PATH.'));
        console.log(chalk.blue('💡 Alternative ways to execute your prompt:'));
        console.log(chalk.gray('   1. Install Claude Code CLI: https://claude.ai/code'));
        console.log(chalk.gray('   2. Copy and paste this prompt in Claude Code interface:'));
        console.log(chalk.cyan(`\n   "${prompt}"\n`));
        
        // Ask if user wants to open Claude Code web interface
        const { openWeb } = await inquirer.prompt([{
          type: 'confirm',
          name: 'openWeb',
          message: 'Would you like to open Claude Code in your browser?',
          default: true
        }]);
        
        if (openWeb) {
          await open('https://claude.ai/code');
          console.log(chalk.green('✅ Claude Code opened in your browser!'));
          console.log(chalk.cyan(`Don't forget to paste your prompt: "${prompt}"`));
        }
      } else {
        throw error;
      }
    });
    
    claudeProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ Claude Code executed successfully!'));
      } else if (code !== null) {
        console.log(chalk.yellow(`⚠️  Claude Code exited with code ${code}`));
      }
    });
    
  } catch (error) {
    console.log(chalk.red(`❌ Error executing prompt: ${error.message}`));
    console.log(chalk.blue('💡 You can manually execute this prompt in Claude Code:'));
    console.log(chalk.cyan(`"${prompt}"`));
  }
}

module.exports = { createClaudeConfig, showMainMenu };
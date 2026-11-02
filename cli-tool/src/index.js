const inquirer = require('inquirer');
const chalk = require('chalk');
const { cancel } = require('@clack/prompts');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const { detectProject } = require('./utils');
const { getTemplateConfig, TEMPLATES_CONFIG } = require('./templates');
const { createPrompts, interactivePrompts } = require('./prompts');
const { copyTemplateFiles, runPostInstallationValidation } = require('./file-operations');
const { getHooksForLanguage, getMCPsForLanguage } = require('./hook-scanner');
const { installAgents } = require('./agents');
const { runAnalytics } = require('./analytics');
const { startChatsMobile } = require('./chats-mobile');
const { runHealthCheck } = require('./health-check');
const { trackingService } = require('./tracking-service');
const { createInstallUI } = require('./install-ui');
const { findRemovedCommands, reportRemovedCommands } = require('./removed-commands');
const { spawnClaude, claudeCommandLine } = require('./claude-launcher');

/**
 * Replace python3 commands with platform-appropriate Python command in configuration
 * Windows typically uses 'python' or 'py', while Unix/Linux uses 'python3'
 * @param {Object} config - Configuration object to process
 * @returns {Object} Processed configuration with platform-appropriate Python commands
 */
function replacePythonCommands(config) {
  if (!config || typeof config !== 'object') {
    return config;
  }

  // On Windows, replace python3 with python for better compatibility
  if (process.platform === 'win32') {
    const configString = JSON.stringify(config);
    const replacedString = configString.replace(/python3\s/g, 'python ');
    return JSON.parse(replacedString);
  }

  return config;
}

async function runCatalogBrowser(options, targetDir) {
  const { browseCatalog, equivalentCommand, printNonInteractiveHelp } = require('./catalog-browser');
  const version = require('../package.json').version;
  const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY) && !process.env.CI;
  if (!interactive) {
    printNonInteractiveHelp(version);
    return;
  }
  trackingService.trackCommandExecution('catalog-browser');
  const selection = await browseCatalog({ version, targetDir });
  if (!selection) {
    cancel('Nothing installed.');
    return;
  }
  console.log(chalk.gray('│'));
  await installMultipleComponents({ ...selection, skipHeader: true, repeatCommand: equivalentCommand(selection) }, targetDir);
}

async function createClaudeConfig(options = {}) {
  const targetDir = options.directory || process.cwd();

  // Flags removed in 1.31.0 answer with what replaced them and exit non-zero.
  const removedCommands = findRemovedCommands(options);
  if (removedCommands.length > 0) {
    await reportRemovedCommands(removedCommands);
    process.exitCode = 1;
    return;
  }

  // Handle multiple components installation (new approach)
  if (options.agent || options.command || options.mcp || options.setting || options.hook || options.skill || options.loop || options.mod || options.functionHook) {
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
  
  // Handle analytics dashboard
  if (options.analytics) {
    trackingService.trackCommandExecution('analytics');
    await runAnalytics(options);
    return;
  }

  // Handle the conversations viewer
  if (options.chats) {
    trackingService.trackCommandExecution('chats');
    await startChatsMobile(options);
    return;
  }

  // Handle health check
  let shouldRunSetup = false;
  if (options.healthCheck || options.health || options.check || options.verify) {
    trackingService.trackCommandExecution('health-check');
    const healthResult = await runHealthCheck();
    
    if (healthResult.runSetup) {
      console.log(chalk.blue('⚙️  Starting Project Setup...'));
      shouldRunSetup = true;
    } else {
      console.log(chalk.green('👍 Health check completed.'));
      return;
    }
  }
  
  // No arguments: browse the catalog in a terminal, print usage anywhere else
  // (agents, CI, pipes), so the command never waits for input nobody can give.
  if (!shouldRunSetup && !options.setupFromMenu && !options.yes && !options.language && !options.framework && !options.template && !options.dryRun) {
    return await runCatalogBrowser(options, targetDir);
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
    // Interactive prompts with back navigation (--template preselects the language)
    config = await interactivePrompts(projectInfo, options.template && !options.language
      ? { ...options, language: options.template }
      : options);
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
  
  // Offer a Claude Code review of the result; never with --yes or without a
  // terminal, where nobody can answer the prompt.
  if (!options.dryRun && !options.yes && process.stdin.isTTY) {
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
  const startTime = Date.now();

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
        trackingService.trackInstallationOutcome('agent', agentName, 'failure', { errorType: 'not_found', durationMs: Date.now() - startTime, batchId: options.batchId });
        if (!options.silent) await showAvailableAgents();
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
    options.onWrite?.(targetFile);

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
    trackingService.trackInstallationOutcome('agent', agentName, 'success', { durationMs: Date.now() - startTime, batchId: options.batchId });

    return true;

  } catch (error) {
    console.log(chalk.red(`❌ Error installing agent: ${error.message}`));
    trackingService.trackInstallationOutcome('agent', agentName, 'failure', { errorType: 'network_error', errorMessage: error.message, durationMs: Date.now() - startTime, batchId: options.batchId });
    return false;
  }
}

async function installIndividualCommand(commandName, targetDir, options) {
  console.log(chalk.blue(`⚡ Installing command: ${commandName}`));
  const startTime = Date.now();

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
        trackingService.trackInstallationOutcome('command', commandName, 'failure', { errorType: 'not_found', durationMs: Date.now() - startTime, batchId: options.batchId });
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
    options.onWrite?.(targetFile);
    
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
    trackingService.trackInstallationOutcome('command', commandName, 'success', { durationMs: Date.now() - startTime, batchId: options.batchId });

    return true;

  } catch (error) {
    console.log(chalk.red(`❌ Error installing command: ${error.message}`));
    trackingService.trackInstallationOutcome('command', commandName, 'failure', { errorType: 'network_error', errorMessage: error.message, durationMs: Date.now() - startTime, batchId: options.batchId });
    return false;
  }
}

async function installIndividualMCP(mcpName, targetDir, options) {
  console.log(chalk.blue(`🔌 Installing MCP: ${mcpName}`));
  const startTime = Date.now();

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
        trackingService.trackInstallationOutcome('mcp', mcpName, 'failure', { errorType: 'not_found', durationMs: Date.now() - startTime, batchId: options.batchId });
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
    options.onWrite?.(targetMcpFile);
    
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
    trackingService.trackInstallationOutcome('mcp', mcpName, 'success', { durationMs: Date.now() - startTime, batchId: options.batchId });

    return true;

  } catch (error) {
    console.log(chalk.red(`❌ Error installing MCP: ${error.message}`));
    trackingService.trackInstallationOutcome('mcp', mcpName, 'failure', { errorType: 'network_error', errorMessage: error.message, durationMs: Date.now() - startTime, batchId: options.batchId });
    return false;
  }
}

async function installIndividualSetting(settingName, targetDir, options) {
  console.log(chalk.blue(`⚙️ Installing setting: ${settingName}`));
  const startTime = Date.now();

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
        trackingService.trackInstallationOutcome('setting', settingName, 'failure', { errorType: 'not_found', durationMs: Date.now() - startTime, batchId: options.batchId });
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const settingConfigText = await response.text();
    let settingConfig = JSON.parse(settingConfigText);

    // Replace python3 with platform-appropriate command for Windows compatibility
    settingConfig = replacePythonCommands(settingConfig);

    // Check if there are additional files to download (e.g., Python scripts)
    const additionalFiles = {};
    
    // For statusline settings, check if there's a corresponding Python file.
    // Detect it from the command itself (".claude/scripts/<name>.py") so direct
    // installs without the "statusline/" prefix also get the companion script.
    const statusLineCommand = settingConfig?.statusLine?.command;
    const scriptMatch = typeof statusLineCommand === 'string'
      ? statusLineCommand.match(/\.claude\/scripts\/([\w.-]+\.py)/)
      : null;
    if (settingName.includes('statusline/') || scriptMatch) {
      const pythonFileName = scriptMatch ? scriptMatch[1] : settingName.split('/').pop() + '.py';
      const pythonUrl = githubUrl.replace(/[^/]+\.json$/, pythonFileName);
      
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
      
      // Statusline scripts are written under <currentTargetDir>/.claude/scripts/.
      // A relative ".claude/scripts/..." command only resolves from the project
      // root, so for user/enterprise scope point it at the absolute location.
      let scopedSettingConfig = settingConfig;
      if (installLocation !== 'project' && installLocation !== 'local'
          && typeof settingConfig?.statusLine?.command === 'string'
          && settingConfig.statusLine.command.includes('.claude/scripts/')) {
        const scriptsDir = path.join(currentTargetDir, '.claude', 'scripts');
        scopedSettingConfig = {
          ...settingConfig,
          statusLine: {
            ...settingConfig.statusLine,
            command: settingConfig.statusLine.command.replace(/\.claude\/scripts\//g, scriptsDir.replace(/\\/g, '/') + '/')
          }
        };
      }

      // Deep merge configurations
      const mergedConfig = {
        ...existingConfig,
        ...scopedSettingConfig
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
      options.onWrite?.(actualTargetFile);
      
      // Install additional files if any exist
      if (Object.keys(additionalFiles).length > 0) {
        console.log(chalk.blue(`📄 Installing ${Object.keys(additionalFiles).length} additional file(s)...`));
        
        for (const [filePath, fileConfig] of Object.entries(additionalFiles)) {
          try {
            // A setting may only add files under the install location's .claude/
            // directory: no absolute paths, no ~, no `..` out of it.
            // Exception: Claude Code reads custom themes only from ~/.claude/themes/,
            // while a `theme` key works from any settings file, so theme files always
            // go to the user's home whatever location the setting is installed in.
            const fileBaseDir = /^\.claude[\\/]themes[\\/]/.test(filePath)
              ? require('os').homedir()
              : currentTargetDir;
            if (fileBaseDir !== currentTargetDir) {
              console.log(chalk.gray(`🎨 Theme file goes to ~/.claude/themes/, the only folder Claude Code reads themes from`));
            }
            const claudeRoot = path.resolve(fileBaseDir, '.claude');
            const resolvedFilePath = path.resolve(fileBaseDir, filePath);
            if (path.isAbsolute(filePath) || filePath.startsWith('~') ||
                !resolvedFilePath.startsWith(claudeRoot + path.sep)) {
              console.log(chalk.red(`❌ Skipped file outside .claude/: ${filePath}`));
              continue;
            }
            if (typeof fileConfig?.content !== 'string') {
              console.log(chalk.red(`❌ Skipped file without text content: ${filePath}`));
              continue;
            }
            
            // Ensure directory exists
            await fs.ensureDir(path.dirname(resolvedFilePath));
            
            // Write file content
            await fs.writeFile(resolvedFilePath, fileConfig.content, 'utf8');
            options.onWrite?.(resolvedFilePath);
            
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
    
    trackingService.trackInstallationOutcome('setting', settingName, successfulInstallations > 0 ? 'success' : 'failure', { durationMs: Date.now() - startTime, batchId: options.batchId });
    return successfulInstallations;

  } catch (error) {
    console.log(chalk.red(`❌ Error installing setting: ${error.message}`));
    trackingService.trackInstallationOutcome('setting', settingName, 'failure', { errorType: 'network_error', errorMessage: error.message, durationMs: Date.now() - startTime, batchId: options.batchId });
    return 0;
  }
}

async function installIndividualHook(hookName, targetDir, options) {
  console.log(chalk.blue(`🪝 Installing hook: ${hookName}`));
  const startTime = Date.now();

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
        trackingService.trackInstallationOutcome('hook', hookName, 'failure', { errorType: 'not_found', durationMs: Date.now() - startTime, batchId: options.batchId });
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const hookConfigText = await response.text();
    let hookConfig = JSON.parse(hookConfigText);

    // Replace python3 with platform-appropriate command for Windows compatibility
    hookConfig = replacePythonCommands(hookConfig);

    // Check if there are additional files to download (e.g., Python scripts for hooks)
    const additionalFiles = {};

    // Check if there's a corresponding Python file for ANY hook
    const pythonUrl = githubUrl.replace('.json', '.py');
    const hookBaseName = hookName.includes('/') ? hookName.split('/').pop() : hookName;

    try {
      console.log(chalk.gray(`📥 Checking for additional Python script...`));
      const pythonResponse = await fetch(pythonUrl);
      if (pythonResponse.ok) {
        const pythonContent = await pythonResponse.text();
        additionalFiles[`.claude/hooks/${hookBaseName}.py`] = {
          content: pythonContent,
          executable: true
        };
        console.log(chalk.green(`✓ Found Python script: ${hookBaseName}.py`));
      }
    } catch (error) {
      // Python file is optional, silently continue if not found
    }

    // Check if there's a corresponding Bash script for ANY hook
    const bashUrl = githubUrl.replace('.json', '.sh');

    try {
      console.log(chalk.gray(`📥 Checking for additional bash script...`));
      const bashResponse = await fetch(bashUrl);
      if (bashResponse.ok) {
        const bashContent = await bashResponse.text();
        additionalFiles[`.claude/hooks/${hookBaseName}.sh`] = {
          content: bashContent,
          executable: true
        };
        console.log(chalk.green(`✓ Found bash script: ${hookBaseName}.sh`));
      }
    } catch (error) {
      // Bash file is optional, silently continue if not found
    }

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
      options.onWrite?.(actualTargetFile);

      // Install additional files (e.g., Python scripts)
      if (Object.keys(additionalFiles).length > 0) {
        for (const [relativePath, fileData] of Object.entries(additionalFiles)) {
          const absolutePath = path.join(currentTargetDir, relativePath);
          const dir = path.dirname(absolutePath);

          // Ensure directory exists
          await fs.ensureDir(dir);

          // Write file
          await fs.writeFile(absolutePath, fileData.content, { mode: fileData.executable ? 0o755 : 0o644 });
          options.onWrite?.(absolutePath);

          if (!options.silent) {
            console.log(chalk.green(`✓ Installed additional file: ${relativePath}`));
          }
        }
      }

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
    
    trackingService.trackInstallationOutcome('hook', hookName, successfulInstallations > 0 ? 'success' : 'failure', { durationMs: Date.now() - startTime, batchId: options.batchId });
    return successfulInstallations;

  } catch (error) {
    console.log(chalk.red(`❌ Error installing hook: ${error.message}`));
    trackingService.trackInstallationOutcome('hook', hookName, 'failure', { errorType: 'network_error', errorMessage: error.message, durationMs: Date.now() - startTime, batchId: options.batchId });
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
    // First try to use local components.json file which has all agents cached
    const fs = require('fs');
    const path = require('path');
    const componentsPath = path.join(__dirname, '../../docs/components.json');
    
    if (fs.existsSync(componentsPath)) {
      const componentsData = JSON.parse(fs.readFileSync(componentsPath, 'utf8'));
      
      if (componentsData.agents && Array.isArray(componentsData.agents)) {
        const agents = [];
        
        for (const agent of componentsData.agents) {
          // Extract category from path
          const pathParts = agent.path.split('/');
          const category = pathParts.length > 1 ? pathParts[0] : 'root';
          const name = pathParts[pathParts.length - 1];
          
          agents.push({
            name: name,
            path: agent.path,
            category: category
          });
        }
        
        console.log(chalk.green(`✅ Loaded ${agents.length} agents from local cache`));
        return agents;
      }
    }
    
    // Fallback to aitmpl.com API if local file not found
    try {
      // Try aitmpl.com API first
      const apiResponse = await fetch('https://aitmpl.com/api/agents.json');
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        
        if (apiData.agents && Array.isArray(apiData.agents)) {
          console.log(chalk.green(`✅ Loaded ${apiData.agents.length} agents from aitmpl.com API`));
          return apiData.agents;
        }
      }
    } catch (apiError) {
      console.warn('Could not fetch from aitmpl.com, trying GitHub API...');
    }
    
    // If aitmpl.com API fails, try GitHub API as secondary fallback
    console.log(chalk.yellow('⚠️  Falling back to GitHub API...'));
    const response = await fetch('https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/agents');
    if (!response.ok) {
      // Check for rate limit error
      if (response.status === 403) {
        const responseText = await response.text();
        if (responseText.includes('rate limit')) {
          console.log(chalk.red('❌ GitHub API rate limit exceeded'));
          console.log(chalk.yellow('💡 Install locally with: npm install -g claude-code-templates'));
          
          // Return comprehensive fallback list
          return [
            { name: 'frontend-developer', path: 'development-team/frontend-developer', category: 'development-team' },
            { name: 'backend-developer', path: 'development-team/backend-developer', category: 'development-team' },
            { name: 'fullstack-developer', path: 'development-team/fullstack-developer', category: 'development-team' },
            { name: 'devops-engineer', path: 'development-team/devops-engineer', category: 'development-team' },
            { name: 'nextjs-architecture-expert', path: 'web-tools/nextjs-architecture-expert', category: 'web-tools' },
            { name: 'react-developer', path: 'web-tools/react-developer', category: 'web-tools' },
            { name: 'vue-developer', path: 'web-tools/vue-developer', category: 'web-tools' },
            { name: 'data-scientist', path: 'data-analytics/data-scientist', category: 'data-analytics' },
            { name: 'data-analyst', path: 'data-analytics/data-analyst', category: 'data-analytics' },
            { name: 'security-auditor', path: 'security/security-auditor', category: 'security' },
            { name: 'api-security-audit', path: 'api-security-audit', category: 'root' },
            { name: 'database-optimization', path: 'database-optimization', category: 'root' },
            { name: 'react-performance-optimization', path: 'react-performance-optimization', category: 'root' }
          ];
        }
      }
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
    console.warn('Warning: Could not fetch agents, using fallback list');
    // Comprehensive fallback list if all methods fail
    return [
      { name: 'frontend-developer', path: 'development-team/frontend-developer', category: 'development-team' },
      { name: 'backend-developer', path: 'development-team/backend-developer', category: 'development-team' },
      { name: 'fullstack-developer', path: 'development-team/fullstack-developer', category: 'development-team' },
      { name: 'api-security-audit', path: 'api-security-audit', category: 'root' },
      { name: 'database-optimization', path: 'database-optimization', category: 'root' },
      { name: 'react-performance-optimization', path: 'react-performance-optimization', category: 'root' }
    ];
  }
}

async function installIndividualSkill(skillName, targetDir, options) {
  console.log(chalk.blue(`💡 Installing skill: ${skillName}`));
  const startTime = Date.now();

  try {
    // Skills can be in format: "skill-name" or "category/skill-name"
    // Extract the actual skill name (last part of the path)
    const skillBaseName = skillName.includes('/') ? skillName.split('/').pop() : skillName;

    // Use GitHub API to download ALL files and directories for the skill
    const githubApiUrl = `https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/skills/${skillName}`;

    console.log(chalk.gray(`📥 Downloading skill from GitHub (main branch)...`));

    const downloadedFiles = {};

    // Recursive function to download all files and directories
    async function downloadDirectory(apiUrl, relativePath = '') {
      try {
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'claude-code-templates'
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log(chalk.red(`❌ Skill "${skillName}" not found`));
            console.log(chalk.yellow('💡 Tip: Use format "category/skill-name" (e.g., creative-design/algorithmic-art)'));
            console.log(chalk.yellow('Available categories: creative-design, development, document-processing, enterprise-communication'));
            return false;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contents = await response.json();

        for (const item of contents) {
          const itemPath = relativePath ? `${relativePath}/${item.name}` : item.name;

          if (item.type === 'file') {
            // Download file
            try {
              const fileResponse = await fetch(item.download_url);
              if (fileResponse.ok) {
                const fileContent = await fileResponse.text();
                const isExecutable = item.name.endsWith('.py') || item.name.endsWith('.sh');

                const targetPath = `.claude/skills/${skillBaseName}/${itemPath}`;
                downloadedFiles[targetPath] = {
                  content: fileContent,
                  executable: isExecutable
                };
                console.log(chalk.green(`✓ Downloaded: ${itemPath}`));
              }
            } catch (err) {
              console.log(chalk.gray(`  (Could not download ${itemPath})`));
            }
          } else if (item.type === 'dir') {
            // Recursively download directory contents
            console.log(chalk.gray(`📂 Downloading directory: ${itemPath}/`));
            await downloadDirectory(item.url, itemPath);
          }
        }

        return true;
      } catch (error) {
        console.log(chalk.gray(`  (Could not access GitHub API: ${error.message})`));
        return false;
      }
    }

    // Download all files from the skill directory
    const success = await downloadDirectory(githubApiUrl);
    if (!success) {
      return false;
    }

    // Check if SKILL.md was downloaded (required)
    const skillMdPath = `.claude/skills/${skillBaseName}/SKILL.md`;
    if (!downloadedFiles[skillMdPath]) {
      console.log(chalk.red(`❌ SKILL.md not found in skill directory`));
      trackingService.trackInstallationOutcome('skill', skillName, 'failure', { errorType: 'validation_error', errorMessage: 'SKILL.md not found', durationMs: Date.now() - startTime, batchId: options.batchId });
      return false;
    }

    // Create .claude/skills/skill-name directory (Anthropic standard structure)
    const skillsDir = path.join(targetDir, '.claude', 'skills');
    await fs.ensureDir(skillsDir);

    // Write all downloaded files
    for (const [filePath, fileData] of Object.entries(downloadedFiles)) {
      const fullPath = path.join(targetDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, fileData.content, 'utf8');
      options.onWrite?.(fullPath);

      if (fileData.executable) {
        await fs.chmod(fullPath, '755');
      }
    }

    const targetFile = path.join(skillsDir, skillBaseName, 'SKILL.md');

    if (!options.silent) {
      console.log(chalk.green(`✅ Skill "${skillName}" installed successfully!`));
      console.log(chalk.cyan(`📁 Installed to: ${path.relative(targetDir, targetFile)}`));
      console.log(chalk.cyan(`📄 Total files downloaded: ${Object.keys(downloadedFiles).length}`));
      console.log(chalk.cyan(`📦 Downloaded from: ${githubApiUrl}`));
    }

    // Track successful skill installation
    trackingService.trackDownload('skill', skillName, {
      installation_type: 'individual_skill',
      target_directory: path.relative(process.cwd(), targetDir),
      source: 'github_main',
      total_files: Object.keys(downloadedFiles).length
    });
    trackingService.trackInstallationOutcome('skill', skillName, 'success', { durationMs: Date.now() - startTime, batchId: options.batchId });

    return true;

  } catch (error) {
    console.log(chalk.red(`❌ Error installing skill: ${error.message}`));
    trackingService.trackInstallationOutcome('skill', skillName, 'failure', { errorType: 'network_error', errorMessage: error.message, durationMs: Date.now() - startTime, batchId: options.batchId });
    return false;
  }
}

/**
 * Parse the `components:` frontmatter field of a loop into {type, path} refs.
 * The field is a flat bracketed list of `type:path` tokens, e.g.
 *   components: [agent:documentation/docs-architect, skill:git/create-pr]
 */
function parseLoopReferencedComponents(loopContent) {
  const refs = [];
  if (!loopContent || !loopContent.startsWith('---')) return refs;
  const fmEnd = loopContent.indexOf('---', 3);
  if (fmEnd === -1) return refs;
  const frontmatter = loopContent.slice(3, fmEnd);
  for (const line of frontmatter.split('\n')) {
    if (!line.startsWith('components:')) continue;
    const value = line.slice(line.indexOf(':') + 1).trim().replace(/^\[|\]$/g, '');
    for (const token of value.split(',')) {
      const trimmed = token.trim().replace(/^["']|["']$/g, '');
      if (!trimmed) continue;
      const sep = trimmed.indexOf(':');
      if (sep === -1) continue;
      const type = trimmed.slice(0, sep).trim();
      const compPath = trimmed.slice(sep + 1).trim().replace(/\.(md|json)$/, '');
      if (type && compPath) refs.push({ type, path: compPath });
    }
    break;
  }
  return refs;
}

/**
 * Install a loop component (markdown) into .claude/loops/, then auto-install
 * every component it references (agents, skills, hooks, commands, settings, mcps).
 */
/**
 * Install a Claude Mod as a local Claude Code plugin.
 *
 * A mod is a plugin whose behaviour lives in a function-hooks module
 * (https://github.com/anthropics/claude-code/tree/main/mods). It loads in
 * Claude Code >= 2.1.287, where mods are on by default.
 *
 * The catalog stores each mod as a complete plugin directory, exactly
 * Anthropic's layout: cli-tool/components/mods/{category}/{name}/ holds
 * .claude-plugin/plugin.json (name, description, userConfig, ...),
 * hooks/hooks.json ("modules"), the hooks-modules under hooks/ (any number of
 * files, relative imports allowed), and optional types/, tests/ and README.md.
 * We download the whole directory (like a skill) and write it verbatim to
 * .claude/skills/{name}/, which Claude Code auto-loads as "{name}@skills-dir"
 * once the workspace is trusted.
 */
async function installIndividualMod(modName, targetDir, options = {}) {
  console.log(chalk.blue(`ƒ  Installing mod: ${modName}`));
  const startTime = Date.now();

  try {
    // Only "category/name" in kebab-case: this string becomes both a URL and a directory name.
    if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i.test(modName)) {
      throw new Error('Invalid mod name. Expected "category/name" (letters, digits and hyphens only), e.g. security/secret-redactor.');
    }
    const baseName = modName.split('/').pop();
    const githubApiUrl = `https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/mods/${modName}`;
    console.log(chalk.gray(`📥 Downloading from GitHub (main branch)...`));

    const downloadedFiles = {};
    let notFound = false;

    // Recursive download of the plugin directory (same approach as skills).
    async function downloadDirectory(apiUrl, relativePath = '') {
      const response = await fetch(apiUrl, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'claude-code-templates' }
      });
      if (!response.ok) {
        if (response.status === 404 && !relativePath) { notFound = true; return; }
        throw new Error(`HTTP ${response.status}: ${response.statusText} (${relativePath || '/'})`);
      }
      const contents = await response.json();
      for (const item of contents) {
        const itemPath = relativePath ? `${relativePath}/${item.name}` : item.name;
        // Plugin files only: no path tricks, no hidden dirs other than .claude-plugin.
        if (item.name.includes('..') || (item.name.startsWith('.') && item.name !== '.claude-plugin')) continue;
        if (item.type === 'file') {
          const fileResponse = await fetch(item.download_url);
          if (!fileResponse.ok) throw new Error(`Could not download ${itemPath} (HTTP ${fileResponse.status})`);
          downloadedFiles[itemPath] = await fileResponse.text();
          console.log(chalk.green(`✓ ${itemPath}`));
        } else if (item.type === 'dir') {
          await downloadDirectory(item.url, itemPath);
        }
      }
    }

    await downloadDirectory(githubApiUrl);
    if (notFound) {
      console.log(chalk.red(`❌ Mod "${modName}" not found`));
      console.log(chalk.gray('   Browse available mods at https://www.aitmpl.com/mods'));
      trackingService.trackInstallationOutcome('mod', modName, 'failure', { errorType: 'not_found', durationMs: Date.now() - startTime, batchId: options.batchId });
      return false;
    }

    // A mod is a plugin: the manifest and hooks/hooks.json must be there, and
    // every hooks-module hooks.json names must have come down with it.
    if (!downloadedFiles['.claude-plugin/plugin.json']) throw new Error('.claude-plugin/plugin.json missing: not a plugin directory');
    if (!downloadedFiles['hooks/hooks.json']) throw new Error('hooks/hooks.json missing: not a mod');
    const manifest = JSON.parse(downloadedFiles['.claude-plugin/plugin.json']);
    const hooksConfig = JSON.parse(downloadedFiles['hooks/hooks.json']);
    const modules = Array.isArray(hooksConfig.modules) ? hooksConfig.modules : [];
    if (modules.length === 0) throw new Error('hooks/hooks.json has no "modules" entry');
    for (const modulePath of modules) {
      const rel = `hooks/${String(modulePath).replace(/^\.\//, '')}`;
      if (!downloadedFiles[rel]) throw new Error(`hooks-module ${rel} named by hooks.json was not downloaded`);
    }

    // Write the plugin verbatim into the project's skills directory.
    const pluginDir = path.join(targetDir, '.claude', 'skills', baseName);
    for (const [rel, content] of Object.entries(downloadedFiles)) {
      const fullPath = path.join(pluginDir, rel);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf8');
      options.onWrite?.(fullPath);
    }

    const relPluginDir = path.relative(targetDir, pluginDir);
    const userConfig = manifest.userConfig && typeof manifest.userConfig === 'object' ? manifest.userConfig : undefined;
    if (!options.silent) {
      console.log(chalk.green(`✅ Mod "${modName}" installed successfully!`));
    }
    console.log(chalk.cyan(`📁 Installed to: ${relPluginDir}/  (${Object.keys(downloadedFiles).length} files)`));
    console.log(chalk.gray(`   hooks/hooks.json  ->  { "modules": ${JSON.stringify(modules)} }`));
    console.log(chalk.blue(`\n🧪 Claude Code loads it as "${manifest.name || baseName}@skills-dir" on the next session (after the workspace trust prompt).`));
    console.log(chalk.gray('   Mods are on by default in Claude Code >= 2.1.287.'));
    console.log(chalk.gray(`   Or load it for one session with hot reload: claude --plugin-dir ${relPluginDir}`));
    console.log(chalk.gray(`   Validate / test it: claude plugin validate ${relPluginDir}  ·  claude plugin test ${relPluginDir}`));
    if (userConfig) {
      console.log(chalk.gray(`   Options (${Object.keys(userConfig).join(', ')}): set them in /config, or in ~/.claude/settings.json (user, not project):`));
      console.log(chalk.gray(`   { "pluginConfigs": { "${manifest.name || baseName}@skills-dir": { "options": { ... } } } }`));
    }
    console.log(chalk.gray('   Reference: https://code.claude.com/docs/en/plugins/mods/overview\n'));

    trackingService.trackDownload('mod', modName, {
      installation_type: 'individual_mod',
      target_directory: path.relative(process.cwd(), targetDir),
      source: 'github_main',
      total_files: Object.keys(downloadedFiles).length
    });
    trackingService.trackInstallationOutcome('mod', modName, 'success', { durationMs: Date.now() - startTime, batchId: options.batchId });

    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error installing mod "${modName}":`), error.message);
    trackingService.trackInstallationOutcome('mod', modName, 'failure', { errorType: 'exception', errorMessage: error.message, durationMs: Date.now() - startTime, batchId: options.batchId });
    return false;
  }
}

async function installIndividualLoop(loopName, targetDir, options = {}) {
  console.log(chalk.blue(`🔁 Installing loop: ${loopName}`));
  const startTime = Date.now();

  try {
    const githubUrl = `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/loops/${loopName}.md`;
    console.log(chalk.gray(`📥 Downloading from GitHub (main branch)...`));

    const response = await fetch(githubUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(chalk.red(`❌ Loop "${loopName}" not found`));
        trackingService.trackInstallationOutcome('loop', loopName, 'failure', { errorType: 'not_found', durationMs: Date.now() - startTime, batchId: options.batchId });
        return false;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const loopContent = await response.text();

    // Write the loop file to .claude/loops/ (flat, like agents)
    const loopsDir = path.join(targetDir, '.claude', 'loops');
    await fs.ensureDir(loopsDir);
    const fileName = loopName.includes('/') ? loopName.split('/').pop() : loopName;
    const targetFile = path.join(loopsDir, `${fileName}.md`);
    await fs.writeFile(targetFile, loopContent, 'utf8');
    options.onWrite?.(targetFile);

    if (!options.silent) {
      console.log(chalk.green(`✅ Loop "${loopName}" installed successfully!`));
      console.log(chalk.cyan(`📁 Installed to: ${path.relative(targetDir, targetFile)}`));
    }

    trackingService.trackDownload('loop', loopName, {
      installation_type: 'individual_loop',
      target_directory: path.relative(process.cwd(), targetDir),
      source: 'github_main'
    });

    // Auto-install referenced components
    const refs = parseLoopReferencedComponents(loopContent);
    if (refs.length > 0) {
      console.log(chalk.blue(`\n🧩 Installing ${refs.length} referenced component(s) for this loop...`));
      const refOptions = { ...options, silent: true };
      for (const ref of refs) {
        try {
          switch (ref.type) {
            case 'agent':
              await installIndividualAgent(ref.path, targetDir, refOptions);
              break;
            case 'command':
              await installIndividualCommand(ref.path, targetDir, refOptions);
              break;
            case 'skill':
              await installIndividualSkill(ref.path, targetDir, refOptions);
              break;
            case 'hook':
              await installIndividualHook(ref.path, targetDir, refOptions);
              break;
            case 'setting':
              await installIndividualSetting(ref.path, targetDir, refOptions);
              break;
            case 'mcp':
              await installIndividualMCP(ref.path, targetDir, refOptions);
              break;
            default:
              console.log(chalk.yellow(`   ⚠️  Unknown referenced component type: ${ref.type}:${ref.path}`));
              continue;
          }
          console.log(chalk.green(`   ✓ ${ref.type}: ${ref.path}`));
        } catch (refError) {
          console.log(chalk.yellow(`   ⚠️  Could not install ${ref.type}:${ref.path} (${refError.message})`));
        }
      }
    }

    trackingService.trackInstallationOutcome('loop', loopName, 'success', { durationMs: Date.now() - startTime, batchId: options.batchId });
    return true;

  } catch (error) {
    console.log(chalk.red(`❌ Error installing loop: ${error.message}`));
    trackingService.trackInstallationOutcome('loop', loopName, 'failure', { errorType: 'network_error', errorMessage: error.message, durationMs: Date.now() - startTime, batchId: options.batchId });
    return false;
  }
}

/**
 * Install multiple components with optional YAML workflow
 */
async function installMultipleComponents(options, targetDir) {
  const batchId = Math.random().toString(36).substring(2, 15);

  try {
    const components = {
      agents: [],
      commands: [],
      mcps: [],
      settings: [],
      hooks: [],
      skills: [],
      loops: [],
      mods: []
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

    if (options.skill) {
      const skillsInput = Array.isArray(options.skill) ? options.skill.join(',') : options.skill;
      components.skills = skillsInput.split(',').map(s => s.trim()).filter(s => s);
    }

    if (options.loop) {
      const loopsInput = Array.isArray(options.loop) ? options.loop.join(',') : options.loop;
      components.loops = loopsInput.split(',').map(l => l.trim()).filter(l => l);
    }

    // --mod, plus --function-hook kept as an alias of it
    const modInputs = [options.mod, options.functionHook].filter(Boolean).flat();
    if (modInputs.length > 0) {
      components.mods = modInputs.join(',').split(',').map(m => m.trim()).filter(m => m);
    }

    const totalComponents = components.agents.length + components.commands.length + components.mcps.length + components.settings.length + components.hooks.length + components.skills.length + components.loops.length + components.mods.length;
    
    if (totalComponents === 0) {
      console.log(chalk.yellow('⚠️  No components specified to install.'));
      return;
    }
    
    const ui = createInstallUI({ version: require('../package.json').version, targetDir });
    const items = [
      ...components.agents.map(name => ({ type: 'agent', name })),
      ...components.commands.map(name => ({ type: 'command', name })),
      ...components.mcps.map(name => ({ type: 'mcp', name })),
      ...components.settings.map(name => ({ type: 'setting', name })),
      ...components.hooks.map(name => ({ type: 'hook', name })),
      ...components.skills.map(name => ({ type: 'skill', name })),
      ...components.loops.map(name => ({ type: 'loop', name })),
      ...components.mods.map(name => ({ type: 'mod', name }))
    ];

    if (!options.skipHeader) ui.header();
    ui.plan(items);

    // Ask for installation locations once for configuration components.
    // Loops can pull in settings/hooks via their referenced components, so ask when loops are present too.
    let sharedInstallLocations = ['local'];
    const hasSettingsOrHooks = components.settings.length > 0 || components.hooks.length > 0 || components.loops.length > 0;
    if (hasSettingsOrHooks) {
      sharedInstallLocations = await ui.chooseLocations({ skipPrompt: options.yes });
    }

    const installers = {
      agent: installIndividualAgent,
      command: installIndividualCommand,
      mcp: installIndividualMCP,
      setting: installIndividualSetting,
      hook: installIndividualHook,
      skill: installIndividualSkill,
      loop: installIndividualLoop,
      mod: installIndividualMod
    };
    const usesLocations = new Set(['setting', 'hook', 'loop']);

    const results = [];
    for (const item of items) {
      const result = await ui.runStep(item, onWrite => installers[item.type](item.name, targetDir, {
        ...options,
        silent: true,
        batchId,
        onWrite,
        ...(usesLocations.has(item.type) ? { sharedInstallLocations } : {})
      }));
      results.push(result);
    }
    const successfullyInstalled = results.filter(r => r.ok).length;

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
    
    ui.summary(results, items, { repeatCommand: options.repeatCommand });
    if (successfullyInstalled === 0) return;

    if (options.yaml) {
      ui.note('Workflow file created in .claude/workflows/. Use it with Claude Code to run the complete setup.');
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
    
    // Count the workflow run in command usage (Neon). Its components come
    // inline in the hash, so they are not counted as catalog downloads.
    trackingService.trackCommandExecution('workflow', {
      components_count: workflowData.steps.length,
      agents_count: agents.length,
      commands_count: commands.length,
      mcps_count: mcps.length
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

  // Claude Code would start interactively: without a terminal nobody can
  // use it, and the confirmation below would wait forever.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(chalk.yellow('⏹️  No terminal, so Claude Code was not started. Run the prompt with:'));
    console.log(chalk.cyan(`   ${claudeCommandLine([prompt])}`));
    return;
  }

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
    const open = require('open');

    // The prompt is one argument, never shell syntax (see claude-launcher.js)
    const claudeProcess = spawnClaude([prompt], {
      cwd: targetDir,
      stdio: ['inherit', 'inherit', 'inherit']
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

module.exports = { createClaudeConfig };
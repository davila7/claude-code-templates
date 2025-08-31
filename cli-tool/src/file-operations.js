const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { getHooksForLanguage, filterHooksBySelection, getMCPsForLanguage, filterMCPsBySelection } = require('./hook-scanner');

// GitHub configuration for downloading templates
const GITHUB_CONFIG = {
  owner: 'davila7',
  repo: 'claude-code-templates',
  branch: 'main',
  templatesPath: 'cli-tool/templates'
};

// Cache for downloaded files to avoid repeated downloads
const downloadCache = new Map();

async function downloadFileFromGitHub(filePath, retryCount = 0) {
  // Check cache first
  if (downloadCache.has(filePath)) {
    return downloadCache.get(filePath);
  }

  const maxRetries = 3;
  const baseDelay = 1000;
  const retryDelay = baseDelay * Math.pow(2, retryCount); // Exponential backoff: 1s, 2s, 4s
  const githubUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.templatesPath}/${filePath}`;
  
  try {
    const response = await fetch(githubUrl);
    
    // Handle rate limiting for raw.githubusercontent.com (though less common)
    if (response.status === 403 && retryCount < maxRetries) {
      const rateLimitMsg = response.statusText.toLowerCase();
      if (rateLimitMsg.includes('rate limit') || rateLimitMsg.includes('forbidden')) {
        console.log(chalk.yellow(`⏳ Rate limited downloading ${filePath}, retrying in ${Math.ceil(retryDelay / 1000)}s...`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return downloadFileFromGitHub(filePath, retryCount + 1);
      }
    }
    
    if (!response.ok) {
      // For 404s, just throw - these are legitimate missing files
      if (response.status === 404) {
        throw new Error(`File not found: ${filePath} (404)`);
      }
      
      // For other errors, retry if possible
      if (retryCount < maxRetries) {
        console.log(chalk.yellow(`⚠️  Error ${response.status} downloading ${filePath}, retrying...`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return downloadFileFromGitHub(filePath, retryCount + 1);
      }
      
      throw new Error(`Failed to download ${filePath}: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    downloadCache.set(filePath, content);
    return content;
  } catch (error) {
    // Network errors - retry if possible
    if (retryCount < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message.includes('fetch'))) {
      console.log(chalk.yellow(`⚠️  Network error downloading ${filePath}, retrying in ${Math.ceil(retryDelay / 1000)}s...`));
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return downloadFileFromGitHub(filePath, retryCount + 1);
    }
    
    // Don't log error here - let caller handle it
    throw error;
  }
}

async function downloadDirectoryFromGitHub(dirPath, retryCount = 0) {
  const maxRetries = 5; // Increased retry attempts
  const baseDelay = 2000; // Base delay of 2 seconds
  const retryDelay = baseDelay * Math.pow(2, retryCount); // Exponential backoff: 2s, 4s, 8s, 16s, 32s
  
  // For directories, we need to get the list of files first
  // GitHub API endpoint to get directory contents
  const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.templatesPath}/${dirPath}?ref=${GITHUB_CONFIG.branch}`;
  
  try {
    const response = await fetch(apiUrl);
    
    // Handle rate limiting with more sophisticated detection
    if (response.status === 403) {
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');
      const isRateLimit = rateLimitRemaining === '0' || response.statusText.toLowerCase().includes('rate limit');
      
      if (isRateLimit && retryCount < maxRetries) {
        let waitTime = retryDelay;
        
        // If we have reset time, calculate exact wait time
        if (rateLimitReset) {
          const resetTime = parseInt(rateLimitReset) * 1000;
          const currentTime = Date.now();
          const exactWaitTime = Math.max(resetTime - currentTime + 1000, retryDelay); // Add 1s buffer
          waitTime = Math.min(exactWaitTime, 60000); // Cap at 60 seconds
        }
        
        console.log(chalk.yellow(`⏳ GitHub API rate limit exceeded for ${dirPath}`));
        console.log(chalk.yellow(`   Waiting ${Math.ceil(waitTime / 1000)}s before retry ${retryCount + 1}/${maxRetries}...`));
        console.log(chalk.gray(`   Rate limit resets at: ${rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : 'unknown'}`));
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return downloadDirectoryFromGitHub(dirPath, retryCount + 1);
      } else if (isRateLimit) {
        console.log(chalk.red(`❌ GitHub API rate limit exceeded after ${maxRetries} retries`));
        console.log(chalk.yellow(`   Directory ${dirPath} will be skipped (some template files may be missing)`));
        return {}; // Return empty object instead of throwing error
      } else {
        // Different 403 error (permissions, etc.)
        console.log(chalk.yellow(`⚠️  Access denied for ${dirPath} (403). This may be normal for some templates.`));
        return {};
      }
    }
    
    if (!response.ok) {
      // If it's a 404, the directory doesn't exist - that's ok for some templates
      if (response.status === 404) {
        console.log(chalk.yellow(`⚠️  Directory ${dirPath} not found (this is normal for some templates)`));
        return {};
      }
      
      // For other errors, retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        console.log(chalk.yellow(`⚠️  Error ${response.status} for ${dirPath}, retrying in ${Math.ceil(retryDelay / 1000)}s...`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return downloadDirectoryFromGitHub(dirPath, retryCount + 1);
      }
      
      throw new Error(`Failed to get directory listing for ${dirPath}: ${response.status} ${response.statusText}`);
    }
    
    const items = await response.json();
    const files = {};
    let successCount = 0;
    let skipCount = 0;
    
    for (const item of items) {
      if (item.type === 'file') {
        const relativePath = path.relative(GITHUB_CONFIG.templatesPath, item.path);
        try {
          const content = await downloadFileFromGitHub(relativePath);
          files[item.name] = content;
          successCount++;
        } catch (fileError) {
          skipCount++;
          if (fileError.message.includes('rate limit') || fileError.message.includes('403')) {
            console.log(chalk.yellow(`⚠️  Rate limited while downloading ${item.name}, skipping...`));
          } else {
            console.log(chalk.yellow(`⚠️  Skipped ${item.name}: ${fileError.message}`));
          }
          // Continue with other files instead of failing completely
        }
      }
    }
    
    if (successCount > 0) {
      console.log(chalk.green(`✓ Downloaded ${successCount} files from ${dirPath}${skipCount > 0 ? ` (${skipCount} skipped)` : ''}`));
    } else if (skipCount > 0) {
      console.log(chalk.yellow(`⚠️  All ${skipCount} files in ${dirPath} were skipped due to errors`));
    }
    
    return files;
  } catch (error) {
    if (retryCount < maxRetries && (error.message.includes('rate limit') || error.message.includes('ECONNRESET'))) {
      console.log(chalk.yellow(`⚠️  Network error for ${dirPath}, retrying in ${Math.ceil(retryDelay / 1000)}s...`));
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return downloadDirectoryFromGitHub(dirPath, retryCount + 1);
    }
    
    console.error(chalk.red(`❌ Error downloading directory ${dirPath} from GitHub:`), error.message);
    console.log(chalk.yellow(`   Continuing with available files (some template files may be missing)`));
    return {}; // Return empty object to continue with other parts of the template
  }
}

// Helper functions for processing downloaded content
async function processSettingsFileFromContent(settingsContent, destPath, templateConfig) {
  const settings = JSON.parse(settingsContent);
  
  // Filter hooks based on selection
  if (templateConfig.selectedHooks && settings.hooks) {
    settings.hooks = filterHooksBySelection(settings.hooks, templateConfig.selectedHooks);
  }
  
  const destDir = path.dirname(destPath);
  await fs.ensureDir(destDir);
  await fs.writeJson(destPath, settings, { spaces: 2 });
}

async function mergeSettingsFileFromContent(settingsContent, destPath, templateConfig) {
  const newSettings = JSON.parse(settingsContent);
  let existingSettings = {};
  
  if (await fs.pathExists(destPath)) {
    existingSettings = await fs.readJson(destPath);
  }
  
  // Filter hooks based on selection
  if (templateConfig.selectedHooks && newSettings.hooks) {
    newSettings.hooks = filterHooksBySelection(newSettings.hooks, templateConfig.selectedHooks);
  }
  
  // Merge settings
  const mergedSettings = {
    ...existingSettings,
    ...newSettings,
    hooks: {
      ...existingSettings.hooks,
      ...newSettings.hooks
    }
  };
  
  const destDir = path.dirname(destPath);
  await fs.ensureDir(destDir);
  await fs.writeJson(destPath, mergedSettings, { spaces: 2 });
}

async function processMCPFileFromContent(mcpContent, destPath, templateConfig) {
  const mcpConfig = JSON.parse(mcpContent);
  
  // Clean and prepare MCP config (only keep mcpServers without descriptions)
  const cleanMcpConfig = { mcpServers: {} };
  if (mcpConfig.mcpServers) {
    for (const serverName in mcpConfig.mcpServers) {
      if (mcpConfig.mcpServers[serverName] && typeof mcpConfig.mcpServers[serverName] === 'object') {
        const serverConfig = { ...mcpConfig.mcpServers[serverName] };
        delete serverConfig.description; // Remove description field
        cleanMcpConfig.mcpServers[serverName] = serverConfig;
      }
    }
  }
  
  // Filter MCPs based on selection
  if (templateConfig.selectedMCPs && cleanMcpConfig.mcpServers) {
    cleanMcpConfig.mcpServers = filterMCPsBySelection(cleanMcpConfig.mcpServers, templateConfig.selectedMCPs);
  }
  
  const destDir = path.dirname(destPath);
  await fs.ensureDir(destDir);
  await fs.writeJson(destPath, cleanMcpConfig, { spaces: 2 });
}

async function mergeMCPFileFromContent(mcpContent, destPath, templateConfig) {
  const newMcpConfig = JSON.parse(mcpContent);
  let existingMcpConfig = {};
  
  if (await fs.pathExists(destPath)) {
    existingMcpConfig = await fs.readJson(destPath);
  }
  
  // Clean new MCP config (only keep mcpServers without descriptions)
  const cleanNewMcpConfig = { mcpServers: {} };
  if (newMcpConfig.mcpServers) {
    for (const serverName in newMcpConfig.mcpServers) {
      if (newMcpConfig.mcpServers[serverName] && typeof newMcpConfig.mcpServers[serverName] === 'object') {
        const serverConfig = { ...newMcpConfig.mcpServers[serverName] };
        delete serverConfig.description; // Remove description field
        cleanNewMcpConfig.mcpServers[serverName] = serverConfig;
      }
    }
  }
  
  // Filter MCPs based on selection
  if (templateConfig.selectedMCPs && cleanNewMcpConfig.mcpServers) {
    cleanNewMcpConfig.mcpServers = filterMCPsBySelection(cleanNewMcpConfig.mcpServers, templateConfig.selectedMCPs);
  }
  
  // Merge MCP configurations (only keep mcpServers)
  const mergedMcpConfig = {
    mcpServers: {
      ...existingMcpConfig.mcpServers,
      ...cleanNewMcpConfig.mcpServers
    }
  };
  
  const destDir = path.dirname(destPath);
  await fs.ensureDir(destDir);
  await fs.writeJson(destPath, mergedMcpConfig, { spaces: 2 });
}

async function checkExistingFiles(targetDir, templateConfig) {
  const existingFiles = [];
  
  // Check for existing CLAUDE.md
  const claudeFile = path.join(targetDir, 'CLAUDE.md');
  if (await fs.pathExists(claudeFile)) {
    existingFiles.push('CLAUDE.md');
  }
  
  // Check for existing .claude directory
  const claudeDir = path.join(targetDir, '.claude');
  if (await fs.pathExists(claudeDir)) {
    existingFiles.push('.claude/');
  }
  
  // Check for existing .mcp.json
  const mcpFile = path.join(targetDir, '.mcp.json');
  if (await fs.pathExists(mcpFile)) {
    existingFiles.push('.mcp.json');
  }
  
  return existingFiles;
}

async function promptUserForOverwrite(existingFiles, targetDir) {
  if (existingFiles.length === 0) {
    return 'proceed'; // No existing files, safe to proceed
  }
  
  console.log(chalk.yellow('\n⚠️  Existing Claude Code configuration detected!'));
  console.log(chalk.yellow('The following files/directories already exist:'));
  existingFiles.forEach(file => {
    console.log(chalk.yellow(`   • ${file}`));
  });
  
  const choices = [
    {
      name: '🔄 Backup and overwrite - Create backups and install new configuration',
      value: 'backup',
      short: 'Backup and overwrite'
    },
    {
      name: '🔀 Merge configurations - Combine existing with new templates', 
      value: 'merge',
      short: 'Merge'
    },
    {
      name: '❌ Cancel setup - Keep existing configuration unchanged',
      value: 'cancel',
      short: 'Cancel'
    }
  ];
  
  const answer = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'How would you like to proceed?',
    choices,
    default: 'backup'
  }]);
  
  return answer.action;
}

async function createBackups(existingFiles, targetDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  for (const file of existingFiles) {
    const sourcePath = path.join(targetDir, file);
    const backupPath = path.join(targetDir, `${file.replace('/', '')}.backup-${timestamp}`);
    
    try {
      await fs.copy(sourcePath, backupPath);
      console.log(chalk.green(`📋 Backed up ${file} → ${path.basename(backupPath)}`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to backup ${file}:`), error.message);
      throw error;
    }
  }
}

async function copyTemplateFiles(templateConfig, targetDir, options = {}) {
  console.log(chalk.gray(`📥 Downloading templates from GitHub (${GITHUB_CONFIG.branch} branch)...`));
  
  // Check for existing files and get user preference
  const existingFiles = await checkExistingFiles(targetDir, templateConfig);
  let userAction = 'proceed';
  
  if (!options.yes && !options.dryRun) {
    userAction = await promptUserForOverwrite(existingFiles, targetDir);
    
    if (userAction === 'cancel') {
      console.log(chalk.blue('✓ Setup cancelled. Your existing configuration remains unchanged.'));
      return false; // Indicate cancellation
    }
  } else if (existingFiles.length > 0) {
    // In --yes mode, default to backup behavior
    userAction = 'backup';
  }
  
  // Create backups if requested
  if (userAction === 'backup' && existingFiles.length > 0) {
    await createBackups(existingFiles, targetDir);
  }
  
  // Determine overwrite behavior based on user choice
  const shouldOverwrite = userAction !== 'merge';
  
  // Track success/failure statistics
  let totalFiles = templateConfig.files.length;
  let successfulFiles = 0;
  let skippedFiles = 0;
  let failedFiles = 0;
  
  // Copy base files and framework-specific files
  for (const file of templateConfig.files) {
    const destPath = path.join(targetDir, file.destination);
    
    try {
      // Handle framework-specific command files specially
      if (file.source.includes('.claude/commands') && file.source.includes('examples/')) {
        // This is a framework-specific commands directory - merge with existing commands
        await fs.ensureDir(destPath);
        
        // Download framework-specific commands from GitHub
        try {
          const frameworkFiles = await downloadDirectoryFromGitHub(file.source);
          let filesWritten = 0;
          
          for (const [frameworkFileName, content] of Object.entries(frameworkFiles)) {
            const destFile = path.join(destPath, frameworkFileName);
            
            // In merge mode, skip if file already exists
            if (userAction === 'merge' && await fs.pathExists(destFile)) {
              console.log(chalk.blue(`⏭️  Skipped ${frameworkFileName} (already exists)`));
              continue;
            }
            
            await fs.writeFile(destFile, content, 'utf8');
            filesWritten++;
          }
          
          if (filesWritten > 0) {
            console.log(chalk.green(`✓ Downloaded ${filesWritten} framework commands ${file.source} → ${file.destination}`));
            successfulFiles++;
          } else {
            console.log(chalk.yellow(`⚠️  No framework commands available for ${file.source}`));
            skippedFiles++;
          }
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Could not download framework commands from ${file.source}: ${error.message}`));
          console.log(chalk.yellow(`   This is normal for some templates - continuing...`));
          failedFiles++;
        }
      } else if (file.source.includes('.claude') && !file.source.includes('examples/')) {
        // This is base .claude directory - download it but handle commands specially
        await fs.ensureDir(destPath);
        
        // Download base .claude directory structure from GitHub
        try {
          const baseClaudeFiles = await downloadDirectoryFromGitHub(file.source);
          
          // Write non-command files first
          for (const [fileName, content] of Object.entries(baseClaudeFiles)) {
            if (fileName !== 'commands') { // Skip commands directory, handle separately
              const destFile = path.join(destPath, fileName);
              
              // In merge mode, skip if file already exists
              if (userAction === 'merge' && await fs.pathExists(destFile)) {
                console.log(chalk.blue(`⏭️  Skipped ${fileName} (already exists)`));
                continue;
              }
              
              await fs.writeFile(destFile, content, 'utf8');
            }
          }
          
          // Now handle base commands specifically
          const destCommandsPath = path.join(destPath, 'commands');
          await fs.ensureDir(destCommandsPath);
          
          // Download base commands from GitHub
          const baseCommandsDir = `${file.source}/commands`;
          try {
            const baseCommands = await downloadDirectoryFromGitHub(baseCommandsDir);
            const excludeCommands = ['react-component.md', 'route.md', 'api-endpoint.md']; // Commands moved to framework dirs
            
            for (const [baseCommandName, commandContent] of Object.entries(baseCommands)) {
              if (!excludeCommands.includes(baseCommandName)) {
                const destFile = path.join(destCommandsPath, baseCommandName);
                
                // In merge mode, skip if file already exists
                if (userAction === 'merge' && await fs.pathExists(destFile)) {
                  console.log(chalk.blue(`⏭️  Skipped ${baseCommandName} (already exists)`));
                  continue;
                }
                
                await fs.writeFile(destFile, commandContent, 'utf8');
              }
            }
          } catch (error) {
            // Commands directory might not exist for some templates, that's ok
            console.log(chalk.yellow(`⚠️  No commands directory found for ${baseCommandsDir}`));
          }
          
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Could not download .claude directory (${error.message})`));
          console.log(chalk.yellow(`   Continuing with other template files...`));
          failedFiles++;
          // Don't throw - continue with other files
          continue; // Skip the success message
        }
        
        console.log(chalk.green(`✓ Downloaded base configuration and commands ${file.source} → ${file.destination}`));
        successfulFiles++;
      } else if (file.source.includes('settings.json') && templateConfig.selectedHooks) {
        // Download and process settings.json with hooks
        const settingsContent = await downloadFileFromGitHub(file.source);
        
        // In merge mode, merge settings instead of overwriting
        if (userAction === 'merge') {
          await mergeSettingsFileFromContent(settingsContent, destPath, templateConfig);
          console.log(chalk.green(`✓ Merged ${file.source} → ${file.destination} (with selected hooks)`));
        } else {
          await processSettingsFileFromContent(settingsContent, destPath, templateConfig);
          console.log(chalk.green(`✓ Downloaded ${file.source} → ${file.destination} (with selected hooks)`));
        }
        successfulFiles++;
      } else if (file.source.includes('.mcp.json') && templateConfig.selectedMCPs) {
        // Download and process MCP config with selected MCPs
        const mcpContent = await downloadFileFromGitHub(file.source);
        
        // In merge mode, merge MCP config instead of overwriting
        if (userAction === 'merge') {
          await mergeMCPFileFromContent(mcpContent, destPath, templateConfig);
          console.log(chalk.green(`✓ Merged ${file.source} → ${file.destination} (with selected MCPs)`));
        } else {
          await processMCPFileFromContent(mcpContent, destPath, templateConfig);
          console.log(chalk.green(`✓ Downloaded ${file.source} → ${file.destination} (with selected MCPs)`));
        }
        successfulFiles++;
      } else {
        // Download regular files (CLAUDE.md, etc.)
        // In merge mode, skip if file already exists
        if (userAction === 'merge' && await fs.pathExists(destPath)) {
          console.log(chalk.blue(`⏭️  Skipped ${file.destination} (already exists)`));
          skippedFiles++;
          continue;
        }
        
        try {
          const fileContent = await downloadFileFromGitHub(file.source);
          const destDir = path.dirname(destPath);
          await fs.ensureDir(destDir);
          await fs.writeFile(destPath, fileContent, 'utf8');
          console.log(chalk.green(`✓ Downloaded ${file.source} → ${file.destination}`));
          successfulFiles++;
        } catch (error) {
          if (error.message.includes('404')) {
            console.log(chalk.yellow(`⚠️  File ${file.source} not found (404) - this is normal for some templates`));
            skippedFiles++;
          } else {
            console.log(chalk.yellow(`⚠️  Could not download ${file.source}: ${error.message}`));
            console.log(chalk.yellow(`   Continuing with other template files...`));
            failedFiles++;
          }
        }
      }
    } catch (error) {
      // Only throw for critical errors that should stop the entire process
      if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
        console.error(chalk.red(`✗ Permission error copying ${file.source}:`), error.message);
        throw error;
      } else {
        console.log(chalk.yellow(`⚠️  Could not process ${file.source}: ${error.message}`));
        console.log(chalk.yellow(`   Skipping this file and continuing...`));
        failedFiles++;
      }
    }
  }
  
  // Show download summary
  console.log(chalk.cyan('\n📦 Template Installation Summary:'));
  if (successfulFiles > 0) {
    console.log(chalk.green(`   ✓ ${successfulFiles} files downloaded successfully`));
  }
  if (skippedFiles > 0) {
    console.log(chalk.blue(`   ⏭️  ${skippedFiles} files skipped (already exist or not needed)`));
  }
  if (failedFiles > 0) {
    console.log(chalk.yellow(`   ⚠️  ${failedFiles} files failed to download (continuing anyway)`));
  }
  
  console.log(chalk.gray(`\n📚 Source: https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/tree/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.templatesPath}`));
  
  // Consider it successful if we got at least some files
  const hasEssentialFiles = successfulFiles > 0;
  if (hasEssentialFiles) {
    console.log(chalk.green('\n✅ Template installation completed successfully!'));
    if (failedFiles > 0) {
      console.log(chalk.yellow('   Some optional files were skipped due to rate limits or missing files.'));
      console.log(chalk.yellow('   This is normal and your Claude Code configuration should work properly.'));
    }
  }
  
  return hasEssentialFiles;
}

async function runPostInstallationValidation(targetDir, templateConfig) {
  const inquirer = require('inquirer');
  const { spawn } = require('child_process');
  
  console.log(chalk.cyan('\n🔍 Post-Installation Validation'));
  console.log(chalk.gray('Claude Code can now review the installed configuration to ensure everything is properly set up.'));
  
  try {
    const { runValidation } = await inquirer.prompt([{
      type: 'confirm',
      name: 'runValidation',
      message: 'Would you like Claude Code to review and validate the installation?',
      default: true,
      prefix: chalk.blue('🤖')
    }]);
    
    if (!runValidation) {
      console.log(chalk.yellow('⏭️  Skipping validation. You can run "claude" anytime to review your configuration.'));
      return;
    }
    
    console.log(chalk.blue('\n🚀 Starting Claude Code validation...'));
    console.log(chalk.gray('This will review all installed files and configurations.\n'));
    
    // Prepare validation prompt for Claude
    const validationPrompt = createValidationPrompt(templateConfig);
    
    // Run claude command with validation prompt as a task
    // Escape quotes in the prompt and create proper shell command
    const escapedPrompt = validationPrompt.replace(/"/g, '\\"');
    const claudeCommand = `claude "${escapedPrompt}"`;
    
    const claudeProcess = spawn('sh', ['-c', claudeCommand], {
      cwd: targetDir,
      stdio: 'inherit'
    });
    
    claudeProcess.on('error', (error) => {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow('\n⚠️  Claude Code CLI not found in PATH.'));
        console.log(chalk.blue('💡 To run validation manually later, use: claude "Review the Claude Code configuration and validate all installed files"'));
      } else {
        console.error(chalk.red('Error running Claude Code validation:'), error.message);
      }
    });
    
    claudeProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ Claude Code validation completed successfully!'));
      } else if (code !== null) {
        console.log(chalk.yellow(`\n⚠️  Claude Code validation exited with code ${code}`));
      }
    });
    
  } catch (error) {
    console.error(chalk.red('Error during validation setup:'), error.message);
    console.log(chalk.blue('💡 You can run validation manually later with: claude "Review the Claude Code configuration"'));
  }
}

function createValidationPrompt(templateConfig) {
  const language = templateConfig.language || 'unknown';
  const framework = templateConfig.framework || 'none';
  
  return `Validate Claude Code Templates installation for this ${language}${framework !== 'none' ? ` ${framework}` : ''} project. 1) Check project structure (package.json, src/, etc.) 2) Review CLAUDE.md, .claude/settings.json, .claude/commands/ 3) Compare with actual project dependencies 4) Suggest specific improvements. Make configuration match this project's actual setup.`;
}

async function processSettingsFile(sourcePath, destPath, templateConfig) {
  try {
    // Read the original settings file
    const originalSettings = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
    
    // If hooks are selected, filter them
    if (templateConfig.selectedHooks && templateConfig.selectedHooks.length > 0) {
      const availableHooks = getHooksForLanguage(templateConfig.language);
      const filteredSettings = filterHooksBySelection(
        originalSettings,
        templateConfig.selectedHooks,
        availableHooks
      );
      
      // Write the filtered settings
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, JSON.stringify(filteredSettings, null, 2));
    } else {
      // No hooks selected, copy original without hooks
      const settingsWithoutHooks = { ...originalSettings };
      delete settingsWithoutHooks.hooks;
      
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, JSON.stringify(settingsWithoutHooks, null, 2));
    }
  } catch (error) {
    console.error(chalk.red(`Failed to process settings file: ${error.message}`));
    // Fallback to copying original file
    await fs.copy(sourcePath, destPath);
  }
}

async function processMCPFile(sourcePath, destPath, templateConfig) {
  try {
    // Read the original MCP file
    const originalMCPData = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
    
    // If MCPs are selected, filter them
    if (templateConfig.selectedMCPs && templateConfig.selectedMCPs.length > 0) {
      const availableMCPs = getMCPsForLanguage(templateConfig.language);
      const filteredMCPData = filterMCPsBySelection(
        originalMCPData,
        templateConfig.selectedMCPs,
        availableMCPs
      );
      
      // Write the filtered MCP data
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, JSON.stringify(filteredMCPData, null, 2));
    } else {
      // No MCPs selected, create empty MCP file
      const emptyMCPData = { mcpServers: {} };
      
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, JSON.stringify(emptyMCPData, null, 2));
    }
  } catch (error) {
    console.error(chalk.red(`Failed to process MCP file: ${error.message}`));
    // Fallback to copying original file
    await fs.copy(sourcePath, destPath);
  }
}

async function ensureDirectoryExists(dirPath) {
  try {
    await fs.ensureDir(dirPath);
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to create directory ${dirPath}:`), error.message);
    return false;
  }
}

async function checkWritePermissions(targetDir) {
  try {
    const testFile = path.join(targetDir, '.claude-test-write');
    await fs.writeFile(testFile, 'test');
    await fs.remove(testFile);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  copyTemplateFiles,
  ensureDirectoryExists,
  checkWritePermissions,
  processSettingsFile,
  processMCPFile,
  runPostInstallationValidation
};
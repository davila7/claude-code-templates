const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

async function copyTemplateFiles(templateConfig, targetDir) {
  const templateDir = path.join(__dirname, '../templates');
  
  // Check if CLAUDE.md already exists
  const claudeFile = path.join(targetDir, 'CLAUDE.md');
  if (await fs.pathExists(claudeFile)) {
    // Create backup
    const backupFile = path.join(targetDir, 'CLAUDE.md.backup');
    await fs.copy(claudeFile, backupFile);
    console.log(chalk.yellow(`📋 Existing CLAUDE.md backed up to CLAUDE.md.backup`));
  }
  
  // Check if .claude directory already exists
  const claudeDir = path.join(targetDir, '.claude');
  if (await fs.pathExists(claudeDir)) {
    // Create backup
    const backupDir = path.join(targetDir, '.claude.backup');
    await fs.copy(claudeDir, backupDir);
    console.log(chalk.yellow(`📁 Existing .claude directory backed up to .claude.backup`));
  }
  
  // Copy base files and framework-specific files
  for (const file of templateConfig.files) {
    const sourcePath = path.join(templateDir, file.source);
    const destPath = path.join(targetDir, file.destination);
    
    try {
      // Handle framework-specific command files specially
      if (file.source.includes('.claude/commands') && file.source.includes('examples/')) {
        // This is a framework-specific commands directory - merge with existing commands
        await fs.ensureDir(destPath);
        
        // Copy framework-specific commands to the commands directory
        const frameworkFiles = await fs.readdir(sourcePath);
        for (const frameworkFile of frameworkFiles) {
          const srcFile = path.join(sourcePath, frameworkFile);
          const destFile = path.join(destPath, frameworkFile);
          await fs.copy(srcFile, destFile, { overwrite: true });
        }
        
        console.log(chalk.green(`✓ Copied framework commands ${file.source} → ${file.destination}`));
      } else if (file.source.includes('.claude') && !file.source.includes('examples/')) {
        // This is base .claude directory - copy it but handle commands specially
        await fs.copy(sourcePath, destPath, { 
          overwrite: true,
          filter: (src) => {
            // Skip the commands directory itself - we'll handle it separately
            return !src.endsWith('.claude/commands');
          }
        });
        
        // Now handle base commands specifically
        const baseCommandsPath = path.join(sourcePath, 'commands');
        const destCommandsPath = path.join(destPath, 'commands');
        
        if (await fs.pathExists(baseCommandsPath)) {
          await fs.ensureDir(destCommandsPath);
          
          // Copy base commands, but exclude framework-specific ones that were moved
          const baseCommands = await fs.readdir(baseCommandsPath);
          const excludeCommands = ['react-component.md', 'route.md', 'api-endpoint.md']; // Commands moved to framework dirs
          
          for (const baseCommand of baseCommands) {
            if (!excludeCommands.includes(baseCommand)) {
              const srcFile = path.join(baseCommandsPath, baseCommand);
              const destFile = path.join(destCommandsPath, baseCommand);
              await fs.copy(srcFile, destFile, { overwrite: true });
            }
          }
        }
        
        console.log(chalk.green(`✓ Copied base configuration and commands ${file.source} → ${file.destination}`));
      } else {
        // Copy regular files (CLAUDE.md, settings.json, etc.)
        await fs.copy(sourcePath, destPath, { 
          overwrite: true,
          filter: (src) => {
            // Skip commands directory during regular copy - we handle them above
            return !src.includes('.claude/commands');
          }
        });
        console.log(chalk.green(`✓ Copied ${file.source} → ${file.destination}`));
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to copy ${file.source}:`), error.message);
      throw error;
    }
  }
  
  // Copy selected commands individually
  if (templateConfig.selectedCommands && templateConfig.selectedCommands.length > 0) {
    const commandsDir = path.join(targetDir, '.claude', 'commands');
    await fs.ensureDir(commandsDir);
    
    for (const command of templateConfig.selectedCommands) {
      try {
        const commandFileName = `${command.name}.md`;
        const destPath = path.join(commandsDir, commandFileName);
        
        await fs.copy(command.filePath, destPath);
        console.log(chalk.green(`✓ Added command: ${command.displayName}`));
      } catch (error) {
        console.error(chalk.red(`✗ Failed to copy command ${command.name}:`), error.message);
        // Don't throw - continue with other commands
      }
    }
    
    console.log(chalk.cyan(`📋 Installed ${templateConfig.selectedCommands.length} commands`));
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
  checkWritePermissions
};
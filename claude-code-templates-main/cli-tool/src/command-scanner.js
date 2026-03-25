const fs = require('fs-extra');
const path = require('path');

/**
 * Scans and returns available commands for a given language
 * @param {string} language - The language template to scan
 * @returns {Array} Array of available commands with metadata
 */
function getAvailableCommands(language) {
  const templatesDir = path.join(__dirname, '../templates');
  const languageDir = path.join(templatesDir, language);
  
  // Check if language directory exists
  if (!fs.existsSync(languageDir)) {
    return [];
  }
  
  const commands = [];
  
  // Scan main .claude/commands directory
  const mainCommandsDir = path.join(languageDir, '.claude', 'commands');
  if (fs.existsSync(mainCommandsDir)) {
    const mainCommands = scanCommandsInDirectory(mainCommandsDir, 'core');
    commands.push(...mainCommands);
  }
  
  // Scan framework-specific commands in examples
  const frameworksDir = path.join(languageDir, 'examples');
  if (fs.existsSync(frameworksDir)) {
    const frameworkDirs = fs.readdirSync(frameworksDir).filter(dir => {
      return fs.statSync(path.join(frameworksDir, dir)).isDirectory();
    });
    
    frameworkDirs.forEach(framework => {
      const frameworkCommandsDir = path.join(frameworksDir, framework, '.claude', 'commands');
      if (fs.existsSync(frameworkCommandsDir)) {
        const frameworkCommands = scanCommandsInDirectory(frameworkCommandsDir, framework);
        commands.push(...frameworkCommands);
      }
    });
  }
  
  // Remove duplicates based on command name
  const uniqueCommands = commands.reduce((acc, command) => {
    const existing = acc.find(c => c.name === command.name);
    if (!existing) {
      acc.push(command);
    } else {
      // If duplicate, prefer core commands over framework-specific ones
      if (command.category === 'core' && existing.category !== 'core') {
        const index = acc.findIndex(c => c.name === command.name);
        acc[index] = command;
      }
    }
    return acc;
  }, []);
  
  return uniqueCommands.sort((a, b) => {
    // Sort by category first (core first), then by name
    if (a.category !== b.category) {
      return a.category === 'core' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Scans a directory for command files and returns command metadata
 * @param {string} commandsDir - Directory to scan
 * @param {string} category - Category of commands (core, react-app, node-api, etc.)
 * @returns {Array} Array of command objects
 */
function scanCommandsInDirectory(commandsDir, category) {
  const commands = [];
  
  try {
    const files = fs.readdirSync(commandsDir);
    
    files.forEach(file => {
      if (path.extname(file) === '.md') {
        const commandName = path.basename(file, '.md');
        const filePath = path.join(commandsDir, file);
        
        // Read the command file to extract metadata
        const content = fs.readFileSync(filePath, 'utf8');
        const metadata = parseCommandMetadata(content, commandName);
        
        commands.push({
          name: commandName,
          displayName: createShortDisplayName(commandName, metadata.title),
          description: createShortDescription(metadata.description, commandName),
          category: category,
          filePath: filePath,
          checked: metadata.defaultChecked || false
        });
      }
    });
  } catch (error) {
    console.warn(`Warning: Could not scan commands in ${commandsDir}:`, error.message);
  }
  
  return commands;
}

/**
 * Parses command metadata from markdown file content
 * @param {string} content - The markdown content
 * @param {string} commandName - The command name
 * @returns {Object} Parsed metadata
 */
function parseCommandMetadata(content, commandName) {
  const metadata = {
    title: null,
    description: null,
    defaultChecked: false
  };
  
  const lines = content.split('\n');
  
  // Extract title from first heading
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      metadata.title = line.substring(2).trim();
      break;
    }
  }
  
  // Extract description from purpose section or first paragraph
  const purposeMatch = content.match(/## Purpose\s*\n\s*(.+?)(?=\n\n|\n##|$)/s);
  if (purposeMatch) {
    metadata.description = purposeMatch[1].trim().replace(/\n/g, ' ');
  } else {
    // Try to find first paragraph after title
    const paragraphMatch = content.match(/^#[^\n]*\n\s*\n(.+?)(?=\n\n|\n##|$)/s);
    if (paragraphMatch) {
      metadata.description = paragraphMatch[1].trim().replace(/\n/g, ' ');
    }
  }
  
  // Determine default checked state (core commands usually checked by default)
  const coreCommands = ['test', 'lint', 'debug', 'refactor'];
  metadata.defaultChecked = coreCommands.includes(commandName);
  
  return metadata;
}

/**
 * Creates a short display name from command name for better console display
 * @param {string} commandName - The command name
 * @param {string} title - The full title from markdown
 * @returns {string} Short display name
 */
function createShortDisplayName(commandName, title) {
  // Define mapping for common command names to short display names
  const shortNames = {
    'api-endpoint': 'API Endpoint',
    'debug': 'Debug',
    'lint': 'Lint',
    'test': 'Test',
    'refactor': 'Refactor',
    'typescript-migrate': 'TS Migration',
    'npm-scripts': 'NPM Scripts',
    'component': 'Component',
    'hooks': 'Hooks',
    'state-management': 'State Mgmt',
    'middleware': 'Middleware',
    'route': 'Route',
    'database': 'Database',
    'components': 'Components',
    'services': 'Services',
    'composables': 'Composables',
    'django-model': 'Django Model',
    'flask-route': 'Flask Route',
    'git-workflow': 'Git Workflow',
    'project-setup': 'Project Setup'
  };
  
  // Return predefined short name if available
  if (shortNames[commandName]) {
    return shortNames[commandName];
  }
  
  // If title is short enough, use it
  if (title && title.length <= 15) {
    return title;
  }
  
  // Create short name from command name
  return commandName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Creates a short description for better console display
 * @param {string} description - The full description
 * @param {string} commandName - The command name
 * @returns {string} Short description
 */
function createShortDescription(description, commandName) {
  // Define short descriptions for common commands
  const shortDescriptions = {
    'api-endpoint': 'Generate API endpoint',
    'debug': 'Debug issues',
    'lint': 'Fix linting issues',
    'test': 'Run tests',
    'refactor': 'Refactor code',
    'typescript-migrate': 'Migrate to TypeScript',
    'npm-scripts': 'Manage NPM scripts',
    'component': 'Create component',
    'hooks': 'React hooks helper',
    'state-management': 'Manage state',
    'middleware': 'Create middleware',
    'route': 'Create route',
    'database': 'Database operations',
    'components': 'Create components',
    'services': 'Create services',
    'composables': 'Create composables',
    'django-model': 'Create Django model',
    'flask-route': 'Create Flask route',
    'git-workflow': 'Git workflow helper',
    'project-setup': 'Setup project'
  };
  
  // Return predefined short description if available
  if (shortDescriptions[commandName]) {
    return shortDescriptions[commandName];
  }
  
  // If description exists and is short enough, use it
  if (description && description.length <= 40) {
    return description;
  }
  
  // Truncate long descriptions
  if (description && description.length > 40) {
    return description.substring(0, 37) + '...';
  }
  
  // Fallback to command name
  return `${commandName.replace('-', ' ')} command`;
}

/**
 * Get commands available for a specific language and framework combination
 * @param {string} language - The language template
 * @param {string} framework - The framework (optional)
 * @returns {Array} Array of available commands
 */
function getCommandsForLanguageAndFramework(language, framework = null) {
  const allCommands = getAvailableCommands(language);
  
  if (!framework || framework === 'none') {
    // Return only core commands
    return allCommands.filter(cmd => cmd.category === 'core');
  }
  
  // Return core commands + framework-specific commands
  return allCommands.filter(cmd => 
    cmd.category === 'core' || 
    cmd.category === framework ||
    cmd.category === `${framework}-app`
  );
}

module.exports = {
  getAvailableCommands,
  getCommandsForLanguageAndFramework,
  scanCommandsInDirectory,
  parseCommandMetadata,
  createShortDisplayName,
  createShortDescription
};
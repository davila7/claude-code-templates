const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * Get all available agents from the templates directory structure
 * @returns {Array} Array of agent objects with name, description, and color
 */
function getAvailableAgents() {
  const agents = [];
  
  try {
    // Scan all language directories
    const languageDirs = fs.readdirSync(TEMPLATES_DIR)
      .filter(dir => {
        const dirPath = path.join(TEMPLATES_DIR, dir);
        return fs.statSync(dirPath).isDirectory() && dir !== 'common';
      });
    
    for (const langDir of languageDirs) {
      const frameworksPath = path.join(TEMPLATES_DIR, langDir, 'examples');
      
      if (fs.existsSync(frameworksPath)) {
        const frameworks = fs.readdirSync(frameworksPath)
          .filter(dir => {
            const dirPath = path.join(frameworksPath, dir);
            return fs.statSync(dirPath).isDirectory();
          });
        
        for (const framework of frameworks) {
          const agentsPath = path.join(frameworksPath, framework, 'agents');
          
          if (fs.existsSync(agentsPath)) {
            const agentFiles = fs.readdirSync(agentsPath)
              .filter(file => file.endsWith('.md'));
            
            for (const file of agentFiles) {
              const filePath = path.join(agentsPath, file);
              const content = fs.readFileSync(filePath, 'utf8');
              const agent = parseAgentFile(content, file);
              
              if (agent) {
                agent.language = langDir;
                agent.framework = framework;
                agent.filePath = filePath;
                agents.push(agent);
              }
            }
          }
        }
      }
    }
    
    return agents;
  } catch (error) {
    console.log(chalk.yellow('⚠️  No agents templates found'));
    return [];
  }
}

/**
 * Parse agent markdown file to extract frontmatter
 * @param {string} content - File content
 * @param {string} filename - File name
 * @returns {Object|null} Agent object or null if parsing fails
 */
function parseAgentFile(content, filename) {
  try {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const lines = frontmatter.split('\n');
    const agent = { filename };

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        agent[key.trim()] = value;
      }
    }

    // Extract description without examples for display
    if (agent.description) {
      const shortDesc = agent.description.split('Examples:')[0].trim();
      agent.shortDescription = shortDesc;
    }

    return agent;
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Failed to parse agent file: ${filename}`));
    return null;
  }
}

/**
 * Get agents that are relevant for a specific language/framework
 * @param {string} language - Programming language
 * @param {string} framework - Framework (optional)
 * @returns {Array} Array of relevant agents
 */
function getAgentsForLanguageAndFramework(language, framework) {
  const allAgents = getAvailableAgents();
  
  // Filter agents based on language and framework
  return allAgents.filter(agent => {
    // First check exact language match
    if (agent.language !== language) {
      return false;
    }
    
    // If framework is specified and not 'none', check framework match
    if (framework && framework !== 'none') {
      // Extract framework name from framework path (e.g., 'react-app' -> 'react')
      const frameworkName = framework.includes('-') ? framework.split('-')[0] : framework;
      const agentFrameworkName = agent.framework.includes('-') ? agent.framework.split('-')[0] : agent.framework;
      
      return agentFrameworkName.toLowerCase().includes(frameworkName.toLowerCase());
    }
    
    // If no specific framework, return all agents for this language
    return true;
  });
}

/**
 * Install selected agents to the project's .claude/agents directory
 * @param {Array} selectedAgents - Array of agent names to install
 * @param {string} projectPath - Project directory path
 * @returns {Promise<boolean>} Success status
 */
async function installAgents(selectedAgents, projectPath = process.cwd()) {
  try {
    const claudeDir = path.join(projectPath, '.claude');
    const agentsDir = path.join(claudeDir, 'agents');
    
    // Create .claude/agents directory if it doesn't exist
    await fs.ensureDir(agentsDir);
    
    let installedCount = 0;
    const allAgents = getAvailableAgents();
    
    for (const agentName of selectedAgents) {
      // Find the agent by name in the available agents
      const agent = allAgents.find(a => a.name === agentName);
      
      if (agent && agent.filePath) {
        const targetFile = path.join(agentsDir, `${agentName}.md`);
        
        if (await fs.pathExists(agent.filePath)) {
          await fs.copy(agent.filePath, targetFile);
          installedCount++;
          console.log(chalk.green(`✓ Installed agent: ${agentName} (${agent.language}/${agent.framework})`));
        } else {
          console.log(chalk.yellow(`⚠️  Agent source file not found: ${agent.filePath}`));
        }
      } else {
        console.log(chalk.yellow(`⚠️  Agent not found: ${agentName}`));
      }
    }
    
    if (installedCount > 0) {
      console.log(chalk.green(`\n🎉 Successfully installed ${installedCount} agent(s) to .claude/agents/`));
      console.log(chalk.blue('   You can now use these agents in your Claude Code conversations!'));
      return true;
    } else {
      console.log(chalk.yellow('⚠️  No agents were installed'));
      return false;
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to install agents:'), error.message);
    return false;
  }
}

/**
 * Check if project already has agents installed
 * @param {string} projectPath - Project directory path
 * @returns {Promise<Array>} Array of installed agent names
 */
async function getInstalledAgents(projectPath = process.cwd()) {
  try {
    const agentsDir = path.join(projectPath, '.claude', 'agents');
    
    if (!(await fs.pathExists(agentsDir))) {
      return [];
    }
    
    const agentFiles = await fs.readdir(agentsDir);
    return agentFiles
      .filter(file => file.endsWith('.md'))
      .map(file => path.basename(file, '.md'));
      
  } catch (error) {
    return [];
  }
}

/**
 * Format agent choices for inquirer prompt
 * @param {Array} agents - Array of agent objects
 * @param {Array} installedAgents - Array of already installed agent names
 * @returns {Array} Formatted choices for inquirer
 */
function formatAgentChoices(agents, installedAgents = []) {
  return agents.map(agent => {
    const isInstalled = installedAgents.includes(agent.name);
    const colorFn = getColorFunction(agent.color);
    
    const name = isInstalled 
      ? `${colorFn(agent.name)} ${chalk.dim('(already installed)')}`
      : colorFn(agent.name);
    
    const description = agent.shortDescription || agent.description || 'No description available';
    // Truncate description if too long
    const truncatedDesc = description.length > 80 
      ? description.substring(0, 80) + '...' 
      : description;
    
    return {
      name: `${name}\n  ${chalk.dim(truncatedDesc)}`,
      value: agent.name,
      short: agent.name,
      disabled: isInstalled ? 'Already installed' : false
    };
  });
}

/**
 * Get chalk color function based on color name
 * @param {string} colorName - Color name
 * @returns {Function} Chalk color function
 */
function getColorFunction(colorName) {
  const colorMap = {
    red: chalk.red,
    green: chalk.green,
    yellow: chalk.yellow,
    blue: chalk.blue,
    magenta: chalk.magenta,
    cyan: chalk.cyan,
    white: chalk.white,
    gray: chalk.gray,
    grey: chalk.gray
  };
  
  return colorMap[colorName] || chalk.white;
}

module.exports = {
  getAvailableAgents,
  getAgentsForLanguageAndFramework,
  installAgents,
  getInstalledAgents,
  formatAgentChoices
};
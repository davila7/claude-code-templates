const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Component data cache to avoid repeated file reads
 */
let componentCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load and parse component data from marketplace.json
 * @param {Object} options - Loading options
 * @param {boolean} options.forceRefresh - Force cache refresh
 * @returns {Promise<Object>} Normalized component data
 */
async function loadComponentData(options = {}) {
  const now = Date.now();
  
  // Return cached data if valid
  if (!options.forceRefresh && componentCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
    return componentCache;
  }

  try {
    // Load marketplace.json from project root
    const marketplacePath = path.join(__dirname, '../../..', '.claude-plugin', 'marketplace.json');
    
    if (!await fs.pathExists(marketplacePath)) {
      throw new Error('marketplace.json not found');
    }

    const marketplaceData = await fs.readJson(marketplacePath);
    
    // Normalize and structure the data
    const components = {
      agents: [],
      commands: [],
      mcps: [],
      skills: [],
      plugins: marketplaceData.plugins || []
    };

    // Extract components from plugins
    for (const plugin of marketplaceData.plugins || []) {
      // Process agents
      if (plugin.agents) {
        for (const agentPath of plugin.agents) {
          const agentInfo = await extractComponentInfo(agentPath, 'agent', plugin);
          if (agentInfo) {
            components.agents.push(agentInfo);
          }
        }
      }

      // Process commands
      if (plugin.commands) {
        for (const commandPath of plugin.commands) {
          const commandInfo = await extractComponentInfo(commandPath, 'command', plugin);
          if (commandInfo) {
            components.commands.push(commandInfo);
          }
        }
      }

      // Process MCPs
      if (plugin.mcpServers) {
        for (const mcpPath of plugin.mcpServers) {
          const mcpInfo = await extractComponentInfo(mcpPath, 'mcp', plugin);
          if (mcpInfo) {
            components.mcps.push(mcpInfo);
          }
        }
      }
    }

    // Load skills separately (they're in a different location)
    const skillsDir = path.join(__dirname, '../../components/skills');
    if (await fs.pathExists(skillsDir)) {
      const skillFiles = await fs.readdir(skillsDir);
      for (const skillFile of skillFiles) {
        if (skillFile.endsWith('.md')) {
          const skillInfo = await extractSkillInfo(path.join(skillsDir, skillFile));
          if (skillInfo) {
            components.skills.push(skillInfo);
          }
        }
      }
    }

    // Update cache
    componentCache = components;
    cacheTimestamp = now;

    return components;

  } catch (error) {
    console.error(chalk.red('Error loading component data:'), error.message);
    throw error;
  }
}

/**
 * Extract component information from file path
 * @param {string} componentPath - Path to component file
 * @param {string} type - Component type (agent, command, mcp)
 * @param {Object} plugin - Parent plugin data
 * @returns {Promise<Object|null>} Component information
 */
async function extractComponentInfo(componentPath, type, plugin) {
  try {
    // Extract component name from path
    const fileName = path.basename(componentPath, path.extname(componentPath));
    const pathParts = componentPath.split('/');
    const category = pathParts[pathParts.length - 2] || 'general';

    // Build component ID (category/name format for GitHub)
    const componentId = `${category}/${fileName}`;

    // Create component object
    const component = {
      id: componentId,
      name: fileName,
      displayName: formatDisplayName(fileName),
      description: plugin.description || '',
      category: category,
      keywords: plugin.keywords || [],
      path: componentPath,
      type: type,
      plugin: plugin.name,
      projectTypes: determineProjectTypes(plugin.keywords),
      essential: false, // TODO: Add logic to determine essential components
      popularity: 'medium' // TODO: Integrate with analytics
    };

    return component;

  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not extract info from ${componentPath}`));
    return null;
  }
}

/**
 * Extract skill information from markdown file
 * @param {string} skillPath - Path to skill file
 * @returns {Promise<Object|null>} Skill information
 */
async function extractSkillInfo(skillPath) {
  try {
    const fileName = path.basename(skillPath, '.md');
    const content = await fs.readFile(skillPath, 'utf8');

    // Extract metadata from frontmatter or content
    const nameMatch = content.match(/^#\s+(.+)$/m);
    const descMatch = content.match(/^>\s+(.+)$/m);

    const skill = {
      id: fileName,
      name: fileName,
      displayName: nameMatch ? nameMatch[1] : formatDisplayName(fileName),
      description: descMatch ? descMatch[1] : 'Claude Code skill',
      category: 'skills',
      keywords: extractKeywordsFromContent(content),
      path: skillPath,
      type: 'skill',
      plugin: 'core',
      projectTypes: ['all'],
      essential: false,
      popularity: 'medium'
    };

    return skill;

  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not extract skill info from ${skillPath}`));
    return null;
  }
}

/**
 * Format component name for display
 * @param {string} name - Component file name
 * @returns {string} Formatted display name
 */
function formatDisplayName(name) {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Determine project types from keywords
 * @param {string[]} keywords - Component keywords
 * @returns {string[]} Project types
 */
function determineProjectTypes(keywords) {
  const projectTypeMap = {
    'nextjs': ['nextjs'],
    'react': ['react', 'nextjs'],
    'vue': ['vue'],
    'angular': ['angular'],
    'python': ['python', 'django', 'flask', 'fastapi'],
    'django': ['django'],
    'flask': ['flask'],
    'fastapi': ['fastapi'],
    'nodejs': ['nodejs'],
    'typescript': ['typescript'],
    'javascript': ['javascript']
  };

  const types = new Set(['all']); // All components work with 'all' by default

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (projectTypeMap[lowerKeyword]) {
      projectTypeMap[lowerKeyword].forEach(type => types.add(type));
    }
  }

  return Array.from(types);
}

/**
 * Extract keywords from content
 * @param {string} content - File content
 * @returns {string[]} Extracted keywords
 */
function extractKeywordsFromContent(content) {
  // Simple keyword extraction - can be enhanced
  const keywords = new Set();
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
  
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.includes(word));

  // Take top 10 most frequent words
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  const sorted = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return sorted;
}

/**
 * Get all components of a specific type
 * @param {string} type - Component type (agent, command, mcp, skill)
 * @param {Object} options - Loading options
 * @returns {Promise<Array>} Components of specified type
 */
async function getComponentsByType(type, options = {}) {
  const data = await loadComponentData(options);
  
  const typeMap = {
    'agent': 'agents',
    'agents': 'agents',
    'command': 'commands',
    'commands': 'commands',
    'mcp': 'mcps',
    'mcps': 'mcps',
    'skill': 'skills',
    'skills': 'skills'
  };

  const key = typeMap[type.toLowerCase()];
  return key ? data[key] : [];
}

/**
 * Get component by ID
 * @param {string} componentId - Component ID
 * @param {Object} options - Loading options
 * @returns {Promise<Object|null>} Component data or null
 */
async function getComponentById(componentId, options = {}) {
  const data = await loadComponentData(options);
  
  // Search across all component types
  for (const type of ['agents', 'commands', 'mcps', 'skills']) {
    const component = data[type].find(c => c.id === componentId || c.name === componentId);
    if (component) {
      return component;
    }
  }

  return null;
}

/**
 * Clear component cache
 */
function clearCache() {
  componentCache = null;
  cacheTimestamp = null;
}

module.exports = {
  loadComponentData,
  getComponentsByType,
  getComponentById,
  clearCache
};

const chalk = require('chalk');
const boxen = require('boxen');

/**
 * Component type icons and colors
 */
const COMPONENT_STYLES = {
  agents: {
    icon: '✨',
    color: chalk.magenta,
    label: 'AGENTS'
  },
  commands: {
    icon: '⚡',
    color: chalk.yellow,
    label: 'COMMANDS'
  },
  mcps: {
    icon: '🔌',
    color: chalk.blue,
    label: 'MCP SERVERS'
  },
  skills: {
    icon: '🎨',
    color: chalk.cyan,
    label: 'SKILLS'
  }
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength = 80) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format download count for display
 * @param {number} downloads - Download count
 * @returns {string} Formatted count
 */
function formatDownloads(downloads) {
  if (!downloads) return '0';
  if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}k`;
  }
  return downloads.toString();
}

/**
 * Display search results in terminal
 * @param {Object} results - Search results from search engine
 * @param {Object} options - Display options
 */
function displaySearchResults(results, options = {}) {
  const { showInstallCommand = true, compact = false } = options;

  console.log('');
  console.log(chalk.yellow(`🔍 Found ${results.total} component${results.total !== 1 ? 's' : ''} matching "${results.query}"`));
  console.log('');

  // Display each component type
  for (const [type, components] of Object.entries(results)) {
    if (type === 'total' || type === 'query' || components.length === 0) continue;

    const style = COMPONENT_STYLES[type];
    if (!style) continue;

    console.log(style.color.bold(`${style.label}:`));
    console.log('');

    for (const component of components) {
      displayComponent(component, style, { compact, showScore: options.showScore });
    }
  }

  // Show install command examples
  if (showInstallCommand && results.total > 0) {
    const firstResult = 
      results.agents[0] || 
      results.commands[0] || 
      results.mcps[0] || 
      results.skills[0];

    if (firstResult) {
      const installCmd = getInstallCommand(firstResult);
      console.log(chalk.gray('Install: ') + chalk.white(installCmd));
      console.log('');
    }
  }

  // No results message
  if (results.total === 0) {
    console.log(chalk.yellow('💡 No components found matching your search.'));
    console.log('');
    console.log(chalk.gray('Try:'));
    console.log(chalk.gray('  • Using different keywords'));
    console.log(chalk.gray('  • Removing filters'));
    console.log(chalk.gray('  • Running: npx cct --discover'));
    console.log('');
  }
}

/**
 * Display a single component
 * @param {Object} component - Component data
 * @param {Object} style - Component style
 * @param {Object} options - Display options
 */
function displayComponent(component, style, options = {}) {
  const { compact = false, showScore = false } = options;

  // Component header with icon and name
  const header = `${style.icon} ${chalk.white.bold(component.displayName || component.name)}`;
  console.log(header);

  // Description (indented)
  if (!compact && component.description) {
    const description = truncate(component.description, 70);
    console.log(chalk.gray(`   ${description}`));
  }

  // Metadata line (indented)
  const metadata = [];
  
  if (component.category && component.category !== 'general') {
    metadata.push(chalk.blue(`Category: ${component.category}`));
  }

  if (component.downloads) {
    metadata.push(chalk.orange(`${formatDownloads(component.downloads)} downloads`));
  }

  if (component.trending && component.trending > 0) {
    metadata.push(chalk.green(`↑ ${component.trending}%`));
  }

  if (showScore && component.score) {
    metadata.push(chalk.gray(`Score: ${component.score.toFixed(1)}`));
  }

  if (metadata.length > 0) {
    console.log(chalk.gray(`   ${metadata.join(' | ')}`));
  }

  console.log('');
}

/**
 * Get install command for a component
 * @param {Object} component - Component data
 * @returns {string} Install command
 */
function getInstallCommand(component) {
  const typeMap = {
    'agents': '--agent',
    'commands': '--command',
    'mcps': '--mcp',
    'skills': '--skill'
  };

  const flag = typeMap[component.componentType] || '--agent';
  return `npx cct ${flag} ${component.id}`;
}

/**
 * Display component details (full view)
 * @param {Object} component - Component data
 */
function displayComponentDetails(component) {
  const style = COMPONENT_STYLES[component.componentType] || COMPONENT_STYLES.agents;

  console.log('');
  console.log(boxen(
    `${style.icon} ${chalk.bold(component.displayName || component.name)}\n\n` +
    `${chalk.gray(component.description)}\n\n` +
    `${chalk.cyan('Category:')} ${component.category}\n` +
    `${chalk.cyan('Type:')} ${component.componentType}\n` +
    `${chalk.cyan('Plugin:')} ${component.plugin}\n` +
    (component.keywords && component.keywords.length > 0 
      ? `${chalk.cyan('Keywords:')} ${component.keywords.join(', ')}\n` 
      : '') +
    (component.projectTypes && component.projectTypes.length > 0 
      ? `${chalk.cyan('Project Types:')} ${component.projectTypes.join(', ')}\n` 
      : ''),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));

  console.log(chalk.white('Install:'));
  console.log(chalk.green(`  ${getInstallCommand(component)}`));
  console.log('');
}

/**
 * Display trending components
 * @param {Array} components - Trending components
 * @param {string} category - Category filter
 */
function displayTrending(components, category = null) {
  console.log('');
  console.log(chalk.yellow.bold(`📈 Trending ${category ? category.toUpperCase() : 'Components'} (Last 7 days)`));
  console.log('');

  if (components.length === 0) {
    console.log(chalk.yellow('💡 No trending data available yet.'));
    console.log(chalk.gray('   Components will appear here as download data is collected.'));
    console.log('');
    return;
  }

  components.forEach((component, index) => {
    const style = COMPONENT_STYLES[component.componentType] || COMPONENT_STYLES.agents;
    const rank = `${index + 1}.`;
    const trend = component.trending > 0 
      ? chalk.green.bold(`↑ ${component.trending}%`) 
      : chalk.gray('--');
    const downloads = component.downloads 
      ? chalk.gray(`| ${chalk.orange(formatDownloads(component.downloads) + ' downloads')}`)
      : '';
    const categoryInfo = component.category 
      ? chalk.gray(`| ${chalk.blue('Category: ' + component.category)}`)
      : '';

    console.log(`${rank} 🔥 ${chalk.white.bold(component.displayName || component.name)}`);
    console.log(`   ${trend} ${downloads} ${categoryInfo}`);
    console.log('');
  });
}

/**
 * Display popular components
 * @param {Array} components - Popular components
 * @param {string} category - Category filter
 */
function displayPopular(components, category = null) {
  console.log('');
  console.log(chalk.yellow.bold(`⭐ Most Popular ${category ? category.toUpperCase() : 'Components'} (All time)`));
  console.log('');

  if (components.length === 0) {
    console.log(chalk.yellow('💡 No download data available yet.'));
    console.log(chalk.gray('   Components will appear here as download data is collected.'));
    console.log('');
    return;
  }

  components.forEach((component, index) => {
    const style = COMPONENT_STYLES[component.componentType] || COMPONENT_STYLES.agents;
    const rank = `${index + 1}.`;
    const downloads = component.downloads 
      ? chalk.orange(`${formatDownloads(component.downloads)} downloads`)
      : chalk.gray('No data');

    console.log(`${rank} ${style.icon} ${chalk.white.bold(component.displayName || component.name)} ${chalk.gray('|')} ${downloads}`);
  });

  console.log('');
}

/**
 * Display discovery recommendations
 * @param {Object} recommendations - Recommendations object
 */
function displayDiscoveryRecommendations(recommendations) {
  console.log('');
  console.log(chalk.yellow.bold(`🎯 Recommended components for your ${recommendations.projectType} project:`));
  console.log('');

  // Essential components
  if (recommendations.essential && recommendations.essential.length > 0) {
    console.log(chalk.magenta.bold('ESSENTIAL (Auto-detected):'));
    console.log('');
    recommendations.essential.forEach(component => {
      const style = COMPONENT_STYLES[component.componentType] || COMPONENT_STYLES.agents;
      console.log(`✅ ${chalk.white.bold(component.displayName || component.name)} ${chalk.gray('- ' + truncate(component.description, 50))}`);
    });
    console.log('');
  }

  // Popular components
  if (recommendations.popular && recommendations.popular.length > 0) {
    console.log(chalk.magenta.bold('POPULAR:'));
    console.log('');
    recommendations.popular.forEach(component => {
      const style = COMPONENT_STYLES[component.componentType] || COMPONENT_STYLES.agents;
      const downloads = component.downloads ? chalk.orange(`(${formatDownloads(component.downloads)} downloads)`) : '';
      console.log(`⭐ ${chalk.white.bold(component.displayName || component.name)} ${downloads}`);
    });
    console.log('');
  }

  // Trending components
  if (recommendations.trending && recommendations.trending.length > 0) {
    console.log(chalk.magenta.bold('TRENDING THIS WEEK:'));
    console.log('');
    recommendations.trending.forEach(component => {
      const style = COMPONENT_STYLES[component.componentType] || COMPONENT_STYLES.agents;
      const trend = component.trending > 0 ? chalk.green(`(↑ ${component.trending}%)`) : '';
      console.log(`📈 ${chalk.white.bold(component.displayName || component.name)} ${trend}`);
    });
    console.log('');
  }

  // Install command
  if (recommendations.essential && recommendations.essential.length > 0) {
    console.log(chalk.gray('💡 Quick Install:'));
    console.log('');
    const installCommands = recommendations.essential.map(c => {
      const typeMap = {
        'agents': '--agent',
        'commands': '--command',
        'mcps': '--mcp',
        'skills': '--skill'
      };
      const flag = typeMap[c.componentType] || '--agent';
      return `${flag} ${c.id}`;
    });

    console.log(chalk.gray('# Install all essential components:'));
    console.log(chalk.white(`npx cct ${installCommands.join(' ')}`));
    console.log('');
  }
}

/**
 * Display search suggestions
 * @param {string[]} suggestions - Search suggestions
 */
function displaySearchSuggestions(suggestions) {
  if (suggestions.length === 0) return;

  console.log('');
  console.log(chalk.gray('Did you mean:'));
  suggestions.forEach(suggestion => {
    console.log(chalk.cyan(`  - ${suggestion}`));
  });
  console.log('');
}

module.exports = {
  displaySearchResults,
  displayComponentDetails,
  displayTrending,
  displayPopular,
  displayDiscoveryRecommendations,
  displaySearchSuggestions,
  getInstallCommand,
  COMPONENT_STYLES
};

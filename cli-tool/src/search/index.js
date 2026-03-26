/**
 * Search & Discovery Module
 * Main orchestrator for component search, discovery, and trending features
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');

const { searchComponents, getSearchSuggestions, getRelatedComponents } = require('./search-engine');
const { displaySearchResults, displayTrending, displayPopular, displayDiscoveryRecommendations, displayComponentDetails } = require('./display');
const { discoverComponents, getCategories, getComponentsByCategory } = require('./discovery');
const { getTrendingComponents, getPopularComponents, getComponentStats } = require('./trending');
const { trackingService } = require('../tracking-service');

/**
 * Execute search command
 * @param {string} query - Search query
 * @param {Object} options - Search options
 */
async function runSearch(query, options = {}) {
  const spinner = ora('Searching components...').start();

  try {
    // Track search usage
    trackingService.trackCommandExecution('search', {
      query,
      category: options.category || 'all',
      hasFilters: !!(options.category || options.projectType)
    });

    // Perform search
    const results = await searchComponents(query, {
      category: options.category,
      projectType: options.projectType,
      limit: options.limit || 20,
      minScore: options.minScore || 10
    });

    spinner.succeed(`Found ${results.total} component${results.total !== 1 ? 's' : ''}`);

    // Display results
    displaySearchResults(results, {
      showInstallCommand: true,
      compact: options.compact || false,
      showScore: options.verbose || false
    });

    // Offer to install if results found
    if (results.total > 0 && options.interactive) {
      await promptInstallFromSearch(results);
    }

    // Show suggestions if no results
    if (results.total === 0) {
      const suggestions = await getSearchSuggestions(query, 5);
      if (suggestions.length > 0) {
        console.log(chalk.yellow('Did you mean:'));
        suggestions.forEach(s => console.log(chalk.cyan(`  - ${s}`)));
        console.log('');
      }
    }

  } catch (error) {
    spinner.fail('Search failed');
    console.error(chalk.red('Error:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
  }
}

/**
 * Execute discovery command
 * @param {string} targetDir - Target directory
 * @param {Object} options - Discovery options
 */
async function runDiscovery(targetDir, options = {}) {
  const spinner = ora('Analyzing project...').start();

  try {
    // Track discovery usage
    trackingService.trackCommandExecution('discover', {
      projectType: options.projectType || 'auto-detect',
      targetDir: targetDir !== process.cwd() ? 'custom' : 'current'
    });

    // Discover components
    const discovery = await discoverComponents(targetDir, options);

    spinner.succeed(`Detected ${chalk.cyan(discovery.projectInfo.type)} project`);

    // Display recommendations
    displayDiscoveryRecommendations(discovery.recommendations);

    // Offer to install essentials
    if (options.interactive && discovery.recommendations.essential.length > 0) {
      await promptInstallEssentials(discovery.recommendations.essential);
    }

  } catch (error) {
    spinner.fail('Discovery failed');
    console.error(chalk.red('Error:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
  }
}

/**
 * Execute trending command
 * @param {Object} options - Trending options
 */
async function runTrending(options = {}) {
  const spinner = ora('Loading trending components...').start();

  try {
    // Track trending usage
    trackingService.trackCommandExecution('trending', {
      category: options.category || 'all',
      days: options.days || 7
    });

    // Get trending components
    const trending = await getTrendingComponents({
      category: options.category,
      limit: options.limit || 10,
      days: options.days || 7
    });

    spinner.succeed('Trending components loaded');

    // Display trending
    displayTrending(trending, options.category);

    // Show stats if verbose
    if (options.verbose) {
      const stats = await getComponentStats();
      console.log(chalk.gray('Total components:'), stats.total);
      console.log(chalk.gray('Total downloads:'), stats.totalDownloads);
      console.log('');
    }

  } catch (error) {
    spinner.fail('Failed to load trending');
    console.error(chalk.red('Error:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
  }
}

/**
 * Execute popular command
 * @param {Object} options - Popular options
 */
async function runPopular(options = {}) {
  const spinner = ora('Loading popular components...').start();

  try {
    // Track popular usage
    trackingService.trackCommandExecution('popular', {
      category: options.category || 'all'
    });

    // Get popular components
    const popular = await getPopularComponents({
      category: options.category,
      limit: options.limit || 10
    });

    spinner.succeed('Popular components loaded');

    // Display popular
    displayPopular(popular, options.category);

  } catch (error) {
    spinner.fail('Failed to load popular');
    console.error(chalk.red('Error:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
  }
}

/**
 * Execute interactive search
 * @param {Object} options - Interactive options
 */
async function runInteractiveSearch(options = {}) {
  try {
    console.log(chalk.bold.cyan('🔍 Interactive Component Search'));
    console.log('');

    // Get search query
    const { query } = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'What are you looking for?',
      validate: input => input.length > 0 || 'Please enter a search query'
    }]);

    // Get category filter
    const { category } = await inquirer.prompt([{
      type: 'list',
      name: 'category',
      message: 'Filter by type:',
      choices: [
        { name: 'All types', value: null },
        { name: 'Agents', value: 'agents' },
        { name: 'Commands', value: 'commands' },
        { name: 'MCP Servers', value: 'mcps' },
        { name: 'Skills', value: 'skills' }
      ]
    }]);

    // Run search with interactive mode
    await runSearch(query, {
      ...options,
      category,
      interactive: true
    });

  } catch (error) {
    if (error.isTtyError) {
      console.error(chalk.red('Interactive mode not supported in this environment'));
    } else {
      console.error(chalk.red('Error:'), error.message);
    }
  }
}

/**
 * Prompt user to install components from search results
 * @param {Object} results - Search results
 */
async function promptInstallFromSearch(results) {
  try {
    // Collect all components
    const allComponents = [
      ...results.agents,
      ...results.commands,
      ...results.mcps,
      ...results.skills
    ];

    if (allComponents.length === 0) return;

    // Create choices
    const choices = allComponents.map(component => ({
      name: `${component.displayName || component.name} (${component.componentType})`,
      value: component,
      short: component.name
    }));

    // Prompt for selection
    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: 'Select components to install:',
      choices,
      pageSize: 10
    }]);

    if (selected.length === 0) {
      console.log(chalk.yellow('No components selected'));
      return;
    }

    // Build install command
    const installParts = [];
    for (const component of selected) {
      const typeMap = {
        'agents': '--agent',
        'commands': '--command',
        'mcps': '--mcp',
        'skills': '--skill'
      };
      const flag = typeMap[component.componentType];
      installParts.push(`${flag} ${component.id}`);
    }

    const installCmd = `npx cct ${installParts.join(' ')}`;

    console.log('');
    console.log(chalk.green('Install command:'));
    console.log(chalk.white(installCmd));
    console.log('');

    // Ask to execute
    const { execute } = await inquirer.prompt([{
      type: 'confirm',
      name: 'execute',
      message: 'Execute installation now?',
      default: true
    }]);

    if (execute) {
      // TODO: Execute installation
      console.log(chalk.blue('Installing components...'));
      console.log(chalk.gray('(Installation integration coming soon)'));
    }

  } catch (error) {
    // User cancelled
    if (error.isTtyError) {
      console.error(chalk.red('Interactive mode not supported'));
    }
  }
}

/**
 * Prompt user to install essential components
 * @param {Array} essentials - Essential components
 */
async function promptInstallEssentials(essentials) {
  try {
    const { install } = await inquirer.prompt([{
      type: 'confirm',
      name: 'install',
      message: `Install ${essentials.length} essential component${essentials.length !== 1 ? 's' : ''}?`,
      default: true
    }]);

    if (install) {
      // Build install command
      const installParts = essentials.map(component => {
        const typeMap = {
          'agents': '--agent',
          'commands': '--command',
          'mcps': '--mcp',
          'skills': '--skill'
        };
        const flag = typeMap[component.componentType];
        return `${flag} ${component.id}`;
      });

      const installCmd = `npx cct ${installParts.join(' ')}`;

      console.log('');
      console.log(chalk.green('Install command:'));
      console.log(chalk.white(installCmd));
      console.log('');

      // TODO: Execute installation
      console.log(chalk.blue('Installing components...'));
      console.log(chalk.gray('(Installation integration coming soon)'));
    }

  } catch (error) {
    // User cancelled
  }
}

/**
 * Show component categories
 * @param {Object} options - Options
 */
async function showCategories(options = {}) {
  const spinner = ora('Loading categories...').start();

  try {
    const categories = await getCategories();
    spinner.succeed('Categories loaded');

    console.log('');
    console.log(chalk.bold.white('📂 Available Categories:'));
    console.log('');

    categories.forEach(category => {
      console.log(`  ${chalk.cyan(category.name)} ${chalk.gray(`(${category.count} components)`)}`);
    });

    console.log('');
    console.log(chalk.gray('Browse category: npx cct --search "category-name"'));
    console.log('');

  } catch (error) {
    spinner.fail('Failed to load categories');
    console.error(chalk.red('Error:'), error.message);
  }
}

module.exports = {
  runSearch,
  runDiscovery,
  runTrending,
  runPopular,
  runInteractiveSearch,
  showCategories
};

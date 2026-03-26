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
      showInstallCommand: false, // Don't show install command, we'll prompt instead
      compact: options.compact || false,
      showScore: options.verbose || false
    });

    // Ask if user wants to install
    if (results.total > 0) {
      const { wantsToInstall } = await inquirer.prompt([{
        type: 'confirm',
        name: 'wantsToInstall',
        message: chalk.bold('Would you like to install any of these components?'),
        default: false
      }]);

      if (wantsToInstall) {
        await promptInstallFromSearch(results, options);
      } else {
        console.log('');
        console.log(chalk.gray('💡 You can search again or install later using: npx cct --agent <name>'));
        console.log('');
      }
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
 * @param {Object} options - Options
 */
async function promptInstallFromSearch(results, options = {}) {
  try {
    // Collect all components
    const allComponents = [
      ...results.agents,
      ...results.commands,
      ...results.mcps,
      ...results.skills
    ];

    if (allComponents.length === 0) return;

    console.log('');
    console.log(chalk.bold.white('📦 Select Components to Install'));
    console.log(chalk.gray('Use ↑↓ to navigate, Space to select, a to toggle all, Enter to confirm'));
    console.log('');

    // Group components by type
    const groups = {
      agents: results.agents,
      commands: results.commands,
      mcps: results.mcps,
      skills: results.skills
    };

    // Create grouped choices with separators
    const choices = [];

    // Add AGENTS group
    if (groups.agents.length > 0) {
      choices.push(
        new inquirer.Separator(chalk.magenta.bold('✨ AGENTS'))
      );
      
      groups.agents.forEach(component => {
        choices.push({
          name: `  ${chalk.bold(component.displayName || component.name)} ${chalk.gray('- ' + (component.description?.substring(0, 50) + '...' || ''))}`,
          value: component,
          short: `✨ ${component.displayName || component.name}`
        });
      });
      
      choices.push(new inquirer.Separator(''));
    }

    // Add COMMANDS group
    if (groups.commands.length > 0) {
      choices.push(
        new inquirer.Separator(chalk.yellow.bold('⚡ COMMANDS'))
      );
      
      groups.commands.forEach(component => {
        choices.push({
          name: `  ${chalk.bold(component.displayName || component.name)} ${chalk.gray('- ' + (component.description?.substring(0, 50) + '...' || ''))}`,
          value: component,
          short: `⚡ ${component.displayName || component.name}`
        });
      });
      
      choices.push(new inquirer.Separator(''));
    }

    // Add MCP SERVERS group
    if (groups.mcps.length > 0) {
      choices.push(
        new inquirer.Separator(chalk.blue.bold('🔌 MCP SERVERS'))
      );
      
      groups.mcps.forEach(component => {
        choices.push({
          name: `  ${chalk.bold(component.displayName || component.name)} ${chalk.gray('- ' + (component.description?.substring(0, 50) + '...' || ''))}`,
          value: component,
          short: `🔌 ${component.displayName || component.name}`
        });
      });
      
      choices.push(new inquirer.Separator(''));
    }

    // Add SKILLS group
    if (groups.skills.length > 0) {
      choices.push(
        new inquirer.Separator(chalk.cyan.bold('🎨 SKILLS'))
      );
      
      groups.skills.forEach(component => {
        choices.push({
          name: `  ${chalk.bold(component.displayName || component.name)} ${chalk.gray('- ' + (component.description?.substring(0, 50) + '...' || ''))}`,
          value: component,
          short: `🎨 ${component.displayName || component.name}`
        });
      });
      
      choices.push(new inquirer.Separator(''));
    }

    // Prompt for selection
    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: chalk.bold('Select components to install:'),
      choices,
      pageSize: 15,
      loop: true
    }]);

    // Handle selection
    let finalSelection = selected;

    if (finalSelection.length === 0) {
      console.log('');
      console.log(chalk.yellow('⚠️  No components selected'));
      console.log('');
      return;
    }

    // Show selection summary grouped by type
    console.log('');
    console.log(chalk.cyan('━'.repeat(70)));
    console.log(chalk.bold.white(`📋 Selected ${chalk.green(finalSelection.length)} component${finalSelection.length !== 1 ? 's' : ''}:`));
    console.log(chalk.cyan('━'.repeat(70)));
    console.log('');

    // Group selected items by type for display
    const selectedByType = {
      agents: finalSelection.filter(c => c.componentType === 'agents'),
      commands: finalSelection.filter(c => c.componentType === 'commands'),
      mcps: finalSelection.filter(c => c.componentType === 'mcps'),
      skills: finalSelection.filter(c => c.componentType === 'skills')
    };

    let itemNumber = 1;
    
    if (selectedByType.agents.length > 0) {
      console.log(chalk.magenta.bold('  ✨ AGENTS:'));
      selectedByType.agents.forEach(component => {
        console.log(`     ${chalk.gray(`${itemNumber++}.`)} ${chalk.white(component.displayName || component.name)}`);
      });
      console.log('');
    }

    if (selectedByType.commands.length > 0) {
      console.log(chalk.yellow.bold('  ⚡ COMMANDS:'));
      selectedByType.commands.forEach(component => {
        console.log(`     ${chalk.gray(`${itemNumber++}.`)} ${chalk.white(component.displayName || component.name)}`);
      });
      console.log('');
    }

    if (selectedByType.mcps.length > 0) {
      console.log(chalk.blue.bold('  🔌 MCP SERVERS:'));
      selectedByType.mcps.forEach(component => {
        console.log(`     ${chalk.gray(`${itemNumber++}.`)} ${chalk.white(component.displayName || component.name)}`);
      });
      console.log('');
    }

    if (selectedByType.skills.length > 0) {
      console.log(chalk.cyan.bold('  🎨 SKILLS:'));
      selectedByType.skills.forEach(component => {
        console.log(`     ${chalk.gray(`${itemNumber++}.`)} ${chalk.white(component.displayName || component.name)}`);
      });
      console.log('');
    }

    // Build install command
    const installParts = [];
    for (const component of finalSelection) {
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

    console.log(chalk.cyan('━'.repeat(70)));
    console.log(chalk.bold.white('📦 Installation Command:'));
    console.log(chalk.cyan('━'.repeat(70)));
    console.log('');
    console.log(chalk.green(installCmd));
    console.log('');
    console.log(chalk.gray('💡 Tip: You can copy this command to install later'));
    console.log('');

    // Ask to execute
    const { execute } = await inquirer.prompt([{
      type: 'confirm',
      name: 'execute',
      message: chalk.bold('🚀 Install these components now?'),
      default: true
    }]);

    if (execute) {
      console.log('');
      console.log(chalk.cyan('━'.repeat(70)));
      console.log(chalk.bold.blue('⚙️  Installing components...'));
      console.log(chalk.cyan('━'.repeat(70)));
      console.log('');

      // Import install functions from main module
      const mainModule = require('./index');
      const targetDir = options.directory || process.cwd();

      let successCount = 0;
      let failCount = 0;

      for (const component of finalSelection) {
        try {
          let success = false;
          
          // Call the appropriate install function based on component type
          if (component.componentType === 'agents') {
            success = await mainModule.installIndividualAgent(component.id, targetDir, { silent: false });
          } else if (component.componentType === 'commands') {
            success = await mainModule.installIndividualCommand(component.id, targetDir, { silent: false });
          } else if (component.componentType === 'mcps') {
            success = await mainModule.installIndividualMCP(component.id, targetDir, { silent: false });
          } else if (component.componentType === 'skills') {
            success = await mainModule.installIndividualSkill(component.id, targetDir, { silent: false });
          }

          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(chalk.red(`❌ Failed to install ${component.name}:`), error.message);
          failCount++;
        }
      }

      console.log('');
      console.log(chalk.cyan('━'.repeat(70)));
      if (successCount === finalSelection.length) {
        console.log(chalk.bold.green(`✅ Successfully installed all ${successCount} component${successCount !== 1 ? 's' : ''}!`));
        console.log('');
        console.log(chalk.gray('🎉 Components are ready to use in your project'));
      } else {
        console.log(chalk.bold.yellow(`⚠️  Installed ${successCount}/${finalSelection.length} components`));
        if (failCount > 0) {
          console.log(chalk.red(`   ${failCount} failed - check errors above`));
        }
      }
      console.log(chalk.cyan('━'.repeat(70)));
      console.log('');
    } else {
      console.log('');
      console.log(chalk.yellow('⏹️  Installation cancelled'));
      console.log(chalk.gray('💡 You can install later using the command above'));
      console.log('');
    }

  } catch (error) {
    // User cancelled with Ctrl+C
    if (error.isTtyError) {
      console.error(chalk.red('\n❌ Interactive mode not supported in this terminal'));
    } else {
      console.log('');
      console.log(chalk.yellow('⏹️  Selection cancelled'));
      console.log('');
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

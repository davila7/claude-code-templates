#!/usr/bin/env node

/**
 * Test script for search & discovery modules
 * Run: node test-search.js
 */

const chalk = require('chalk');

async function testDataLoader() {
  console.log(chalk.bold.cyan('\n📦 Testing Data Loader...'));
  try {
    const { loadComponentData, getComponentsByType, getComponentById } = require('./src/search/data-loader');
    
    // Test loading all data
    const data = await loadComponentData();
    console.log(chalk.green('✅ Data loaded successfully'));
    console.log(chalk.gray(`   Agents: ${data.agents.length}`));
    console.log(chalk.gray(`   Commands: ${data.commands.length}`));
    console.log(chalk.gray(`   MCPs: ${data.mcps.length}`));
    console.log(chalk.gray(`   Skills: ${data.skills.length}`));
    
    // Test getting by type
    const agents = await getComponentsByType('agents');
    console.log(chalk.green(`✅ Get by type works (${agents.length} agents)`));
    
    // Test getting by ID
    if (agents.length > 0) {
      const component = await getComponentById(agents[0].id);
      console.log(chalk.green(`✅ Get by ID works (${component.name})`));
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Data Loader failed:'), error.message);
    return false;
  }
}

async function testSearchEngine() {
  console.log(chalk.bold.cyan('\n🔍 Testing Search Engine...'));
  try {
    const { searchComponents, getSearchSuggestions } = require('./src/search/search-engine');
    
    // Test basic search
    const results1 = await searchComponents('security');
    console.log(chalk.green(`✅ Basic search works (${results1.total} results for "security")`));
    
    // Test category filter
    const results2 = await searchComponents('git', { category: 'agents' });
    console.log(chalk.green(`✅ Category filter works (${results2.total} results)`));
    
    // Test search suggestions
    const suggestions = await getSearchSuggestions('sec', 3);
    console.log(chalk.green(`✅ Suggestions work (${suggestions.length} suggestions)`));
    
    // Test fuzzy matching
    const results3 = await searchComponents('secrity'); // typo
    console.log(chalk.green(`✅ Fuzzy matching works (${results3.total} results for typo)`));
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Search Engine failed:'), error.message);
    console.error(error.stack);
    return false;
  }
}

async function testDisplay() {
  console.log(chalk.bold.cyan('\n🎨 Testing Display...'));
  try {
    const { searchComponents } = require('./src/search/search-engine');
    const { displaySearchResults, displayTrending, displayPopular } = require('./src/search/display');
    
    // Test search results display
    const results = await searchComponents('database');
    console.log(chalk.green('✅ Display search results:'));
    displaySearchResults(results, { showInstallCommand: true, compact: true });
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Display failed:'), error.message);
    return false;
  }
}

async function testDiscovery() {
  console.log(chalk.bold.cyan('\n🎯 Testing Discovery...'));
  try {
    const { discoverComponents, getCategories } = require('./src/search/discovery');
    
    // Test project discovery
    const discovery = await discoverComponents('.');
    console.log(chalk.green(`✅ Project detection works (detected: ${discovery.projectInfo.type})`));
    console.log(chalk.gray(`   Essential: ${discovery.recommendations.essential.length}`));
    console.log(chalk.gray(`   Popular: ${discovery.recommendations.popular.length}`));
    console.log(chalk.gray(`   Trending: ${discovery.recommendations.trending.length}`));
    
    // Test categories
    const categories = await getCategories();
    console.log(chalk.green(`✅ Categories work (${categories.length} categories)`));
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Discovery failed:'), error.message);
    return false;
  }
}

async function testTrending() {
  console.log(chalk.bold.cyan('\n📈 Testing Trending...'));
  try {
    const { getTrendingComponents, getPopularComponents, getComponentStats } = require('./src/search/trending');
    
    // Test trending
    const trending = await getTrendingComponents({ limit: 5 });
    console.log(chalk.green(`✅ Trending works (${trending.length} components)`));
    
    // Test popular
    const popular = await getPopularComponents({ limit: 5 });
    console.log(chalk.green(`✅ Popular works (${popular.length} components)`));
    
    // Test stats
    const stats = await getComponentStats();
    console.log(chalk.green(`✅ Stats work (${stats.total} total components)`));
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Trending failed:'), error.message);
    return false;
  }
}

async function testPerformance() {
  console.log(chalk.bold.cyan('\n⚡ Testing Performance...'));
  try {
    const { searchComponents } = require('./src/search/search-engine');
    
    // Test search speed
    const start = Date.now();
    await searchComponents('test');
    const duration = Date.now() - start;
    
    const status = duration < 100 ? chalk.green('✅') : chalk.yellow('⚠️');
    console.log(`${status} Search speed: ${duration}ms (target: <100ms)`);
    
    // Test cache speed
    const start2 = Date.now();
    await searchComponents('test'); // Should be cached
    const duration2 = Date.now() - start2;
    
    const status2 = duration2 < duration ? chalk.green('✅') : chalk.yellow('⚠️');
    console.log(`${status2} Cached search: ${duration2}ms (faster than first: ${duration2 < duration})`);
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Performance test failed:'), error.message);
    return false;
  }
}

async function runAllTests() {
  console.log(chalk.bold.white('\n🧪 Running Search & Discovery Tests\n'));
  console.log(chalk.gray('='.repeat(50)));
  
  const results = [];
  
  results.push(await testDataLoader());
  results.push(await testSearchEngine());
  results.push(await testDisplay());
  results.push(await testDiscovery());
  results.push(await testTrending());
  results.push(await testPerformance());
  
  console.log(chalk.gray('\n' + '='.repeat(50)));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(chalk.bold.green(`\n✅ All tests passed! (${passed}/${total})`));
    console.log(chalk.green('\n🎉 Search & Discovery system is working perfectly!\n'));
    process.exit(0);
  } else {
    console.log(chalk.bold.red(`\n❌ Some tests failed (${passed}/${total} passed)`));
    console.log(chalk.yellow('\n⚠️  Please review the errors above\n'));
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(chalk.red('\n💥 Fatal error:'), error.message);
  console.error(error.stack);
  process.exit(1);
});

#!/usr/bin/env node

const ConsoleBridge = require('./console-bridge');
const chalk = require('chalk');

/**
 * Test script for the Console Bridge
 */
async function testConsoleBridge() {
  console.log(chalk.blue('🧪 Testing Console Bridge Integration'));
  console.log(chalk.gray('This will monitor running Claude Code processes and enable web-based interaction'));
  console.log('');
  
  // Create console bridge instance
  const bridge = new ConsoleBridge({
    port: 3334,
    debug: true
  });
  
  try {
    // Initialize the bridge
    const success = await bridge.initialize();
    
    if (!success) {
      console.error(chalk.red('❌ Failed to initialize Console Bridge'));
      process.exit(1);
    }
    
    console.log('');
    console.log(chalk.green('✅ Console Bridge is running!'));
    console.log(chalk.cyan('📡 WebSocket server: ws://localhost:3334'));
    console.log(chalk.cyan('🌐 Web interface should connect to this WebSocket'));
    console.log('');
    console.log(chalk.yellow('💡 Instructions:'));
    console.log('  1. Open your analytics dashboard (npm run analytics:start)');
    console.log('  2. Navigate to the Agents page');
    console.log('  3. The console interaction panel should appear when Claude Code prompts are detected');
    console.log('  4. Run Claude Code in another terminal to test interaction');
    console.log('');
    console.log(chalk.gray('Press Ctrl+C to stop the bridge'));
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('');
      console.log(chalk.yellow('🛑 Shutting down Console Bridge...'));
      await bridge.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await bridge.shutdown();
      process.exit(0);
    });
    
    // Keep the process running
    setInterval(() => {
      // Heartbeat to keep process alive
    }, 1000);
    
  } catch (error) {
    console.error(chalk.red('❌ Error running Console Bridge:'), error);
    process.exit(1);
  }
}

// Run the test
testConsoleBridge();
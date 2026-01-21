#!/usr/bin/env node

/**
 * Docker Sandbox Executor
 * Runs inside Docker container using Claude Agent SDK
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

// Parse command line arguments
const args = process.argv.slice(2);
const prompt = args[0] || 'Hello, Claude!';
const componentsToInstall = args[1] || '';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

// Validate API key
if (!anthropicApiKey) {
  console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

console.log('🐳 Docker Sandbox Executor');
console.log('═══════════════════════════════════════\n');

/**
 * Install Claude Code components if specified
 */
async function installComponents() {
  if (!componentsToInstall || componentsToInstall.trim() === '') {
    return true;
  }

  console.log('📦 Installing components...');
  console.log(`   Components: ${componentsToInstall}\n`);

  return new Promise((resolve) => {
    const installCmd = `npx claude-code-templates@latest ${componentsToInstall} --yes`;

    const child = spawn('sh', ['-c', installCmd], {
      stdio: 'inherit',
      env: process.env
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Components installed successfully\n');
        resolve(true);
      } else {
        console.log('\n⚠️  Component installation had warnings (continuing...)\n');
        resolve(true); // Continue even if installation has warnings
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Installation error: ${error.message}`);
      resolve(false);
    });
  });
}

/**
 * Execute Claude Code query using Agent SDK
 */
async function executeQuery() {
  try {
    console.log('🤖 Executing Claude Code...');
    console.log(`   Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"\n`);
    console.log('─'.repeat(60));
    console.log('📝 CLAUDE OUTPUT:');
    console.log('─'.repeat(60) + '\n');

    // Enhance prompt with working directory context
    const enhancedPrompt = `${prompt}\n\nNote: Your current working directory is /app. When creating files, save them in the current directory (/app) so they can be captured in the output.`;

    // query() returns an async generator - we need to iterate it
    const generator = query({
      prompt: enhancedPrompt,
      options: {
        apiKey: anthropicApiKey,
        model: 'claude-sonnet-4-5',
        permissionMode: 'bypassPermissions',  // Auto-allow all tool uses
      }
    });

    let assistantResponses = [];
    let messageCount = 0;

    // Iterate through the async generator
    for await (const message of generator) {
      messageCount++;

      if (message.type === 'assistant') {
        // Extract text from assistant message content
        if (message.message && message.message.content) {
          const content = Array.isArray(message.message.content)
            ? message.message.content
            : [message.message.content];

          content.forEach(block => {
            if (block.type === 'text') {
              console.log(block.text);
              assistantResponses.push(block.text);
            }
          });
        }
      } else if (message.type === 'result') {
        // Show final result metadata
        console.log('\n' + '─'.repeat(60));
        console.log(`✅ Execution completed (${message.num_turns} turn${message.num_turns > 1 ? 's' : ''})`);
        console.log(`   Duration: ${message.duration_ms}ms`);
        console.log(`   Cost: $${message.total_cost_usd.toFixed(5)}`);
        console.log('─'.repeat(60) + '\n');
      }
    }

    // Show response summary
    const responseText = assistantResponses.join('\n');
    if (responseText) {
      console.log('📄 Response Summary:');
      console.log(`   ${messageCount} message(s) received`);
      console.log(`   ${assistantResponses.length} assistant response(s)`);
      console.log(`   ${responseText.length} characters generated`);
      console.log('');
    }

    return true;
  } catch (error) {
    console.error('\n❌ Execution error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    return false;
  }
}

/**
 * Find and copy generated files to output directory
 */
async function copyGeneratedFiles() {
  try {
    console.log('📁 Searching for generated files...\n');

    // Common file extensions to look for
    const extensions = [
      'js', 'jsx', 'ts', 'tsx',
      'py', 'html', 'css', 'scss',
      'json', 'md', 'yaml', 'yml',
      'txt', 'sh', 'bash'
    ];

    // Search for files in multiple directories
    const { execSync } = await import('child_process');

    const findPattern = extensions.map(ext => `-name "*.${ext}"`).join(' -o ');

    // Search in /app and /tmp for generated files
    const searchPaths = ['/app', '/tmp'];
    let allFiles = [];

    for (const searchPath of searchPaths) {
      const findCmd = `find ${searchPath} -type f \\( ${findPattern} \\) ! -path "*/node_modules/*" ! -path "*/.npm/*" ! -path "/app/execute.js" ! -path "/app/package*.json" -newer /app/execute.js 2>/dev/null | head -50`;

      try {
        const output = execSync(findCmd, { encoding: 'utf8' });
        const files = output.trim().split('\n').filter(f => f.trim());
        allFiles = allFiles.concat(files);
      } catch (error) {
        // Continue to next search path
      }
    }

    if (allFiles.length === 0) {
      console.log('ℹ️  No generated files found\n');
      return;
    }

    console.log(`📦 Found ${allFiles.length} file(s):\n`);

    // Copy files to output directory preserving structure
    let copiedCount = 0;
    for (const file of allFiles) {
      try {
        // Determine relative path based on source directory
        let relativePath;
        if (file.startsWith('/app/')) {
          relativePath = file.replace('/app/', '');
        } else if (file.startsWith('/tmp/')) {
          relativePath = file.replace('/tmp/', '');
        } else {
          relativePath = path.basename(file);
        }

        const outputPath = path.join('/output', relativePath);

        // Create directory structure
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Copy file
        await fs.copyFile(file, outputPath);

        console.log(`   ✅ ${relativePath}`);
        copiedCount++;
      } catch (error) {
        console.log(`   ⚠️  Failed to copy: ${file}`);
      }
    }

    if (copiedCount > 0) {
      console.log(`\n✅ Copied ${copiedCount} file(s) to output directory\n`);
    }
  } catch (error) {
    console.error('❌ Error copying files:', error.message);
  }
}

/**
 * Main execution flow
 */
async function main() {
  try {
    // Step 1: Install components
    const installSuccess = await installComponents();
    if (!installSuccess) {
      console.error('❌ Component installation failed');
      process.exit(1);
    }

    // Step 2: Execute Claude query
    const executeSuccess = await executeQuery();
    if (!executeSuccess) {
      console.error('❌ Query execution failed');
      process.exit(1);
    }

    // Step 3: Copy generated files
    await copyGeneratedFiles();

    console.log('🎉 Docker sandbox execution completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run main function
main();

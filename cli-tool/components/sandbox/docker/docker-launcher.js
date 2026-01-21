#!/usr/bin/env node

/**
 * Docker Sandbox Launcher
 * Orchestrates Docker container execution for Claude Code
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

console.log('🐳 Docker Sandbox Launcher');
console.log('═══════════════════════════════════════\n');

/**
 * Check if Docker is installed
 */
function checkDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error('❌ Error: Docker is not installed');
    console.error('   Please install Docker: https://docs.docker.com/get-docker/\n');
    return false;
  }
}

/**
 * Check if Docker daemon is running
 */
function checkDockerRunning() {
  try {
    execSync('docker ps', { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error('❌ Error: Docker daemon is not running');
    console.error('   Please start Docker and try again\n');
    return false;
  }
}

/**
 * Build Docker image if it doesn't exist
 */
async function buildDockerImage() {
  console.log('🔨 Checking Docker image...');

  // Check if image exists
  try {
    execSync('docker image inspect claude-sandbox', { stdio: 'pipe' });
    console.log('   ✅ Image already exists\n');
    return true;
  } catch (error) {
    // Image doesn't exist, build it
    console.log('   📦 Building Docker image (this may take a few minutes)...\n');

    return new Promise((resolve) => {
      const build = spawn('docker', [
        'build',
        '-t', 'claude-sandbox',
        '.'
      ], {
        cwd: __dirname,
        stdio: 'inherit'
      });

      build.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Docker image built successfully\n');
          resolve(true);
        } else {
          console.error('\n❌ Failed to build Docker image');
          resolve(false);
        }
      });

      build.on('error', (error) => {
        console.error('❌ Build error:', error.message);
        resolve(false);
      });
    });
  }
}

/**
 * Run Docker container
 */
async function runDockerContainer() {
  console.log('🚀 Starting Docker container...\n');

  // Create output directory
  const outputDir = path.join(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });

  return new Promise((resolve) => {
    const dockerArgs = [
      'run',
      '--rm',
      '-e', `ANTHROPIC_API_KEY=${anthropicApiKey}`,
      '-v', `${outputDir}:/output`,
      'claude-sandbox',
      'node', '/app/execute.js',
      prompt,
      componentsToInstall
    ];

    const container = spawn('docker', dockerArgs, {
      stdio: 'inherit'
    });

    container.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Docker container completed successfully');

        // Show output directory
        console.log(`\n📂 Output files saved to: ${outputDir}`);
        resolve(true);
      } else {
        console.error('\n❌ Docker container failed with code:', code);
        resolve(false);
      }
    });

    container.on('error', (error) => {
      console.error('❌ Container error:', error.message);
      resolve(false);
    });
  });
}

/**
 * Main execution flow
 */
async function main() {
  try {
    // Step 1: Check Docker installation
    if (!checkDockerInstalled()) {
      process.exit(1);
    }

    // Step 2: Check Docker daemon
    if (!checkDockerRunning()) {
      process.exit(1);
    }

    // Step 3: Build Docker image
    const buildSuccess = await buildDockerImage();
    if (!buildSuccess) {
      process.exit(1);
    }

    // Step 4: Run container
    const runSuccess = await runDockerContainer();
    if (!runSuccess) {
      process.exit(1);
    }

    console.log('\n🎉 Docker sandbox execution completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run main function
main();

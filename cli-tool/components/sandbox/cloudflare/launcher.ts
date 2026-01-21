#!/usr/bin/env node
/**
 * Cloudflare Sandbox Launcher
 * Executes Claude Code prompts using Cloudflare Workers and Sandbox SDK
 */

import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

interface ExecutionResult {
  success: boolean;
  question: string;
  code: string;
  output: string;
  error: string;
  sandboxId?: string;
  files?: { path: string; content: string }[];
}

interface LauncherConfig {
  prompt: string;
  componentsToInstall: string;
  anthropicApiKey: string;
  workerUrl?: string;
  useLocalWorker?: boolean;
  targetDir?: string;
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, level: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
  }[level];

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function printSeparator(char: string = '=', length: number = 60) {
  console.log(char.repeat(length));
}

/**
 * Extract files from generated code (handles multiple code blocks)
 */
function extractFilesFromCode(code: string): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];

  // Pattern to match code blocks with file names
  // Matches: ```html:filename.html or ```javascript:script.js or ```css:styles.css
  const fileBlockPattern = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = fileBlockPattern.exec(code)) !== null) {
    const [, _language, filename, content] = match;
    files.push({
      path: filename.trim(),
      content: content.trim()
    });
  }

  // If no explicit filenames, try to detect from code blocks
  if (files.length === 0) {
    const codeBlockPattern = /```(\w+)\n([\s\S]*?)```/g;
    const languageExtensions: Record<string, string> = {
      html: 'index.html',
      css: 'styles.css',
      javascript: 'script.js',
      js: 'script.js',
      typescript: 'index.ts',
      ts: 'index.ts',
      python: 'main.py',
      py: 'main.py'
    };

    const detectedFiles = new Map<string, string>();

    while ((match = codeBlockPattern.exec(code)) !== null) {
      const [, language, content] = match;
      const ext = language.toLowerCase();
      const filename = languageExtensions[ext] || `code.${ext}`;

      // If we already have this type of file, append a number
      let finalFilename = filename;
      let counter = 1;
      while (detectedFiles.has(finalFilename)) {
        const parts = filename.split('.');
        const extension = parts.pop();
        const base = parts.join('.');
        finalFilename = `${base}${counter}.${extension}`;
        counter++;
      }

      detectedFiles.set(finalFilename, content.trim());
    }

    detectedFiles.forEach((content, filename) => {
      files.push({ path: filename, content });
    });
  }

  return files;
}

/**
 * Save files to local directory
 */
function saveFilesToDirectory(files: { path: string; content: string }[], baseDir: string): void {
  if (files.length === 0) {
    return;
  }

  // Create output directory
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  files.forEach(file => {
    const fullPath = path.join(baseDir, file.path);
    const dir = path.dirname(fullPath);

    // Create directory if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, file.content, 'utf-8');
    log(`✓ ${file.path}`, 'success');
  });

  console.log('');
  console.log(`${colors.green}✓${colors.reset} All files saved to: ${colors.cyan}${path.resolve(baseDir)}${colors.reset}`);
  printSeparator();
}

async function executeViaWorker(
  config: LauncherConfig
): Promise<ExecutionResult> {
  const workerUrl = config.workerUrl || 'http://localhost:8787';
  const endpoint = `${workerUrl}/execute`;

  log(`Sending request to Cloudflare Worker: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: config.prompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker returned ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as ExecutionResult;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to execute via worker: ${errorMessage}`);
  }
}

async function executeDirectly(config: LauncherConfig): Promise<ExecutionResult> {
  log('Executing with Claude Agent SDK...');

  // Extract agent names for context
  const agents = config.componentsToInstall ? extractAgents(config.componentsToInstall) : [];

  try {
    log('Generating code with Claude Agent SDK...');
    log(`Working directory: ${process.cwd()}`);

    // Detect if this is a web development request
    const isWebRequest = /html|css|javascript|webpage|website|form|ui|interface|frontend/i.test(config.prompt);

    const promptContent = isWebRequest
      ? `Create a complete web application for: "${config.prompt}"

IMPORTANT FORMAT REQUIREMENTS:
- Provide complete, working code for ALL files needed
- Use this EXACT format for each file:

\`\`\`html:index.html
[your HTML code here]
\`\`\`

\`\`\`css:styles.css
[your CSS code here]
\`\`\`

\`\`\`javascript:script.js
[your JavaScript code here]
\`\`\`

Requirements:
- Create a complete, functional web application
- Include all necessary HTML, CSS, and JavaScript
- Use modern, responsive design
- Add proper comments
- Ensure code is ready to run
- Do NOT include any explanations, ONLY code blocks with filenames`
      : config.prompt;

    // Configure Claude Agent SDK options
    // Using settingSources: ['project'] to automatically load agents from .claude/ directory
    // This is supported in SDK version ^0.1.23 and later
    const options: ClaudeAgentOptions = {
      model: 'claude-sonnet-4-5',
      apiKey: config.anthropicApiKey,
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      // Automatically load agents, settings, and configurations from .claude/ directory
      settingSources: ['project'],
    };

    if (agents.length > 0) {
      log(`Using agents from .claude/agents/ directory via settingSources`, 'success');
    }

    // Collect the full response
    let generatedCode = '';

    try {
      for await (const message of query({ prompt: promptContent, options })) {
        // The Agent SDK returns different message types:
        // - 'system': Initialization info
        // - 'assistant': Individual API responses
        // - 'result': Final aggregated result (THIS is what we need!)
        if (message.type === 'result' && message.result) {
          generatedCode = message.result;
          log(`Received result (${message.result.length} chars)`, 'success');
        } else if (message.type === 'text' && message.text) {
          // Fallback for older SDK versions
          generatedCode += message.text;
        }
      }
    } catch (queryError) {
      const err = queryError as Error;
      log(`Query error: ${err.message}`, 'error');
      log(`Stack: ${err.stack}`, 'error');
      throw new Error(`Claude Agent SDK query failed: ${err.message}`);
    }

    if (!generatedCode) {
      throw new Error('Failed to generate code from Claude Agent SDK (empty response)');
    }

    log('Code generated successfully', 'success');

    // Note: Direct execution would require local Python runtime
    // For now, we return the code for manual execution or deployment
    return {
      success: true,
      question: config.prompt,
      code: generatedCode,
      output: 'Code generated. Deploy to Cloudflare Worker to execute.',
      error: '',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Direct execution failed: ${errorMessage}`);
  }
}

function extractAgents(componentsString: string): string[] {
  const agents: string[] = [];
  const parts = componentsString.split('--');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('agent ')) {
      const agentNames = trimmed.substring(6).trim();
      if (agentNames) {
        agents.push(...agentNames.split(',').map((a) => a.trim()));
      }
    }
  }

  return agents;
}

async function installAgents(agents: string[]): Promise<void> {
  if (agents.length === 0) {
    return;
  }

  log(`Installing ${agents.length} agent(s)...`);

  // Create .claude/agents directory
  const claudeDir = path.join(process.cwd(), '.claude');
  const agentsDir = path.join(claudeDir, 'agents');

  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  // Download each agent from GitHub
  const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/agents';

  for (const agent of agents) {
    try {
      log(`Downloading agent: ${agent}...`);

      // Construct the GitHub URL for the agent
      const agentUrl = `${GITHUB_RAW_BASE}/${agent}.md`;

      // Download the agent file
      const response = await fetch(agentUrl);

      if (!response.ok) {
        log(`Failed to download agent ${agent}: ${response.statusText}`, 'warning');
        continue;
      }

      const agentContent = await response.text();

      // Save to .claude/agents/
      const agentFileName = agent.replace(/\//g, '-') + '.md';
      const agentPath = path.join(agentsDir, agentFileName);

      fs.writeFileSync(agentPath, agentContent, 'utf-8');
      log(`Installed agent: ${agent}`, 'success');
    } catch (error) {
      log(`Error installing agent ${agent}: ${error instanceof Error ? error.message : String(error)}`, 'warning');
    }
  }

  // Create settings.json to reference the agents
  const settingsPath = path.join(claudeDir, 'settings.json');
  const settings = {
    agents: agents.map(agent => ({
      name: agent.split('/').pop() || agent,
      path: `.claude/agents/${agent.replace(/\//g, '-')}.md`
    }))
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  log('Created .claude/settings.json', 'success');
}

function displayResults(result: ExecutionResult, targetDir?: string) {
  console.log('');

  if (result.error) {
    console.log(`${colors.red}❌ Error:${colors.reset} ${result.error}`);
    console.log('');
    return;
  }

  if (result.sandboxId) {
    log(`Sandbox ID: ${result.sandboxId}`);
  }

  // Extract and save files
  const files = extractFilesFromCode(result.code);
  if (files.length > 0) {
    // Generate unique directory name with timestamp (similar to E2B's sandbox-xxxxxxxx)
    const timestamp = Date.now().toString(36);
    const baseDir = targetDir || process.cwd();
    const outputDir = path.join(baseDir, `cloudflare-${timestamp}`);

    console.log('');
    printSeparator();
    log(`Downloading ${files.length} file(s)...`);
    console.log('');
    saveFilesToDirectory(files, outputDir);
  }
}

async function checkWorkerAvailability(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok || response.status === 405; // 405 is fine, means worker is up
  } catch {
    return false;
  }
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Cloudflare Sandbox Launcher');
    console.log('');
    console.log('Usage:');
    console.log('  node launcher.ts <prompt> [components] [anthropic_api_key] [worker_url]');
    console.log('');
    console.log('Examples:');
    console.log('  node launcher.ts "Calculate factorial of 5"');
    console.log('  node launcher.ts "Create a React app" "--agent frontend-developer" YOUR_KEY');
    console.log('  node launcher.ts "Fibonacci" "" YOUR_KEY https://your-worker.workers.dev');
    console.log('');
    console.log('Environment Variables:');
    console.log('  ANTHROPIC_API_KEY - Anthropic API key');
    console.log('  CLOUDFLARE_WORKER_URL - Cloudflare Worker endpoint');
    process.exit(1);
  }

  const config: LauncherConfig = {
    prompt: args[0],
    componentsToInstall: args[1] || '',
    anthropicApiKey: args[2] || process.env.ANTHROPIC_API_KEY || '',
    workerUrl: args[3] || process.env.CLOUDFLARE_WORKER_URL || 'http://localhost:8787',
    targetDir: args[4] || process.cwd(),
    useLocalWorker: true,
  };

  if (!config.anthropicApiKey) {
    log('Error: Anthropic API key is required', 'error');
    console.log('Provide via command line argument or ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  console.log('');
  printSeparator();
  console.log(`${colors.bright}☁️  CLOUDFLARE SANDBOX LAUNCHER${colors.reset}`);
  printSeparator();
  console.log('');

  log(`Prompt: "${config.prompt.substring(0, 100)}${config.prompt.length > 100 ? '...' : ''}"`);

  if (config.componentsToInstall) {
    const agents = extractAgents(config.componentsToInstall);
    if (agents.length > 0) {
      log(`Agents: ${agents.join(', ')}`);

      // Install agents before execution
      console.log('');
      await installAgents(agents);
    }
  }

  console.log('');

  try {
    // Check if worker is available
    log('Checking Cloudflare Worker availability...');
    const workerAvailable = await checkWorkerAvailability(config.workerUrl || 'http://localhost:8787');

    let result: ExecutionResult;

    if (workerAvailable) {
      log('Cloudflare Worker is available', 'success');
      log('Executing via Cloudflare Sandbox...');
      result = await executeViaWorker(config);
    } else {
      log('Cloudflare Worker not available, using direct execution', 'warning');
      log('For full sandbox execution, deploy worker with: npx wrangler deploy', 'warning');
      result = await executeDirectly(config);
    }

    displayResults(result, config.targetDir);

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.log('');
    log(`Execution failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    console.log('');

    log('Troubleshooting:', 'info');
    console.log('1. Ensure Cloudflare Worker is deployed: npx wrangler deploy');
    console.log('2. Check API key is set: npx wrangler secret put ANTHROPIC_API_KEY');
    console.log('3. Wait 2-3 minutes after first deployment for container provisioning');
    console.log('4. Check container status: npx wrangler containers list');
    console.log('5. For local testing: npm run dev');

    process.exit(1);
  }
}

export { executeViaWorker, executeDirectly, type LauncherConfig, type ExecutionResult };

// Run if executed directly (ES modules compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

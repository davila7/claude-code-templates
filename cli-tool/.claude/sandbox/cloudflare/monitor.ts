#!/usr/bin/env node
/**
 * Cloudflare Sandbox Real-time Monitor
 * Provides real-time monitoring and debugging of Cloudflare sandbox operations
 */

import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';

interface MonitoringMetrics {
  executionTime: number;
  codeGenerationTime: number;
  sandboxExecutionTime: number;
  memoryUsage?: number;
  success: boolean;
  errorDetails?: string;
}

interface SandboxState {
  status: 'idle' | 'generating' | 'executing' | 'completed' | 'failed';
  currentStep: string;
  progress: number;
}

// ANSI color codes
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

function logWithTimestamp(message: string, level: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING' = 'INFO') {
  const timestamp = new Date().toLocaleTimeString();
  const icon = {
    INFO: `${colors.blue}ℹ${colors.reset}`,
    SUCCESS: `${colors.green}✓${colors.reset}`,
    ERROR: `${colors.red}✗${colors.reset}`,
    WARNING: `${colors.yellow}⚠${colors.reset}`,
  }[level];

  const colorCode = {
    INFO: colors.blue,
    SUCCESS: colors.green,
    ERROR: colors.red,
    WARNING: colors.yellow,
  }[level];

  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${icon} ${colorCode}${message}${colors.reset}`);
}

function printSeparator(char: string = '=', length: number = 60) {
  console.log(colors.dim + char.repeat(length) + colors.reset);
}

async function monitorWorkerHealth(workerUrl: string): Promise<boolean> {
  logWithTimestamp('🔍 Checking Cloudflare Worker health...');

  try {
    const response = await fetch(workerUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok || response.status === 405) {
      logWithTimestamp('✅ Worker is responding', 'SUCCESS');
      logWithTimestamp(`   Status: ${response.status} ${response.statusText}`);
      return true;
    } else {
      logWithTimestamp(`⚠️  Worker returned: ${response.status} ${response.statusText}`, 'WARNING');
      return false;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithTimestamp(`❌ Worker health check failed: ${errorMsg}`, 'ERROR');
    return false;
  }
}

async function monitorCodeGeneration(
  anthropic: Anthropic,
  prompt: string
): Promise<{ code: string; duration: number }> {
  logWithTimestamp('🤖 Starting code generation with Claude...');

  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Generate Python code to answer: "${prompt}"

Requirements:
- Use only Python standard library
- Print the result using print()
- Keep code simple and safe
- Include proper error handling

Return ONLY the code, no explanations.`,
        },
      ],
    });

    const duration = Date.now() - startTime;

    const code = response.content[0]?.type === 'text' ? response.content[0].text : '';

    if (!code) {
      throw new Error('No code generated');
    }

    logWithTimestamp(`✅ Code generated in ${duration}ms`, 'SUCCESS');
    logWithTimestamp(`   Model: ${response.model}`);
    logWithTimestamp(`   Tokens used: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);
    logWithTimestamp(`   Code length: ${code.length} characters`);

    if (code.length < 500) {
      console.log('');
      logWithTimestamp('📝 Generated Code Preview:');
      printSeparator('-', 60);
      console.log(colors.cyan + code + colors.reset);
      printSeparator('-', 60);
      console.log('');
    }

    return { code, duration };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithTimestamp(`❌ Code generation failed: ${errorMsg}`, 'ERROR');
    throw error;
  }
}

async function monitorSandboxExecution(
  workerUrl: string,
  question: string
): Promise<{ result: any; duration: number }> {
  logWithTimestamp('⚙️  Executing in Cloudflare Sandbox...');

  const startTime = Date.now();

  try {
    const response = await fetch(`${workerUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sandbox returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    logWithTimestamp(`✅ Sandbox execution completed in ${duration}ms`, 'SUCCESS');
    logWithTimestamp(`   Exit code: ${result.success ? '0 (success)' : '1 (failed)'}`);
    logWithTimestamp(`   Output length: ${result.output?.length || 0} characters`);

    if (result.error) {
      logWithTimestamp(`   Error output: ${result.error.length} characters`, 'WARNING');
    }

    return { result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithTimestamp(`❌ Sandbox execution failed after ${duration}ms: ${errorMsg}`, 'ERROR');
    throw error;
  }
}

function displayMetrics(metrics: MonitoringMetrics) {
  console.log('');
  printSeparator();
  console.log(`${colors.bright}📊 PERFORMANCE METRICS${colors.reset}`);
  printSeparator();
  console.log('');

  console.log(`${colors.cyan}Total Execution Time:${colors.reset} ${metrics.executionTime}ms`);
  console.log(`${colors.cyan}  ├─ Code Generation:${colors.reset} ${metrics.codeGenerationTime}ms`);
  console.log(`${colors.cyan}  └─ Sandbox Execution:${colors.reset} ${metrics.sandboxExecutionTime}ms`);

  if (metrics.memoryUsage) {
    console.log(`${colors.cyan}Memory Usage:${colors.reset} ${metrics.memoryUsage}MB`);
  }

  console.log('');
  console.log(
    `${colors.cyan}Status:${colors.reset} ${metrics.success ? `${colors.green}Success ✓${colors.reset}` : `${colors.red}Failed ✗${colors.reset}`}`
  );

  if (metrics.errorDetails) {
    console.log(`${colors.red}Error Details:${colors.reset} ${metrics.errorDetails}`);
  }

  printSeparator();
}

function displaySystemInfo() {
  console.log('');
  printSeparator();
  console.log(`${colors.bright}🖥️  SYSTEM INFORMATION${colors.reset}`);
  printSeparator();
  console.log('');

  console.log(`${colors.cyan}Node.js Version:${colors.reset} ${process.version}`);
  console.log(`${colors.cyan}Platform:${colors.reset} ${process.platform}`);
  console.log(`${colors.cyan}Architecture:${colors.reset} ${process.arch}`);
  console.log(
    `${colors.cyan}Memory Usage:${colors.reset} ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
  );

  printSeparator();
  console.log('');
}

async function enhancedSandboxMonitoring(
  prompt: string,
  anthropicApiKey: string,
  workerUrl: string = 'http://localhost:8787'
): Promise<boolean> {
  logWithTimestamp('🚀 Starting enhanced Cloudflare sandbox monitoring');
  printSeparator();

  displaySystemInfo();

  const metrics: MonitoringMetrics = {
    executionTime: 0,
    codeGenerationTime: 0,
    sandboxExecutionTime: 0,
    success: false,
  };

  const startTime = Date.now();

  try {
    // Step 1: Check worker health
    const workerHealthy = await monitorWorkerHealth(workerUrl);
    if (!workerHealthy) {
      logWithTimestamp('⚠️  Worker is not healthy, attempting to continue...', 'WARNING');
    }

    console.log('');

    // Step 2: Generate code with monitoring
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const { code, duration: codeGenDuration } = await monitorCodeGeneration(anthropic, prompt);
    metrics.codeGenerationTime = codeGenDuration;

    console.log('');

    // Step 3: Execute in sandbox with monitoring
    const { result, duration: execDuration } = await monitorSandboxExecution(workerUrl, prompt);
    metrics.sandboxExecutionTime = execDuration;

    console.log('');

    // Display results
    printSeparator();
    console.log(`${colors.bright}🎯 EXECUTION RESULTS${colors.reset}`);
    printSeparator();
    console.log('');

    console.log(`${colors.cyan}Question:${colors.reset} ${result.question}`);
    console.log('');

    console.log(`${colors.cyan}Generated Code:${colors.reset}`);
    printSeparator('-', 60);
    console.log(colors.green + result.code + colors.reset);
    printSeparator('-', 60);
    console.log('');

    if (result.output) {
      console.log(`${colors.cyan}Output:${colors.reset}`);
      console.log(colors.bright + result.output + colors.reset);
      console.log('');
    }

    if (result.error) {
      console.log(`${colors.red}Error Output:${colors.reset}`);
      console.log(result.error);
      console.log('');
    }

    metrics.executionTime = Date.now() - startTime;
    metrics.success = result.success;
    metrics.memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    displayMetrics(metrics);

    logWithTimestamp('✅ Monitoring session completed successfully', 'SUCCESS');
    return true;
  } catch (error) {
    metrics.executionTime = Date.now() - startTime;
    metrics.success = false;
    metrics.errorDetails = error instanceof Error ? error.message : String(error);
    metrics.memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    console.log('');
    displayMetrics(metrics);

    logWithTimestamp(`❌ Monitoring session failed: ${metrics.errorDetails}`, 'ERROR');
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Cloudflare Sandbox Monitor');
    console.log('');
    console.log('Usage:');
    console.log('  node monitor.ts <prompt> [anthropic_api_key] [worker_url]');
    console.log('');
    console.log('Examples:');
    console.log('  node monitor.ts "Calculate factorial of 5"');
    console.log('  node monitor.ts "Fibonacci 10" YOUR_API_KEY');
    console.log('  node monitor.ts "Sum array" YOUR_KEY https://your-worker.workers.dev');
    console.log('');
    console.log('Environment Variables:');
    console.log('  ANTHROPIC_API_KEY - Anthropic API key');
    console.log('  CLOUDFLARE_WORKER_URL - Worker endpoint (default: http://localhost:8787)');
    console.log('');
    console.log('This tool provides enhanced monitoring and debugging for Cloudflare sandbox operations.');
    process.exit(1);
  }

  const prompt = args[0];
  const anthropicApiKey = args[1] || process.env.ANTHROPIC_API_KEY || '';
  const workerUrl = args[2] || process.env.CLOUDFLARE_WORKER_URL || 'http://localhost:8787';

  if (!anthropicApiKey) {
    logWithTimestamp('❌ Anthropic API key is required', 'ERROR');
    console.log('Provide via command line argument or ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  console.log('');
  printSeparator('=', 70);
  console.log(`${colors.bright}${colors.cyan}     🎬 CLOUDFLARE SANDBOX MONITOR${colors.reset}`);
  printSeparator('=', 70);
  console.log('');

  const success = await enhancedSandboxMonitoring(prompt, anthropicApiKey, workerUrl);

  console.log('');

  if (success) {
    logWithTimestamp('🎉 Monitoring completed successfully', 'SUCCESS');
    process.exit(0);
  } else {
    logWithTimestamp('💔 Monitoring failed', 'ERROR');
    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Ensure worker is deployed: npx wrangler deploy');
    console.log('2. Check API key is set: npx wrangler secret put ANTHROPIC_API_KEY');
    console.log('3. Verify worker URL is correct');
    console.log('4. Check worker logs: npx wrangler tail');
    console.log('5. Test locally: npm run dev');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { monitorWorkerHealth, monitorCodeGeneration, monitorSandboxExecution };

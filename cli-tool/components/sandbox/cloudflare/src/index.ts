import { getSandbox, type Sandbox } from '@cloudflare/sandbox';
import Anthropic from '@anthropic-ai/sdk';

export { Sandbox } from '@cloudflare/sandbox';

interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
  ANTHROPIC_API_KEY: string;
}

interface ExecuteRequest {
  question: string;
  maxTokens?: number;
  timeout?: number;
  language?: 'python' | 'javascript';
}

interface ExecuteResponse {
  success: boolean;
  question: string;
  code: string;
  output: string;
  error: string;
  sandboxId?: string;
  executionTime?: number;
}

/**
 * Main Worker handler
 * Receives code execution requests and orchestrates Claude AI + Cloudflare Sandbox
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for browser access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Root endpoint - return usage instructions
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(
        JSON.stringify({
          name: 'Cloudflare Claude Code Sandbox',
          version: '1.0.0',
          endpoints: {
            execute: 'POST /execute - Execute code via Claude AI',
            health: 'GET /health - Check worker health',
          },
          usage: {
            example: {
              method: 'POST',
              url: '/execute',
              body: {
                question: 'What is the 10th Fibonacci number?',
              },
            },
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Health check endpoint
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          worker: 'cloudflare-claude-sandbox',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Execute endpoint
    if (request.method === 'POST' && url.pathname === '/execute') {
      const startTime = Date.now();

      try {
        // Parse request body
        const body = (await request.json()) as ExecuteRequest;

        if (!body.question) {
          return Response.json(
            { error: 'Question is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Validate API key
        if (!env.ANTHROPIC_API_KEY) {
          return Response.json(
            {
              error: 'ANTHROPIC_API_KEY not configured',
              message: 'Set the API key using: npx wrangler secret put ANTHROPIC_API_KEY',
            },
            { status: 500, headers: corsHeaders }
          );
        }

        // Initialize Anthropic client
        const anthropic = new Anthropic({
          apiKey: env.ANTHROPIC_API_KEY,
        });

        // Generate code using Claude
        console.log('Generating code with Claude for:', body.question.substring(0, 100));

        const language = body.language || 'python';
        const codePrompt =
          language === 'python'
            ? `Generate Python code to answer: "${body.question}"

Requirements:
- Use only Python standard library
- Print the result using print()
- Keep code simple and safe
- Include proper error handling
- Use descriptive variable names

Return ONLY the code, no explanations or markdown formatting.`
            : `Generate JavaScript code to answer: "${body.question}"

Requirements:
- Use only Node.js standard library
- Print the result using console.log()
- Keep code simple and safe
- Include proper error handling
- Use descriptive variable names

Return ONLY the code, no explanations or markdown formatting.`;

        const codeGeneration = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: body.maxTokens || 2048,
          messages: [
            {
              role: 'user',
              content: codePrompt,
            },
          ],
        });

        const generatedCode =
          codeGeneration.content[0]?.type === 'text' ? codeGeneration.content[0].text : '';

        if (!generatedCode) {
          return Response.json(
            { error: 'Failed to generate code from Claude' },
            { status: 500, headers: corsHeaders }
          );
        }

        // Clean up code (remove markdown formatting if present)
        const cleanCode = generatedCode
          .replace(/```(?:python|javascript|js)?\n?/g, '')
          .replace(/```\n?$/g, '')
          .trim();

        console.log('Code generated, executing in sandbox...');

        // Execute the code in a sandbox
        // Use a unique ID per request to avoid conflicts
        const sandboxId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const sandbox = getSandbox(env.Sandbox, sandboxId);

        // Determine execution command based on language
        const fileName = language === 'python' ? '/tmp/code.py' : '/tmp/code.js';
        const execCommand =
          language === 'python' ? 'python /tmp/code.py' : 'node /tmp/code.js';

        // Write code to sandbox and execute
        await sandbox.writeFile(fileName, cleanCode);

        const result = await sandbox.exec(execCommand, {
          timeout: body.timeout || 30000, // 30 seconds default
        });

        const executionTime = Date.now() - startTime;

        const response: ExecuteResponse = {
          success: result.success,
          question: body.question,
          code: cleanCode,
          output: result.stdout || '',
          error: result.stderr || '',
          sandboxId: sandboxId,
          executionTime: executionTime,
        };

        console.log(
          `Execution completed in ${executionTime}ms. Success: ${result.success}`
        );

        return Response.json(response, {
          headers: corsHeaders,
        });
      } catch (error: unknown) {
        console.error('Execution error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const executionTime = Date.now() - startTime;

        return Response.json(
          {
            error: 'Internal server error',
            message: errorMessage,
            executionTime: executionTime,
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Unknown endpoint
    return new Response(
      'POST /execute with { "question": "your question" }\nGET /health for health check\nGET / for API information',
      { status: 404, headers: corsHeaders }
    );
  },
};

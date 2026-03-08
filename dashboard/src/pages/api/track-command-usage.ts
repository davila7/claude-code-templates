import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../lib/api/cors';
import { getNeonClient } from '../../lib/api/neon';

const VALID_COMMANDS = [
  'chats',
  'analytics',
  'health-check',
  'plugins',
  'sandbox',
  'agents',
  'chats-mobile',
  'studio',
  'command-stats',
  'hook-stats',
  'mcp-stats',
  'skills-manager',
  '2025-year-in-review',
];

function validateCommandData(data: { command?: string }) {
  const { command } = data;

  if (!command) {
    return { valid: false, error: 'Command name is required' };
  }

  if (!VALID_COMMANDS.includes(command)) {
    return { valid: false, error: 'Invalid command name' };
  }

  if (command.length > 100) {
    return { valid: false, error: 'Command name too long' };
  }

  return { valid: true, error: null };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const {
      command,
      cliVersion,
      nodeVersion,
      platform,
      arch,
      sessionId,
      metadata,
    } = await request.json();

    const validation = validateCommandData({ command });
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const sql = getNeonClient();

    await sql`
      INSERT INTO command_usage_logs (
        command_name,
        cli_version,
        node_version,
        platform,
        arch,
        session_id,
        metadata
      ) VALUES (
        ${command},
        ${cliVersion || 'unknown'},
        ${nodeVersion || 'unknown'},
        ${platform || 'unknown'},
        ${arch || 'unknown'},
        ${sessionId || null},
        ${metadata ? JSON.stringify(metadata) : null}
      )
    `;

    return jsonResponse({
      success: true,
      message: 'Command execution tracked successfully',
      data: { command, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Command tracking error:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        message: 'Failed to track command execution',
      },
      500
    );
  }
};

export const OPTIONS: APIRoute = async () => corsResponse();

// Command Usage Tracking API Endpoint - Neon Database
// Tracks CLI command executions for community analytics

import { neon } from '@neondatabase/serverless';

// Initialize Neon client
function getNeonClient() {
  const connectionString = process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }

  return neon(connectionString);
}

// Validate command data
function validateCommandData(data) {
  const { command, cliVersion, nodeVersion, platform } = data;

  if (!command) {
    return { valid: false, error: 'Command name is required' };
  }

  // Valid commands to track
  const validCommands = [
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
    '2025-year-in-review'
  ];

  if (!validCommands.includes(command)) {
    return { valid: false, error: 'Invalid command name' };
  }

  if (command.length > 100) {
    return { valid: false, error: 'Command name too long' };
  }

  return { valid: true };
}

// Get client information from request
function getClientInfo(req) {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
             req.headers['x-real-ip'] ||
             'unknown';

  return { userAgent, ip };
}

// Main handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['POST']
    });
  }

  try {
    // Extract and validate request body
    const {
      command,
      cliVersion,
      nodeVersion,
      platform,
      arch,
      sessionId,
      metadata
    } = req.body;

    const validation = validateCommandData({ command, cliVersion, nodeVersion, platform });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Get client information
    const clientInfo = getClientInfo(req);

    // Initialize Neon client
    const sql = getNeonClient();

    // Insert command log
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

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Command execution tracked successfully',
      data: {
        command,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Command tracking error:', error);

    // Return error response
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to track command execution',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

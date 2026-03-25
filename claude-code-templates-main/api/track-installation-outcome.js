// Installation Outcome Tracking API Endpoint - Neon Database
// Tracks CLI installation results (success/failure) for reliability analytics

import { neon } from '@neondatabase/serverless';

function getNeonClient() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  return neon(connectionString);
}

function validateOutcomeData(data) {
  const { componentType, componentName, outcome } = data;

  if (!componentType || !componentName || !outcome) {
    return { valid: false, error: 'componentType, componentName, and outcome are required' };
  }

  const validTypes = ['agent', 'command', 'mcp', 'setting', 'hook', 'skill', 'template'];
  if (!validTypes.includes(componentType)) {
    return { valid: false, error: 'Invalid component type' };
  }

  const validOutcomes = ['success', 'failure', 'partial'];
  if (!validOutcomes.includes(outcome)) {
    return { valid: false, error: 'Invalid outcome. Must be: success, failure, or partial' };
  }

  if (componentName.length > 255) {
    return { valid: false, error: 'Component name too long' };
  }

  return { valid: true };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['POST'] });
  }

  try {
    const {
      componentType,
      componentName,
      outcome,
      errorType,
      errorMessage,
      durationMs,
      cliVersion,
      nodeVersion,
      platform,
      arch,
      batchId
    } = req.body;

    const validation = validateOutcomeData({ componentType, componentName, outcome });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const sql = getNeonClient();

    await sql`
      INSERT INTO installation_outcomes (
        component_type, component_name, outcome,
        error_type, error_message, duration_ms,
        cli_version, node_version, platform, arch, batch_id
      ) VALUES (
        ${componentType},
        ${componentName},
        ${outcome},
        ${errorType || null},
        ${errorMessage ? errorMessage.substring(0, 1000) : null},
        ${durationMs || null},
        ${cliVersion || 'unknown'},
        ${nodeVersion || 'unknown'},
        ${platform || 'unknown'},
        ${arch || 'unknown'},
        ${batchId || null}
      )
    `;

    res.status(200).json({
      success: true,
      message: 'Installation outcome tracked',
      data: { componentType, componentName, outcome, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    console.error('Installation outcome tracking error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to track installation outcome',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

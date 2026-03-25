import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../lib/api/cors';
import { getNeonClient } from '../../lib/api/neon';

function validateOutcomeData(data: {
  componentType?: string;
  componentName?: string;
  outcome?: string;
}) {
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

  return { valid: true, error: null };
}

export const POST: APIRoute = async ({ request }) => {
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
      batchId,
    } = await request.json();

    const validation = validateOutcomeData({ componentType, componentName, outcome });
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
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

    return jsonResponse({
      success: true,
      message: 'Installation outcome tracked',
      data: { componentType, componentName, outcome, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Installation outcome tracking error:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        message: 'Failed to track installation outcome',
      },
      500
    );
  }
};

export const OPTIONS: APIRoute = async () => corsResponse();

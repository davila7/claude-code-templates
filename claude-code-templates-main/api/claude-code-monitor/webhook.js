// Vercel Function: Monitor de Claude Code Changelog
// Se activa con webhooks de NPM o puede ser llamado manualmente

import { neon } from '@neondatabase/serverless';
import axios from 'axios';

const NPM_PACKAGE = '@anthropic-ai/claude-code';
const CHANGELOG_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';

// Inicializar cliente de Neon
function getNeonClient() {
  const connectionString = process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }

  return neon(connectionString);
}

// Obtener la última versión de NPM
async function getLatestNPMVersion() {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`);
    return {
      version: response.data.version,
      publishedAt: response.data.time?.modified || new Date().toISOString(),
      npmUrl: `https://www.npmjs.com/package/${NPM_PACKAGE}/v/${response.data.version}`
    };
  } catch (error) {
    console.error('Error fetching NPM version:', error);
    throw new Error(`Failed to fetch NPM version: ${error.message}`);
  }
}

// Verificar si la versión ya fue procesada
async function isVersionProcessed(sql, version) {
  const result = await sql`
    SELECT id, discord_notified
    FROM claude_code_versions
    WHERE version = ${version}
  `;
  return result.length > 0 ? result[0] : null;
}

// Guardar nueva versión en la base de datos
async function saveVersion(sql, versionData) {
  const { version, publishedAt, npmUrl, changelogContent, githubUrl } = versionData;

  const result = await sql`
    INSERT INTO claude_code_versions (
      version,
      published_at,
      changelog_content,
      npm_url,
      github_url,
      discord_notified
    ) VALUES (
      ${version},
      ${publishedAt},
      ${changelogContent},
      ${npmUrl},
      ${githubUrl},
      false
    )
    RETURNING id, version
  `;

  return result[0];
}

// Actualizar metadata de monitoreo
async function updateMonitoringMetadata(sql, version, errorMessage = null) {
  await sql`
    UPDATE monitoring_metadata
    SET
      last_check_at = NOW(),
      last_version_found = ${version},
      check_count = check_count + 1,
      error_count = error_count + ${errorMessage ? 1 : 0},
      last_error = ${errorMessage}
    WHERE id = 1
  `;
}

// Handler principal
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Aceptar GET y POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getNeonClient();

    console.log('🔍 Checking for new Claude Code version...');

    // Obtener última versión de NPM
    const latestVersion = await getLatestNPMVersion();
    console.log(`📦 Latest NPM version: ${latestVersion.version}`);

    // Verificar si ya fue procesada
    const existingVersion = await isVersionProcessed(sql, latestVersion.version);

    if (existingVersion) {
      console.log(`✓ Version ${latestVersion.version} already processed`);

      // Si ya existe pero no fue notificada a Discord, podemos reintentarlo
      if (!existingVersion.discord_notified) {
        console.log('⚠️ Version exists but Discord notification pending');

        // Actualizar metadata
        await updateMonitoringMetadata(sql, latestVersion.version);

        return res.status(200).json({
          status: 'pending_notification',
          version: latestVersion.version,
          message: 'Version exists, Discord notification pending',
          versionId: existingVersion.id
        });
      }

      // Actualizar metadata
      await updateMonitoringMetadata(sql, latestVersion.version);

      return res.status(200).json({
        status: 'already_processed',
        version: latestVersion.version,
        message: 'Version already processed and notified'
      });
    }

    console.log(`🆕 New version detected: ${latestVersion.version}`);

    // Obtener el changelog desde GitHub
    console.log('📄 Fetching CHANGELOG.md...');
    const changelogResponse = await axios.get(CHANGELOG_URL);
    const fullChangelog = changelogResponse.data;

    // Guardar la nueva versión (sin parsear aún)
    const githubUrl = `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#${latestVersion.version.replace(/\./g, '')}`;

    const savedVersion = await saveVersion(sql, {
      version: latestVersion.version,
      publishedAt: latestVersion.publishedAt,
      npmUrl: latestVersion.npmUrl,
      githubUrl,
      changelogContent: fullChangelog.substring(0, 50000) // Limitar a 50KB
    });

    console.log(`✅ Version ${savedVersion.version} saved to database (ID: ${savedVersion.id})`);

    // Actualizar metadata
    await updateMonitoringMetadata(sql, latestVersion.version);

    // Responder con éxito
    return res.status(200).json({
      status: 'new_version_detected',
      version: savedVersion.version,
      versionId: savedVersion.id,
      message: 'New version saved, ready for processing',
      data: {
        version: latestVersion.version,
        publishedAt: latestVersion.publishedAt,
        npmUrl: latestVersion.npmUrl,
        githubUrl
      }
    });

  } catch (error) {
    console.error('❌ Error in webhook handler:', error);

    // Intentar actualizar metadata con el error
    try {
      const sql = getNeonClient();
      await updateMonitoringMetadata(sql, null, error.message);
    } catch (metaError) {
      console.error('Failed to update metadata:', metaError);
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

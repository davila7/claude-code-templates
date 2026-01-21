// Endpoint principal: Verifica nueva versión y notifica a Discord
// Este endpoint hace todo el proceso completo en una sola llamada

import { neon } from '@neondatabase/serverless';
import axios from 'axios';
import { parseVersionChangelog, formatForDiscord, generateSummary } from './_parser-claude.js';

const NPM_PACKAGE = '@anthropic-ai/claude-code';
const CHANGELOG_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';

// Obtener la última versión de NPM
async function getLatestNPMVersion() {
  const response = await axios.get(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`);
  return {
    version: response.data.version,
    publishedAt: response.data.time?.modified || new Date().toISOString(),
    npmUrl: `https://www.npmjs.com/package/${NPM_PACKAGE}/v/${response.data.version}`
  };
}

// Enviar a Discord
async function sendToDiscord(versionData, parsed, formatted, summary) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL_CHANGELOG || process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error('Discord webhook URL not configured');
  }

  const embed = {
    title: `🚀 Claude Code ${versionData.version} Released`,
    description: `A new version of Claude Code is available with **${summary.total} changes**!`,
    url: versionData.githubUrl,
    color: 0x8B5CF6, // Purple
    fields: [],
    footer: {
      text: 'Claude Code Changelog Monitor',
      icon_url: 'https://avatars.githubusercontent.com/u/100788936?s=200&v=4'
    },
    timestamp: new Date().toISOString()
  };

  // Breaking changes
  if (formatted.breaking && formatted.breaking.length > 0) {
    embed.fields.push({
      name: '⚠️ Breaking Changes',
      value: formatted.breaking,
      inline: false
    });
  }

  // Features
  if (formatted.features && formatted.features.length > 0) {
    embed.fields.push({
      name: '✨ New Features',
      value: formatted.features,
      inline: false
    });
  }

  // Improvements
  if (formatted.improvements && formatted.improvements.length > 0) {
    embed.fields.push({
      name: '⚡ Improvements',
      value: formatted.improvements,
      inline: false
    });
  }

  // Bug Fixes
  if (formatted.fixes && formatted.fixes.length > 0) {
    embed.fields.push({
      name: '🐛 Bug Fixes',
      value: formatted.fixes,
      inline: false
    });
  }

  // Installation
  embed.fields.push({
    name: '📦 Installation',
    value: `\`\`\`bash\nnpm install -g @anthropic-ai/claude-code@${versionData.version}\n\`\`\``,
    inline: false
  });

  // Links
  embed.fields.push({
    name: '🔗 Links',
    value: `[NPM Package](${versionData.npmUrl}) • [Full Changelog](${versionData.githubUrl})`,
    inline: false
  });

  const payload = {
    username: 'Claude Code Monitor',
    avatar_url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/assets/icon.png',
    embeds: [embed]
  };

  const response = await axios.post(webhookUrl, payload);
  return { success: true, status: response.status, payload };
}

// Handler principal
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    const sql = neon(process.env.NEON_DATABASE_URL);

    console.log('🔍 Checking for new Claude Code version...');

    // 1. Obtener última versión de NPM
    const latestVersion = await getLatestNPMVersion();
    console.log(`📦 Latest NPM version: ${latestVersion.version}`);

    // 2. Verificar si ya fue procesada
    const existing = await sql`
      SELECT id, discord_notified
      FROM claude_code_versions
      WHERE version = ${latestVersion.version}
    `;

    if (existing.length > 0 && existing[0].discord_notified) {
      console.log(`✓ Version ${latestVersion.version} already processed and notified`);

      await sql`
        UPDATE monitoring_metadata
        SET last_check_at = NOW(), last_version_found = ${latestVersion.version}
        WHERE id = 1
      `;

      return res.status(200).json({
        status: 'already_processed',
        version: latestVersion.version,
        message: 'Version already notified to Discord'
      });
    }

    console.log(`🆕 New version detected: ${latestVersion.version}`);

    // 3. Obtener changelog
    const changelogResponse = await axios.get(CHANGELOG_URL);
    const fullChangelog = changelogResponse.data;

    // 4. Parsear changelog de esta versión
    const parsed = parseVersionChangelog(fullChangelog, latestVersion.version);

    if (!parsed.content) {
      throw new Error(`Could not find version ${latestVersion.version} in changelog`);
    }

    console.log(`📝 Parsed ${parsed.changeCount} changes`);

    // 5. Formatear para Discord
    const formatted = formatForDiscord(parsed.changes);
    const summary = generateSummary(parsed.changes);

    // 6. Guardar en base de datos
    const githubUrl = `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#${latestVersion.version.replace(/\./g, '')}`;

    const versionData = {
      version: latestVersion.version,
      publishedAt: latestVersion.publishedAt,
      npmUrl: latestVersion.npmUrl,
      githubUrl,
      changelogContent: fullChangelog.substring(0, 50000)
    };

    let versionId;

    if (existing.length > 0) {
      // Ya existe pero no fue notificada
      versionId = existing[0].id;
      console.log(`📝 Updating existing version record (ID: ${versionId})`);
    } else {
      // Crear nueva entrada
      const insertResult = await sql`
        INSERT INTO claude_code_versions (
          version,
          published_at,
          changelog_content,
          npm_url,
          github_url,
          discord_notified
        ) VALUES (
          ${versionData.version},
          ${versionData.publishedAt},
          ${versionData.changelogContent},
          ${versionData.npmUrl},
          ${versionData.githubUrl},
          false
        )
        RETURNING id
      `;
      versionId = insertResult[0].id;
      console.log(`💾 Version saved to database (ID: ${versionId})`);
    }

    // 7. Guardar cambios individuales
    for (const change of parsed.changes) {
      await sql`
        INSERT INTO claude_code_changes (
          version_id,
          change_type,
          description,
          category
        ) VALUES (
          ${versionId},
          ${change.type},
          ${change.description},
          ${change.category}
        )
      `;
    }
    console.log(`💾 Saved ${parsed.changes.length} individual changes`);

    // 8. Enviar a Discord
    console.log('📢 Sending Discord notification...');
    const discordResult = await sendToDiscord(versionData, parsed, formatted, summary);
    console.log('✅ Discord notification sent successfully!');

    // 9. Guardar log de notificación
    await sql`
      INSERT INTO discord_notifications_log (
        version_id,
        webhook_url,
        payload,
        response_status,
        response_body
      ) VALUES (
        ${versionId},
        ${process.env.DISCORD_WEBHOOK_URL_CHANGELOG || process.env.DISCORD_WEBHOOK_URL},
        ${JSON.stringify(discordResult.payload)},
        ${discordResult.status},
        ${'Success'}
      )
    `;

    // 10. Marcar como notificada
    await sql`
      UPDATE claude_code_versions
      SET discord_notified = true, discord_notification_sent_at = NOW()
      WHERE id = ${versionId}
    `;

    // 11. Actualizar metadata
    await sql`
      UPDATE monitoring_metadata
      SET
        last_check_at = NOW(),
        last_version_found = ${latestVersion.version},
        check_count = check_count + 1
      WHERE id = 1
    `;

    console.log('🎉 Process completed successfully!');

    return res.status(200).json({
      status: 'success',
      version: latestVersion.version,
      versionId,
      changes: {
        total: summary.total,
        byType: summary.byType
      },
      discord: {
        sent: true,
        status: discordResult.status
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);

    // Actualizar metadata con error
    try {
      const sql = neon(process.env.NEON_DATABASE_URL);
      await sql`
        UPDATE monitoring_metadata
        SET
          last_check_at = NOW(),
          error_count = error_count + 1,
          last_error = ${error.message}
        WHERE id = 1
      `;
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

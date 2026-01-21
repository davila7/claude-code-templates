// Notificador de Discord para Claude Code Changelog

import { neon } from '@neondatabase/serverless';
import axios from 'axios';
import { parseVersionChangelog, formatForDiscord, generateSummary } from './parser.js';

/**
 * Envía notificación a Discord sobre una nueva versión
 * @param {object} versionData - Datos de la versión
 * @returns {object} - Resultado del envío
 */
export async function sendDiscordNotification(versionData) {
  const { version, changelog, npmUrl, githubUrl } = versionData;

  // Parsear changelog
  const parsed = parseVersionChangelog(changelog, version);

  if (!parsed.content) {
    throw new Error('Failed to parse changelog for version ' + version);
  }

  // Formatear para Discord
  const formatted = formatForDiscord(parsed.changes);
  const summary = generateSummary(parsed.changes);

  // Construir embed
  const embed = buildDiscordEmbed({
    version,
    changes: formatted,
    summary,
    npmUrl,
    githubUrl
  });

  // Enviar a Discord
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL_CHANGELOG || process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error('Discord webhook URL not configured');
  }

  const payload = {
    username: 'Claude Code Monitor',
    avatar_url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/assets/icon.png',
    embeds: [embed]
  };

  try {
    const response = await axios.post(webhookUrl, payload);

    return {
      success: true,
      status: response.status,
      webhookUrl,
      payload
    };
  } catch (error) {
    console.error('Discord webhook error:', error.response?.data || error.message);
    throw new Error(`Discord notification failed: ${error.message}`);
  }
}

/**
 * Construye el embed de Discord
 */
function buildDiscordEmbed({ version, changes, summary, npmUrl, githubUrl }) {
  const embed = {
    title: `🚀 Claude Code ${version} Released`,
    description: `A new version of Claude Code is available with **${summary.total} changes**!`,
    url: githubUrl,
    color: 0x8B5CF6, // Purple (Claude color)
    fields: [],
    footer: {
      text: 'Claude Code Changelog Monitor',
      icon_url: 'https://avatars.githubusercontent.com/u/100788936?s=200&v=4'
    },
    timestamp: new Date().toISOString()
  };

  // Breaking changes (prioritario)
  if (changes.breaking && changes.breaking.length > 0) {
    embed.fields.push({
      name: '⚠️ Breaking Changes',
      value: changes.breaking || 'None',
      inline: false
    });
  }

  // Features
  if (changes.features && changes.features.length > 0) {
    embed.fields.push({
      name: '✨ New Features',
      value: changes.features || 'None',
      inline: false
    });
  }

  // Improvements
  if (changes.improvements && changes.improvements.length > 0) {
    embed.fields.push({
      name: '⚡ Improvements',
      value: changes.improvements || 'None',
      inline: false
    });
  }

  // Bug Fixes
  if (changes.fixes && changes.fixes.length > 0) {
    embed.fields.push({
      name: '🐛 Bug Fixes',
      value: changes.fixes || 'None',
      inline: false
    });
  }

  // Links
  embed.fields.push({
    name: '📦 Installation',
    value: `\`\`\`bash\nnpm install -g @anthropic-ai/claude-code@${version}\n\`\`\``,
    inline: false
  });

  embed.fields.push({
    name: '🔗 Links',
    value: `[NPM Package](${npmUrl}) • [Full Changelog](${githubUrl})`,
    inline: false
  });

  return embed;
}

/**
 * Guarda el log de la notificación en la base de datos
 */
async function logNotification(sql, versionId, notificationResult) {
  const { success, status, webhookUrl, payload } = notificationResult;

  await sql`
    INSERT INTO discord_notifications_log (
      version_id,
      webhook_url,
      payload,
      response_status,
      response_body,
      error_message
    ) VALUES (
      ${versionId},
      ${webhookUrl},
      ${JSON.stringify(payload)},
      ${status},
      ${success ? 'Success' : 'Failed'},
      ${success ? null : 'Failed to send'}
    )
  `;
}

/**
 * Marca la versión como notificada en Discord
 */
async function markAsNotified(sql, versionId) {
  await sql`
    UPDATE claude_code_versions
    SET
      discord_notified = true,
      discord_notification_sent_at = NOW()
    WHERE id = ${versionId}
  `;
}

/**
 * Procesa y notifica una versión específica
 * Esta es la función principal que se llama desde el webhook
 */
export async function processAndNotify(versionId) {
  const sql = neon(process.env.NEON_DATABASE_URL);

  // Obtener datos de la versión
  const versionResult = await sql`
    SELECT *
    FROM claude_code_versions
    WHERE id = ${versionId}
  `;

  if (versionResult.length === 0) {
    throw new Error(`Version ID ${versionId} not found`);
  }

  const versionData = versionResult[0];

  // Verificar si ya fue notificada
  if (versionData.discord_notified) {
    return {
      status: 'already_notified',
      version: versionData.version,
      message: 'Version already notified to Discord'
    };
  }

  // Enviar notificación
  const notificationResult = await sendDiscordNotification({
    version: versionData.version,
    changelog: versionData.changelog_content,
    npmUrl: versionData.npm_url,
    githubUrl: versionData.github_url
  });

  // Guardar log
  await logNotification(sql, versionId, notificationResult);

  // Marcar como notificada
  await markAsNotified(sql, versionId);

  return {
    status: 'notified',
    version: versionData.version,
    notificationResult
  };
}

/**
 * Handler de Vercel para procesar notificaciones
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { versionId } = req.body;

    if (!versionId) {
      return res.status(400).json({ error: 'versionId required' });
    }

    console.log(`📢 Processing Discord notification for version ID: ${versionId}`);

    const result = await processAndNotify(versionId);

    console.log(`✅ Notification processed: ${result.status}`);

    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Discord notification error:', error);

    return res.status(500).json({
      error: 'Failed to send Discord notification',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

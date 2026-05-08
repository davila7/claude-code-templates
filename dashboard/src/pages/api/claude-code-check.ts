import type { APIRoute } from 'astro';
import { getNeonClient } from '../../lib/api/neon';
import { corsResponse, jsonResponse } from '../../lib/api/cors';
import { parseVersionChangelog, formatForDiscord, generateSummary } from '../../lib/api/changelog-parser';

const NPM_PACKAGE = '@anthropic-ai/claude-code';
const CHANGELOG_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';

async function getLatestNPMVersion() {
  const response = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`);
  const data = await response.json();
  return {
    version: data.version,
    publishedAt: data.time?.modified || new Date().toISOString(),
    npmUrl: `https://www.npmjs.com/package/${NPM_PACKAGE}/v/${data.version}`,
  };
}

async function sendToDiscord(
  versionData: { version: string; npmUrl: string; githubUrl: string },
  formatted: ReturnType<typeof formatForDiscord>,
  summary: ReturnType<typeof generateSummary>,
) {
  const webhookUrl = import.meta.env.DISCORD_WEBHOOK_URL_CHANGELOG || process.env.DISCORD_WEBHOOK_URL_CHANGELOG || import.meta.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error('Discord webhook URL not configured');
  }

  const embed: Record<string, unknown> = {
    title: `Claude Code ${versionData.version} Released`,
    description: `A new version of Claude Code is available with **${summary.total} changes**!`,
    url: versionData.githubUrl,
    color: 0x8b5cf6,
    fields: [] as Record<string, unknown>[],
    footer: {
      text: 'Claude Code Changelog Monitor',
      icon_url: 'https://avatars.githubusercontent.com/u/100788936?s=200&v=4',
    },
    timestamp: new Date().toISOString(),
  };

  const fields = embed.fields as Record<string, unknown>[];

  if (formatted.breaking && formatted.breaking.length > 0) {
    fields.push({ name: 'Breaking Changes', value: formatted.breaking, inline: false });
  }
  if (formatted.features && formatted.features.length > 0) {
    fields.push({ name: 'New Features', value: formatted.features, inline: false });
  }
  if (formatted.improvements && formatted.improvements.length > 0) {
    fields.push({ name: 'Improvements', value: formatted.improvements, inline: false });
  }
  if (formatted.fixes && formatted.fixes.length > 0) {
    fields.push({ name: 'Bug Fixes', value: formatted.fixes, inline: false });
  }

  fields.push({
    name: 'Installation',
    value: `\`\`\`bash\nnpm install -g @anthropic-ai/claude-code@${versionData.version}\n\`\`\``,
    inline: false,
  });

  fields.push({
    name: 'Links',
    value: `[NPM Package](${versionData.npmUrl}) | [Full Changelog](${versionData.githubUrl})`,
    inline: false,
  });

  const payload = {
    username: 'Claude Code Monitor',
    avatar_url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/assets/icon.png',
    embeds: [embed],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return { success: true, status: response.status, payload };
}

async function handleCheck() {
  try {
    const sql = getNeonClient();

    console.log('Checking for new Claude Code version...');

    const latestVersion = await getLatestNPMVersion();
    console.log(`Latest NPM version: ${latestVersion.version}`);

    const existing = await sql`
      SELECT id, discord_notified
      FROM claude_code_versions
      WHERE version = ${latestVersion.version}
    `;

    if (existing.length > 0 && existing[0].discord_notified) {
      console.log(`Version ${latestVersion.version} already processed and notified`);

      await sql`
        UPDATE monitoring_metadata
        SET last_check_at = NOW(), last_version_found = ${latestVersion.version}
        WHERE id = 1
      `;

      return jsonResponse({
        status: 'already_processed',
        version: latestVersion.version,
        message: 'Version already notified to Discord',
      });
    }

    console.log(`New version detected: ${latestVersion.version}`);

    const changelogResponse = await fetch(CHANGELOG_URL);
    const fullChangelog = await changelogResponse.text();

    const parsed = parseVersionChangelog(fullChangelog, latestVersion.version);

    if (!parsed.content) {
      throw new Error(`Could not find version ${latestVersion.version} in changelog`);
    }

    console.log(`Parsed ${parsed.changeCount} changes`);

    const formatted = formatForDiscord(parsed.changes);
    const summary = generateSummary(parsed.changes);

    const githubUrl = `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#${latestVersion.version.replace(/\./g, '')}`;

    const versionData = {
      version: latestVersion.version,
      publishedAt: latestVersion.publishedAt,
      npmUrl: latestVersion.npmUrl,
      githubUrl,
      changelogContent: fullChangelog.substring(0, 50000),
    };

    let versionId: number;

    if (existing.length > 0) {
      versionId = existing[0].id;
      console.log(`Updating existing version record (ID: ${versionId})`);
    } else {
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
      console.log(`Version saved to database (ID: ${versionId})`);
    }

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
    console.log(`Saved ${parsed.changes.length} individual changes`);

    console.log('Sending Discord notification...');
    const discordResult = await sendToDiscord(versionData, formatted, summary);
    console.log('Discord notification sent successfully!');

    await sql`
      INSERT INTO discord_notifications_log (
        version_id,
        webhook_url,
        payload,
        response_status,
        response_body
      ) VALUES (
        ${versionId},
        ${import.meta.env.DISCORD_WEBHOOK_URL_CHANGELOG || process.env.DISCORD_WEBHOOK_URL_CHANGELOG || import.meta.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL},
        ${JSON.stringify(discordResult.payload)},
        ${discordResult.status},
        ${'Success'}
      )
    `;

    await sql`
      UPDATE claude_code_versions
      SET discord_notified = true, discord_notification_sent_at = NOW()
      WHERE id = ${versionId}
    `;

    await sql`
      UPDATE monitoring_metadata
      SET
        last_check_at = NOW(),
        last_version_found = ${latestVersion.version},
        check_count = check_count + 1
      WHERE id = 1
    `;

    console.log('Process completed successfully!');

    return jsonResponse({
      status: 'success',
      version: latestVersion.version,
      versionId,
      changes: {
        total: summary.total,
        byType: summary.byType,
      },
      discord: {
        sent: true,
        status: discordResult.status,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error:', err);

    try {
      const sql = getNeonClient();
      await sql`
        UPDATE monitoring_metadata
        SET
          last_check_at = NOW(),
          error_count = error_count + 1,
          last_error = ${err.message}
        WHERE id = 1
      `;
    } catch (metaError) {
      console.error('Failed to update metadata:', metaError);
    }

    return jsonResponse(
      {
        error: 'Internal server error',
        message: err.message,
      },
      500,
    );
  }
}

export const OPTIONS: APIRoute = async () => {
  return corsResponse();
};

export const GET: APIRoute = async () => {
  return handleCheck();
};

export const POST: APIRoute = async () => {
  return handleCheck();
};

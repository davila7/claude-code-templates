/**
 * Cloudflare Worker: Claude Code Docs Monitor
 *
 * Monitors https://code.claude.com/docs for changes and sends Telegram notifications
 * Runs on Cloudflare Workers with Cron Triggers
 * Uses Cloudflare KV for state storage
 *
 * Error tracking: set SENTRY_DSN (wrangler secret put SENTRY_DSN) to report
 * failures to the "aitmpl-workers" Sentry project, in addition to the
 * existing Telegram error notification. Optional — degrades gracefully.
 */

import { reportError, checkIn } from './sentry.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('🔍 Starting docs monitoring check...');

    const checkInId = await checkIn(env, 'docs-monitor', 'in_progress');

    try {
      // 1. Fetch the documentation page
      const response = await fetch('https://code.claude.com/docs', {
        headers: {
          'User-Agent': 'Claude-Code-Docs-Monitor/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch docs: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();

      // 2. Extract main content (remove scripts, styles, etc for cleaner hash)
      const cleanContent = cleanHTML(html);

      // 3. Calculate hash of current content
      const currentHash = await hashContent(cleanContent);

      // 4. Get previous hash from KV storage
      const previousHash = await env.DOCS_MONITOR_KV.get('last_hash');
      const lastChecked = await env.DOCS_MONITOR_KV.get('last_checked');

      console.log('Previous hash:', previousHash || 'none');
      console.log('Current hash:', currentHash);

      // 5. Check if content has changed - only notify on changes
      if (!previousHash) {
        // First run - just store the hash, no notification
        await env.DOCS_MONITOR_KV.put('last_hash', currentHash);
        await env.DOCS_MONITOR_KV.put('last_checked', new Date().toISOString());
        console.log('✅ First run - hash stored, monitoring started');
      } else if (currentHash !== previousHash) {
        // Changes detected - send notification
        console.log('🔔 Change detected! Sending notification...');

        const notificationData = {
          type: 'change_detected',
          previousHash,
          currentHash,
          lastChecked,
          url: 'https://code.claude.com/docs'
        };

        const notificationSent = await sendTelegramNotification(env, notificationData);

        if (notificationSent) {
          // Update state in KV
          await env.DOCS_MONITOR_KV.put('last_hash', currentHash);
          await env.DOCS_MONITOR_KV.put('last_checked', new Date().toISOString());
          await env.DOCS_MONITOR_KV.put('last_change', new Date().toISOString());

          console.log('✅ Change notification sent and state updated');
        } else {
          console.error('❌ Failed to send notification');
        }
      } else {
        // No changes - just update last checked time, no notification
        console.log('✅ No changes detected - no notification sent');
        await env.DOCS_MONITOR_KV.put('last_checked', new Date().toISOString());
      }

      await checkIn(env, 'docs-monitor', 'ok', checkInId);

    } catch (error) {
      console.error('❌ Error in docs monitor:', error);

      await reportError(env, error, { worker: 'claude-docs-monitor' });
      await checkIn(env, 'docs-monitor', 'error', checkInId);

      // Send error notification to Telegram
      await sendTelegramNotification(env, {
        error: error.message,
        url: 'https://code.claude.com/docs'
      });
    }
  },

  // Optional: HTTP endpoint for manual triggering
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Manual trigger endpoint
    if (url.pathname === '/trigger' && request.method === 'POST') {
      // Verify secret token
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.TRIGGER_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Trigger the scheduled function manually
      await this.scheduled(null, env, ctx);

      return new Response(JSON.stringify({
        success: true,
        message: 'Manual check triggered'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Status endpoint
    if (url.pathname === '/status') {
      const lastHash = await env.DOCS_MONITOR_KV.get('last_hash');
      const lastChecked = await env.DOCS_MONITOR_KV.get('last_checked');
      const lastChange = await env.DOCS_MONITOR_KV.get('last_change');

      return new Response(JSON.stringify({
        status: 'running',
        lastHash: lastHash ? lastHash.substring(0, 8) + '...' : null,
        lastChecked,
        lastChange: lastChange || 'Never',
        monitoredUrl: 'https://code.claude.com/docs'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response('Claude Code Docs Monitor Worker\n\nEndpoints:\n- POST /trigger (requires auth)\n- GET /status', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

/**
 * Clean HTML content for more stable hashing
 * Removes dynamic content like timestamps, analytics, etc.
 */
function cleanHTML(html) {
  // Remove common dynamic elements
  let clean = html;

  // Remove script tags
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove comments
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');

  // Remove common analytics/tracking attributes
  clean = clean.replace(/data-analytics-[^=]*="[^"]*"/gi, '');
  clean = clean.replace(/data-timestamp="[^"]*"/gi, '');

  // Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Calculate SHA-256 hash of content
 */
async function hashContent(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Send notification to Telegram
 */
async function sendTelegramNotification(env, data) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('Missing Telegram credentials');
    return false;
  }

  let message;
  const now = new Date().toLocaleString('en-US');

  if (data.error) {
    // Error notification
    message = `🚨 *Claude Code Docs Monitor Error*\n\n` +
              `❌ Error: \`${data.error}\`\n` +
              `🔗 URL: ${data.url}\n` +
              `⏰ Time: ${now}`;
  } else if (data.type === 'first_run') {
    // First run notification
    message = `🎯 *Claude Code Docs Monitor Started!*\n\n` +
              `✅ Monitoring initialized successfully\n\n` +
              `🔗 URL: [code.claude.com/docs](${data.url})\n` +
              `📝 Initial hash: \`${data.currentHash.substring(0, 12)}...\`\n` +
              `⏰ Started: ${now}\n` +
              `🔄 Checking every 5 minutes\n\n` +
              `You'll receive notifications on every check:\n` +
              `• 🔔 Changes detected\n` +
              `• ✅ No changes (status update)`;
  } else if (data.type === 'change_detected') {
    // Change detected notification
    const lastCheckedDate = data.lastChecked ? new Date(data.lastChecked).toLocaleString('en-US') : 'Unknown';

    message = `🔔 *CHANGE DETECTED!*\n\n` +
              `📍 **Changed URL:**\n` +
              `${data.url}\n\n` +
              `✅ Content was updated\n\n` +
              `📊 **Details:**\n` +
              `🔗 Full URL: [code.claude.com/docs](${data.url})\n` +
              `📝 Previous hash: \`${data.previousHash.substring(0, 12)}...\`\n` +
              `📝 New hash: \`${data.currentHash.substring(0, 12)}...\`\n` +
              `⏰ Last check: ${lastCheckedDate}\n` +
              `📅 Change detected: ${now}\n\n` +
              `👉 [View Documentation](${data.url})`;
  } else if (data.type === 'no_changes') {
    // No changes notification
    const lastCheckedDate = data.lastChecked ? new Date(data.lastChecked).toLocaleString('en-US') : 'Unknown';

    message = `✅ *Docs Monitor - No Changes*\n\n` +
              `📊 Status update: No changes detected\n\n` +
              `🔗 URL: [code.claude.com/docs](${data.url})\n` +
              `📝 Current hash: \`${data.currentHash.substring(0, 12)}...\`\n` +
              `⏰ Last check: ${lastCheckedDate}\n` +
              `📅 Current check: ${now}\n` +
              `🔄 Next check: ~5 minutes\n\n` +
              `Everything is stable 👍`;
  }

  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });

    const result = await response.json();

    if (!result.ok) {
      console.error('Telegram API error:', result);
      return false;
    }

    console.log('✅ Telegram notification sent successfully');
    return true;

  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

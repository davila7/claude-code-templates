/**
 * Check Telegram Configuration Endpoint
 *
 * This endpoint checks if Telegram credentials are configured in Vercel
 * and tests the connection.
 *
 * Usage: GET https://aitmpl.com/api/check-telegram-config
 */

import axios from 'axios';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = {
    telegram_bot_token: !!process.env.TELEGRAM_BOT_TOKEN,
    telegram_chat_id: !!process.env.TELEGRAM_CHAT_ID,
    telegram_pr_notification_chat_id: !!process.env.TELEGRAM_PR_NOTIFICATION_CHAT_ID,
    github_webhook_secret: !!process.env.GITHUB_WEBHOOK_SECRET,
    neon_database_url: !!process.env.NEON_DATABASE_URL,
  };

  const result = {
    configured: config.telegram_bot_token && (config.telegram_chat_id || config.telegram_pr_notification_chat_id),
    variables: config,
    botInfo: null,
    testResult: null,
    error: null
  };

  // If credentials exist, test them
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const botInfo = await axios.get(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
        { timeout: 5000 }
      );

      if (botInfo.data.ok) {
        result.botInfo = {
          username: botInfo.data.result.username,
          id: botInfo.data.result.id,
          first_name: botInfo.data.result.first_name,
          can_join_groups: botInfo.data.result.can_join_groups,
          can_read_all_group_messages: botInfo.data.result.can_read_all_group_messages
        };
        result.testResult = 'Bot token is valid';
      } else {
        result.error = 'Invalid bot token';
      }
    } catch (error) {
      result.error = `Bot test failed: ${error.message}`;
    }
  }

  return res.status(200).json(result);
}

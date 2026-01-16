import axios from 'axios';

/**
 * Telegram Notifier for PR Previews
 * Sends formatted notifications to Telegram when PRs are created
 */

/**
 * Format PR data for Telegram message
 */
function formatPRMessage(prData) {
  const {
    title,
    url,
    number,
    user,
    action,
    repository,
    previewUrl
  } = prData;

  const emoji = action === 'opened' ? '🚀' : '🔄';

  let message = `${emoji} *Pull Request ${action === 'opened' ? 'Opened' : 'Updated'}*\n\n`;
  message += `📝 *${title}*\n\n`;
  message += `🔢 PR #${number}\n`;
  message += `👤 Author: ${user}\n`;
  message += `📦 Repo: ${repository}\n\n`;

  if (previewUrl) {
    message += `🔗 [Preview URL](${previewUrl})\n`;
  }

  message += `🔗 [View PR](${url})`;

  return message;
}

/**
 * Send notification to Telegram
 * @param {Object} prData - PR data from GitHub webhook
 * @returns {Promise<Object>} Response with success status and details
 */
export async function sendTelegramNotification(prData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_PR_NOTIFICATION_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
  }

  if (!chatId) {
    throw new Error('TELEGRAM_PR_NOTIFICATION_CHAT_ID or TELEGRAM_CHAT_ID environment variable is not set');
  }

  const message = formatPRMessage(prData);
  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
    disable_notification: false
  };

  try {
    const response = await axios.post(telegramApiUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description || 'Unknown error'}`);
    }

    return {
      success: true,
      status: response.status,
      messageId: response.data.result.message_id,
      payload,
      response: response.data
    };
  } catch (error) {
    console.error('Error sending Telegram notification:', error.message);

    // Return detailed error information
    return {
      success: false,
      error: error.message,
      errorDetails: error.response?.data || null,
      status: error.response?.status || null,
      payload
    };
  }
}

/**
 * Extract PR data from GitHub webhook payload
 * @param {Object} webhookPayload - GitHub webhook payload
 * @returns {Object} Formatted PR data
 */
export function extractPRData(webhookPayload) {
  const { action, pull_request, repository } = webhookPayload;

  if (!pull_request) {
    throw new Error('Invalid webhook payload: missing pull_request data');
  }

  // Get preview URL - this could be from Vercel, Netlify, or other deployment
  // Look for deployment comments or construct based on branch name
  let previewUrl = null;

  // Common preview URL patterns:
  // Vercel: https://project-name-git-branch-name-user.vercel.app
  // Netlify: https://branch-name--project-name.netlify.app

  // Try to get from deployment status (if available)
  if (pull_request.statuses_url) {
    // Will be populated by deployment tools
    previewUrl = pull_request.head.repo.html_url; // Fallback to repo URL
  }

  return {
    title: pull_request.title,
    url: pull_request.html_url,
    number: pull_request.number,
    user: pull_request.user.login,
    action: action,
    repository: repository.full_name,
    branch: pull_request.head.ref,
    baseBranch: pull_request.base.ref,
    previewUrl: previewUrl,
    body: pull_request.body || '',
    state: pull_request.state,
    draft: pull_request.draft || false
  };
}

/**
 * Test Telegram configuration
 * @returns {Promise<Object>} Configuration test result
 */
export async function testTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_PR_NOTIFICATION_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

  const result = {
    configured: false,
    botTokenPresent: !!botToken,
    chatIdPresent: !!chatId,
    botInfo: null,
    error: null
  };

  if (!botToken) {
    result.error = 'TELEGRAM_BOT_TOKEN not configured';
    return result;
  }

  if (!chatId) {
    result.error = 'TELEGRAM_PR_NOTIFICATION_CHAT_ID not configured';
    return result;
  }

  try {
    // Test bot token by getting bot info
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, {
      timeout: 5000
    });

    if (response.data.ok) {
      result.configured = true;
      result.botInfo = response.data.result;
    } else {
      result.error = 'Invalid bot token';
    }
  } catch (error) {
    result.error = `Bot token test failed: ${error.message}`;
  }

  return result;
}

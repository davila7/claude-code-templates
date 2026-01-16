import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { sendTelegramNotification, extractPRData } from './telegram/telegram-notifier.js';

/**
 * GitHub PR Webhook Handler
 * Receives PR events from GitHub and sends notifications to Telegram
 */

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - GitHub signature from headers
 * @returns {boolean} Whether signature is valid
 */
function verifyGitHubSignature(payload, signature) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('⚠️ GITHUB_WEBHOOK_SECRET not set - signature verification disabled');
    return true; // Allow for development/testing
  }

  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

/**
 * Get Neon database client
 */
function getNeonClient() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    console.warn('⚠️ NEON_DATABASE_URL not configured - database logging disabled');
    return null;
  }
  return neon(connectionString);
}

/**
 * Log notification to database
 */
async function logNotification(prData, result) {
  const sql = getNeonClient();

  if (!sql) {
    console.log('📝 Skipping database logging (NEON_DATABASE_URL not configured)');
    return;
  }

  try {
    await sql`
      INSERT INTO telegram_notifications_log (
        pr_number,
        pr_title,
        pr_url,
        repository,
        action,
        chat_id,
        payload,
        response_status,
        response_body,
        error_message,
        success
      ) VALUES (
        ${prData.number},
        ${prData.title},
        ${prData.url},
        ${prData.repository},
        ${prData.action},
        ${process.env.TELEGRAM_PR_NOTIFICATION_CHAT_ID || process.env.TELEGRAM_CHAT_ID || 'not-configured'},
        ${JSON.stringify(result.payload || {})},
        ${result.status || null},
        ${JSON.stringify(result.response || {})},
        ${result.error || null},
        ${result.success}
      )
    `;
    console.log('✅ Logged notification to database');
  } catch (error) {
    console.error('❌ Error logging to database:', error.message);
  }
}

/**
 * Main webhook handler
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-Event, X-Hub-Signature-256');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('📥 Received GitHub webhook request');

  try {
    // Get GitHub event type
    const githubEvent = req.headers['x-github-event'];
    console.log('🔔 Event type:', githubEvent);

    // Only process pull_request events
    if (githubEvent !== 'pull_request') {
      console.log('⏭️  Ignoring non-PR event:', githubEvent);
      return res.status(200).json({
        success: true,
        message: `Event type ${githubEvent} ignored (only pull_request events are processed)`
      });
    }

    // Verify webhook signature for security
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = JSON.stringify(req.body);

    if (!verifyGitHubSignature(rawBody, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('✅ Signature verified');

    // Extract PR data from webhook payload
    const webhookPayload = req.body;
    const action = webhookPayload.action;

    // Only process opened and synchronize (updated) PRs
    const processedActions = ['opened', 'synchronize', 'reopened'];
    if (!processedActions.includes(action)) {
      console.log(`⏭️  Ignoring action: ${action}`);
      return res.status(200).json({
        success: true,
        message: `Action ${action} ignored (only ${processedActions.join(', ')} are processed)`
      });
    }

    console.log('🔄 Processing PR action:', action);

    // Extract and format PR data
    const prData = extractPRData(webhookPayload);
    console.log(`📋 PR #${prData.number}: ${prData.title}`);

    // Skip draft PRs if configured
    if (prData.draft && process.env.TELEGRAM_SKIP_DRAFT_PRS === 'true') {
      console.log('⏭️  Skipping draft PR');
      return res.status(200).json({
        success: true,
        message: 'Draft PR skipped'
      });
    }

    // Send Telegram notification
    console.log('📤 Sending Telegram notification...');
    const result = await sendTelegramNotification(prData);

    // Log to database
    await logNotification(prData, result);

    if (result.success) {
      console.log('✅ Telegram notification sent successfully');
      return res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
        data: {
          prNumber: prData.number,
          prTitle: prData.title,
          messageId: result.messageId
        }
      });
    } else {
      console.error('❌ Failed to send Telegram notification:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send notification',
        details: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

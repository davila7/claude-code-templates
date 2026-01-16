#!/usr/bin/env node

/**
 * Setup script for Telegram PR Notifications
 *
 * This script:
 * 1. Checks required environment variables
 * 2. Generates GITHUB_WEBHOOK_SECRET if needed
 * 3. Runs database migration to Neon
 * 4. Tests Telegram bot configuration
 * 5. Provides next steps for GitHub webhook setup
 *
 * Note: Run this from the project root: node scripts/setup-telegram-pr-notifications.js
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamically import from api/node_modules
const require = createRequire(import.meta.url);
const apiPath = path.join(__dirname, '../api');

let neon, axios;

// Try to load dependencies from api directory
try {
  const neonModule = await import(path.join(apiPath, 'node_modules/@neondatabase/serverless/index.js'));
  neon = neonModule.neon;

  const axiosModule = await import(path.join(apiPath, 'node_modules/axios/index.js'));
  axios = axiosModule.default;
} catch (error) {
  console.error('❌ Failed to load dependencies. Make sure to run: cd api && npm install');
  console.error('Error:', error.message);
  process.exit(1);
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function checkEnvironmentVariables() {
  logSection('📋 Checking Environment Variables');

  const required = {
    'TELEGRAM_BOT_TOKEN': process.env.TELEGRAM_BOT_TOKEN,
    'TELEGRAM_CHAT_ID': process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_PR_NOTIFICATION_CHAT_ID,
    'NEON_DATABASE_URL': process.env.NEON_DATABASE_URL,
    'GITHUB_WEBHOOK_SECRET': process.env.GITHUB_WEBHOOK_SECRET,
  };

  const optional = {
    'TELEGRAM_PR_NOTIFICATION_CHAT_ID': process.env.TELEGRAM_PR_NOTIFICATION_CHAT_ID,
    'TELEGRAM_SKIP_DRAFT_PRS': process.env.TELEGRAM_SKIP_DRAFT_PRS,
  };

  let allPresent = true;
  let needsWebhookSecret = false;

  console.log('\nRequired variables:');
  for (const [key, value] of Object.entries(required)) {
    if (value) {
      log(`  ✅ ${key}: Set`, 'green');
    } else {
      log(`  ❌ ${key}: Not set`, 'red');
      allPresent = false;
      if (key === 'GITHUB_WEBHOOK_SECRET') {
        needsWebhookSecret = true;
      }
    }
  }

  console.log('\nOptional variables:');
  for (const [key, value] of Object.entries(optional)) {
    if (value) {
      log(`  ✅ ${key}: Set`, 'green');
    } else {
      log(`  ⚪ ${key}: Not set (optional)`, 'yellow');
    }
  }

  return { allPresent, needsWebhookSecret, required };
}

async function generateWebhookSecret() {
  logSection('🔐 Generating GitHub Webhook Secret');

  const secret = crypto.randomBytes(32).toString('hex');

  log('\nGenerated webhook secret:', 'bright');
  log(`  ${secret}`, 'yellow');

  log('\n📝 Add this to your environment:', 'cyan');
  log(`  GITHUB_WEBHOOK_SECRET=${secret}`, 'bright');

  log('\n⚠️  Save this secret! You\'ll need to:', 'yellow');
  log('  1. Add it to Vercel environment variables', 'yellow');
  log('  2. Add it to GitHub secrets (if using GitHub Actions)', 'yellow');
  log('  3. Use it when configuring the GitHub webhook', 'yellow');

  return secret;
}

async function testTelegramBot() {
  logSection('🤖 Testing Telegram Bot Configuration');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_PR_NOTIFICATION_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

  if (!botToken) {
    log('❌ TELEGRAM_BOT_TOKEN not set - skipping test', 'red');
    return false;
  }

  if (!chatId) {
    log('❌ TELEGRAM_CHAT_ID not set - skipping test', 'red');
    return false;
  }

  try {
    // Test 1: Get bot info
    log('\n1️⃣ Testing bot token...', 'cyan');
    const botInfo = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, {
      timeout: 5000
    });

    if (botInfo.data.ok) {
      log(`  ✅ Bot connected: @${botInfo.data.result.username}`, 'green');
      log(`  Bot ID: ${botInfo.data.result.id}`, 'bright');
      log(`  Bot name: ${botInfo.data.result.first_name}`, 'bright');
    } else {
      log('  ❌ Invalid bot token', 'red');
      return false;
    }

    // Test 2: Send test message
    log('\n2️⃣ Sending test notification...', 'cyan');
    const testMessage = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: '🧪 *Test Notification*\n\nTelegram PR notifications are configured correctly!\n\nSetup completed at: ' + new Date().toISOString(),
        parse_mode: 'Markdown'
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (testMessage.data.ok) {
      log('  ✅ Test message sent successfully!', 'green');
      log('  Check your Telegram chat for the test message.', 'bright');
      return true;
    } else {
      log('  ❌ Failed to send test message', 'red');
      return false;
    }
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    if (error.response?.data) {
      log(`  Details: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function runDatabaseMigration() {
  logSection('🗄️  Running Database Migration');

  const dbUrl = process.env.NEON_DATABASE_URL;

  if (!dbUrl) {
    log('⚠️  NEON_DATABASE_URL not set - skipping migration', 'yellow');
    log('Database logging will be disabled unless you configure this later.', 'yellow');
    return false;
  }

  try {
    const sql = neon(dbUrl);

    log('\n📝 Reading migration file...', 'cyan');
    const migrationPath = path.join(__dirname, '../database/migrations/003_create_telegram_notifications_log.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    log('🚀 Executing migration...', 'cyan');

    // Split the migration into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        await sql.unsafe(statement);
      }
    }

    log('✅ Migration completed successfully!', 'green');

    // Verify table was created
    log('\n🔍 Verifying table creation...', 'cyan');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'telegram_notifications_log'
    `;

    if (tables.length > 0) {
      log('✅ Table telegram_notifications_log exists', 'green');
    } else {
      log('❌ Table not found after migration', 'red');
      return false;
    }

    return true;
  } catch (error) {
    log(`❌ Migration failed: ${error.message}`, 'red');
    if (error.message.includes('already exists')) {
      log('ℹ️  Migration already applied (table exists)', 'yellow');
      return true;
    }
    return false;
  }
}

async function displayNextSteps(webhookSecret) {
  logSection('📌 Next Steps');

  log('\n1️⃣ Configure Environment Variables in Vercel:', 'cyan');
  log('   • Go to Vercel Dashboard → Your Project → Settings → Environment Variables', 'bright');
  log('   • Add the following variables:\n', 'bright');

  const vars = [
    ['TELEGRAM_BOT_TOKEN', process.env.TELEGRAM_BOT_TOKEN || 'your_bot_token'],
    ['TELEGRAM_PR_NOTIFICATION_CHAT_ID', process.env.TELEGRAM_PR_NOTIFICATION_CHAT_ID || process.env.TELEGRAM_CHAT_ID || 'your_chat_id'],
    ['GITHUB_WEBHOOK_SECRET', webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || 'generate_one_above'],
    ['TELEGRAM_SKIP_DRAFT_PRS', 'true'],
  ];

  vars.forEach(([key, value]) => {
    log(`     ${key}=${value}`, 'yellow');
  });

  log('\n2️⃣ Deploy to Vercel (automatic on merge to main):', 'cyan');
  log('   • The code is already in your branch', 'bright');
  log('   • Merge your PR to main to deploy automatically', 'bright');
  log('   • Or deploy manually: vercel --prod', 'bright');

  log('\n3️⃣ Configure GitHub Webhook:', 'cyan');
  log('   • Go to: GitHub Repo → Settings → Webhooks → Add webhook', 'bright');
  log('   • Payload URL: https://aitmpl.com/api/github-pr-webhook', 'bright');
  log('   • Content type: application/json', 'bright');
  log('   • Secret: (use the GITHUB_WEBHOOK_SECRET value)', 'bright');
  log('   • Events: Select "Pull requests" only', 'bright');
  log('   • Active: ✅ Checked', 'bright');

  log('\n4️⃣ Test the Setup:', 'cyan');
  log('   • Create a test Pull Request', 'bright');
  log('   • Check your Telegram chat for notification', 'bright');
  log('   • Check GitHub webhook deliveries for any errors', 'bright');

  log('\n📚 Documentation:', 'cyan');
  log('   • Setup guide: docs/telegram-pr-notifications-setup.md', 'bright');
  log('   • API docs: api/telegram/README.md', 'bright');
}

async function saveWebhookSecretToFile(secret) {
  logSection('💾 Saving Configuration');

  const configPath = path.join(__dirname, '../.webhook-secret');

  try {
    fs.writeFileSync(configPath, `GITHUB_WEBHOOK_SECRET=${secret}\n`, 'utf8');
    log(`✅ Webhook secret saved to: ${configPath}`, 'green');
    log('⚠️  Remember to add this to .gitignore and never commit it!', 'yellow');

    // Check if it's in .gitignore
    const gitignorePath = path.join(__dirname, '../.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignore.includes('.webhook-secret')) {
        fs.appendFileSync(gitignorePath, '\n# Webhook secrets\n.webhook-secret\n');
        log('✅ Added .webhook-secret to .gitignore', 'green');
      }
    }
  } catch (error) {
    log(`❌ Failed to save webhook secret: ${error.message}`, 'red');
  }
}

// Main execution
async function main() {
  log('\n🚀 Telegram PR Notifications Setup\n', 'bright');

  try {
    // Step 1: Check environment variables
    const { allPresent, needsWebhookSecret, required } = await checkEnvironmentVariables();

    // Step 2: Generate webhook secret if needed
    let webhookSecret = null;
    if (needsWebhookSecret) {
      webhookSecret = await generateWebhookSecret();
      await saveWebhookSecretToFile(webhookSecret);
    }

    // Step 3: Test Telegram bot
    if (required.TELEGRAM_BOT_TOKEN) {
      await testTelegramBot();
    } else {
      log('\n⚠️  Skipping Telegram bot test (credentials not set)', 'yellow');
    }

    // Step 4: Run database migration
    if (required.NEON_DATABASE_URL) {
      await runDatabaseMigration();
    }

    // Step 5: Display next steps
    await displayNextSteps(webhookSecret);

    log('\n✨ Setup script completed!\n', 'green');

    if (!allPresent) {
      log('⚠️  Some environment variables are missing.', 'yellow');
      log('Please configure them in Vercel before deploying.\n', 'yellow');
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

main();

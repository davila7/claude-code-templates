# Telegram PR Notifier Module

This module handles sending Telegram notifications for GitHub Pull Requests.

## Files

- **telegram-notifier.js** - Core notification logic and Telegram API integration

## Functions

### `sendTelegramNotification(prData)`

Sends a formatted notification to Telegram when a PR is created or updated.

**Parameters:**
- `prData` (Object) - PR data extracted from GitHub webhook
  - `title` (string) - PR title
  - `url` (string) - PR URL
  - `number` (number) - PR number
  - `user` (string) - PR author username
  - `action` (string) - GitHub action (opened, synchronize, etc.)
  - `repository` (string) - Full repository name (owner/repo)
  - `previewUrl` (string) - Optional preview deployment URL

**Returns:**
- Promise<Object> - Result object with success status and details

**Example:**
```javascript
import { sendTelegramNotification } from './telegram-notifier.js';

const result = await sendTelegramNotification({
  title: 'Add new feature',
  url: 'https://github.com/owner/repo/pull/42',
  number: 42,
  user: 'developer',
  action: 'opened',
  repository: 'owner/repo',
  previewUrl: 'https://preview-pr42.vercel.app'
});

if (result.success) {
  console.log('Notification sent:', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

### `extractPRData(webhookPayload)`

Extracts and formats PR data from a GitHub webhook payload.

**Parameters:**
- `webhookPayload` (Object) - Raw GitHub webhook payload

**Returns:**
- Object - Formatted PR data ready for notification

**Example:**
```javascript
import { extractPRData } from './telegram-notifier.js';

// From GitHub webhook
const prData = extractPRData(req.body);
```

### `formatPRMessage(prData)`

Formats PR data into a Telegram-friendly markdown message.

**Parameters:**
- `prData` (Object) - Formatted PR data

**Returns:**
- string - Formatted markdown message

**Message Format:**
```
🚀 Pull Request Opened

📝 PR Title Here

🔢 PR #42
👤 Author: username
📦 Repo: owner/repository

🔗 Preview URL
🔗 View PR
```

### `testTelegramConfig()`

Tests Telegram bot configuration by verifying the bot token.

**Returns:**
- Promise<Object> - Configuration test result

**Example:**
```javascript
import { testTelegramConfig } from './telegram-notifier.js';

const test = await testTelegramConfig();

if (test.configured) {
  console.log('Bot configured:', test.botInfo.username);
} else {
  console.error('Configuration error:', test.error);
}
```

## Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `TELEGRAM_PR_NOTIFICATION_CHAT_ID` - Chat ID for notifications

Optional:
- `TELEGRAM_CHAT_ID` - Fallback chat ID

## Error Handling

The module handles errors gracefully:

```javascript
const result = await sendTelegramNotification(prData);

if (!result.success) {
  console.error('Error:', result.error);
  console.error('Details:', result.errorDetails);
  console.error('Status:', result.status);
}
```

## Message Customization

To customize the notification format, edit the `formatPRMessage()` function:

```javascript
function formatPRMessage(prData) {
  const { title, url, number, user, repository } = prData;

  // Custom format
  return `
🎯 New PR #${number}: ${title}
👤 By: ${user}
📦 ${repository}
🔗 ${url}
  `.trim();
}
```

## Telegram API Reference

This module uses the following Telegram Bot API endpoints:

- **sendMessage** - Send text messages
  - Endpoint: `https://api.telegram.org/bot{token}/sendMessage`
  - Supports Markdown formatting
  - [Documentation](https://core.telegram.org/bots/api#sendmessage)

- **getMe** - Get bot information
  - Endpoint: `https://api.telegram.org/bot{token}/getMe`
  - Used for configuration testing
  - [Documentation](https://core.telegram.org/bots/api#getme)

## Testing

```javascript
// Test configuration
const config = await testTelegramConfig();
console.log('Bot configured:', config.configured);
console.log('Bot username:', config.botInfo?.username);

// Test notification
const testPR = {
  title: 'Test PR',
  url: 'https://github.com/test/repo/pull/1',
  number: 1,
  user: 'testuser',
  action: 'opened',
  repository: 'test/repo',
  previewUrl: null
};

const result = await sendTelegramNotification(testPR);
console.log('Test result:', result.success);
```

## Rate Limits

Telegram Bot API has the following limits:
- 30 messages per second
- 20 messages per minute to the same group

For high-volume repositories, consider implementing a queue system.

## Security

- Bot tokens are never logged or exposed
- All API requests use HTTPS
- Timeouts prevent hanging requests (10s default)
- Error messages don't include sensitive data

## Dependencies

```json
{
  "axios": "^1.6.2"
}
```

## Related Files

- `/api/github-pr-webhook.js` - Main webhook handler that uses this module
- `/database/migrations/003_create_telegram_notifications_log.sql` - Database schema
- `/docs/telegram-pr-notifications-setup.md` - Setup guide

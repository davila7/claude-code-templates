---
name: Telegram Bot Builder
description: This skill should be used when the user asks to "create a Telegram bot", "build a Telegram chatbot", "set up a Telegram webhook", "add inline keyboards to a bot", "handle Telegram callback queries", "implement Telegram payments", "send media via Telegram bot", "configure Telegram bot commands", "deploy a Telegram bot", or mentions the Telegram Bot API, telegram bot tokens, getUpdates, setWebhook, or bot frameworks like node-telegram-bot-api, grammy, python-telegram-bot, or aiogram. Provides comprehensive guidance for building production-ready Telegram bots with Node.js and Python.
---

# Telegram Bot Builder

Comprehensive guidance for building Telegram bots using the Bot API (v9.4). Covers both Node.js and Python ecosystems with production-ready patterns for authentication, messaging, keyboards, media handling, payments, inline mode, webhooks, and deployment.

## When to Use This Skill

Use this skill when:
- Building a new Telegram bot from scratch
- Integrating Telegram messaging into an existing application
- Setting up webhooks or long polling for bot updates
- Creating interactive menus with inline keyboards and callback queries
- Handling media (photos, videos, documents, stickers)
- Implementing Telegram Payments or Telegram Stars
- Building inline mode functionality
- Managing groups, channels, or forum topics via bot
- Deploying bots to production (Docker, PM2, serverless)

## Core Concepts

### Authentication

Every bot has a unique token obtained from [@BotFather](https://t.me/BotFather). Token format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`.

All API calls go to: `https://api.telegram.org/bot<TOKEN>/METHOD_NAME`

```bash
# .env file
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

Store the token in environment variables. Never commit it to source code.

### Receiving Updates: Polling vs Webhook

**Long Polling** (`getUpdates`) - Simpler, no HTTPS required, ideal for development:

```javascript
// Node.js with node-telegram-bot-api
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
```

```python
# Python with python-telegram-bot
app = Application.builder().token(os.getenv("BOT_TOKEN")).build()
app.run_polling()
```

**Webhook** (`setWebhook`) - Better for production, lower latency, requires HTTPS (ports 443, 80, 88, or 8443):

```javascript
bot.setWebHook('https://yourdomain.com/webhook', { secret_token: SECRET });
```

Choose polling for development and small bots. Choose webhooks for production deployments handling high traffic.

### Message Types & Formatting

Send text with `sendMessage`. Supported parse modes:

- **HTML**: `<b>bold</b>`, `<i>italic</i>`, `<code>code</code>`, `<pre>block</pre>`, `<a href="url">link</a>`, `<tg-spoiler>spoiler</tg-spoiler>`
- **MarkdownV2**: `*bold*`, `_italic_`, `` `code` ``, ` ```block``` `, `[link](url)`, `||spoiler||`. Requires escaping: `_*[]()~>#+-=|{}.!`

Prefer HTML for easier escaping. Use MarkdownV2 when simpler formatting suffices.

### Keyboards & Interactive Elements

**Inline Keyboard** - Buttons attached to messages:

```javascript
bot.sendMessage(chatId, 'Choose:', {
  reply_markup: {
    inline_keyboard: [
      [{ text: 'Option A', callback_data: 'a' }, { text: 'Option B', callback_data: 'b' }],
      [{ text: 'Visit Site', url: 'https://example.com' }]
    ]
  }
});
```

**Reply Keyboard** - Custom keyboard below input field:

```javascript
bot.sendMessage(chatId, 'Choose:', {
  reply_markup: {
    keyboard: [[{ text: '📊 Stats' }, { text: '⚙️ Settings' }]],
    resize_keyboard: true,
    one_time_keyboard: true
  }
});
```

Handle inline button presses with `callback_query`. The `callback_data` field is limited to 64 bytes. Always call `answerCallbackQuery` to dismiss the loading indicator.

### Sending Media

```javascript
// Photo (file_id, URL, or upload)
bot.sendPhoto(chatId, 'https://example.com/photo.jpg', { caption: 'A photo' });

// Document
bot.sendDocument(chatId, fs.createReadStream('./file.pdf'), { caption: 'Report' });

// Album (2-10 items)
bot.sendMediaGroup(chatId, [
  { type: 'photo', media: 'https://example.com/1.jpg', caption: 'First' },
  { type: 'photo', media: 'https://example.com/2.jpg' }
]);
```

Three ways to specify files: `file_id` (reuse previously uploaded), HTTP URL (Telegram downloads it), or multipart upload. File limits: 50MB upload, 20MB download via Bot API.

### Conversation State

For multi-step interactions (registration, forms, wizards), maintain conversation state per chat:

- **Node.js**: Use a `Map` or Redis to track `{ step, data }` per `chatId`
- **Python**: Use `ConversationHandler` from `python-telegram-bot` (built-in state machine)

See `reference/patterns_and_examples.md` for complete conversation flow implementations.

### Error Handling

Handle common error scenarios:
- **429 Too Many Requests**: Read `retry_after` from response, wait, then retry
- **403 Forbidden**: Bot was blocked by user or removed from chat
- **400 Bad Request**: Invalid parameters (check `description` field)
- **409 Conflict**: Another bot instance using same token with polling

Rate limits: ~30 messages/second to different chats, ~20 messages/minute to same group. Implement exponential backoff for retries.

### Bot Commands

Register commands visible in the Telegram menu:

```javascript
bot.setMyCommands([
  { command: 'start', description: 'Start the bot' },
  { command: 'help', description: 'Show help' },
  { command: 'settings', description: 'Bot settings' }
]);
```

Commands can be scoped to specific chats, users, or languages using `BotCommandScope`.

## Common Patterns

### Quick Start (Node.js)

```bash
mkdir my-bot && cd my-bot
npm init -y
npm install node-telegram-bot-api dotenv
echo "BOT_TOKEN=your_token_here" > .env
```

### Quick Start (Python)

```bash
mkdir my-bot && cd my-bot
pip install python-telegram-bot python-dotenv
echo "BOT_TOKEN=your_token_here" > .env
```

### Popular Libraries

| Language | Library | Style | Best For |
|---|---|---|---|
| Node.js | `node-telegram-bot-api` | Callback-based | Simple bots, quick prototypes |
| Node.js | `grammy` | Middleware-based | Complex bots, plugins |
| Node.js | `telegraf` | Middleware-based | Mature ecosystem |
| Python | `python-telegram-bot` | Handler-based | Full-featured, conversations |
| Python | `aiogram` | Async-first | High-performance async bots |

### Key API Method Categories

| Category | Key Methods |
|---|---|
| Messages | `sendMessage`, `sendPhoto`, `sendVideo`, `sendDocument`, `editMessageText`, `deleteMessage` |
| Keyboards | `InlineKeyboardMarkup`, `ReplyKeyboardMarkup`, `answerCallbackQuery` |
| Chat Mgmt | `getChat`, `banChatMember`, `promoteChatMember`, `setChatPermissions` |
| Files | `getFile`, `sendMediaGroup`, `sendDocument` |
| Inline Mode | `answerInlineQuery` with `InlineQueryResult*` types |
| Payments | `sendInvoice`, `answerPreCheckoutQuery` (use `currency: "XTR"` for Telegram Stars) |
| Bot Config | `setMyCommands`, `setMyDescription`, `setWebhook` |

## Deployment Options

- **PM2**: `pm2 start bot.js --name telegram-bot` - Process manager with auto-restart
- **Docker**: Containerized deployment with `docker-compose`
- **Serverless**: Webhook handler as Vercel/AWS Lambda function
- **VPS**: Direct deployment with systemd service

See `reference/patterns_and_examples.md` for Docker, PM2, and serverless deployment configurations.

## Security Checklist

- Store `BOT_TOKEN` in environment variables
- Validate `X-Telegram-Bot-Api-Secret-Token` on webhook endpoints
- Verify user IDs for admin commands
- Implement per-user rate limiting
- Sanitize user input before database storage
- Use HTTPS for all webhook endpoints
- Restrict `allowed_updates` to only needed types

## Reference Files

For detailed API documentation and implementation patterns, consult:

- **[`reference/api_methods.md`](./reference/api_methods.md)** - Complete list of 100+ Bot API methods organized by category (messaging, chat management, stickers, payments, inline mode, games, forum topics, gifts, passport, and more)
- **[`reference/api_types.md`](./reference/api_types.md)** - Complete list of 200+ Bot API types with all fields (Update, Message, Chat, User, keyboards, media types, payment types, chat members, reactions, and more)
- **[`reference/patterns_and_examples.md`](./reference/patterns_and_examples.md)** - Production-ready implementation patterns for Node.js and Python including: inline keyboards, webhooks, media handling, conversation state management, database integration, admin panels, multi-language support, Docker/PM2/serverless deployment, Telegram Stars payments, and inline mode

When building a bot, start with SKILL.md for core concepts, then load the appropriate reference file for detailed API information or implementation patterns as needed.

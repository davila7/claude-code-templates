# Telegram Bot - Implementation Patterns & Examples

> Production-ready patterns for Node.js and Python Telegram bots.

---

## Node.js Patterns

### Quick Setup with `node-telegram-bot-api`

```bash
npm init -y
npm install node-telegram-bot-api dotenv
```

```javascript
// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Command handler
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome! Use /help to see commands.');
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '*Available Commands:*\n' +
    '/start - Start the bot\n' +
    '/help - Show this help\n' +
    '/echo <text> - Echo your message',
    { parse_mode: 'Markdown' }
  );
});

// Echo command with argument capture
bot.onText(/\/echo (.+)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, match[1]);
});

console.log('Bot is running...');
```

### Quick Setup with `grammy`

```bash
npm init -y
npm install grammy dotenv
```

```javascript
// bot.js
require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');

const bot = new Bot(process.env.BOT_TOKEN);

bot.command('start', (ctx) => ctx.reply('Welcome!'));

bot.command('menu', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text('Option A', 'action_a').text('Option B', 'action_b').row()
    .text('Cancel', 'cancel');
  await ctx.reply('Choose an option:', { reply_markup: keyboard });
});

bot.callbackQuery('action_a', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'You chose A!' });
  await ctx.editMessageText('You selected Option A.');
});

bot.callbackQuery('action_b', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'You chose B!' });
  await ctx.editMessageText('You selected Option B.');
});

bot.callbackQuery('cancel', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.deleteMessage();
});

bot.start();
```

### Inline Keyboard with Callback Data

```javascript
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Choose an action:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 Stats', callback_data: 'stats' },
          { text: '⚙️ Settings', callback_data: 'settings' }
        ],
        [
          { text: '❓ Help', callback_data: 'help' },
          { text: '❌ Close', callback_data: 'close' }
        ]
      ]
    }
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  switch (query.data) {
    case 'stats':
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText('📊 Your stats:\n\nMessages: 42\nDays active: 7', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [[{ text: '◀️ Back', callback_data: 'back_to_menu' }]]
        }
      });
      break;

    case 'settings':
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText('⚙️ Settings:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔔 Notifications: ON', callback_data: 'toggle_notif' }],
            [{ text: '🌐 Language: EN', callback_data: 'change_lang' }],
            [{ text: '◀️ Back', callback_data: 'back_to_menu' }]
          ]
        }
      });
      break;

    case 'close':
      await bot.answerCallbackQuery(query.id);
      await bot.deleteMessage(chatId, messageId);
      break;

    case 'back_to_menu':
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText('Choose an action:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Stats', callback_data: 'stats' },
              { text: '⚙️ Settings', callback_data: 'settings' }
            ],
            [
              { text: '❓ Help', callback_data: 'help' },
              { text: '❌ Close', callback_data: 'close' }
            ]
          ]
        }
      });
      break;
  }
});
```

### Webhook with Express

```javascript
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const bot = new TelegramBot(process.env.BOT_TOKEN);

const WEBHOOK_URL = process.env.WEBHOOK_URL; // https://yourdomain.com/bot
const SECRET_TOKEN = process.env.WEBHOOK_SECRET;

// Set webhook
bot.setWebHook(`${WEBHOOK_URL}/${process.env.BOT_TOKEN}`, {
  secret_token: SECRET_TOKEN
});

// Parse JSON body
app.use(express.json());

// Webhook endpoint
app.post(`/bot/${process.env.BOT_TOKEN}`, (req, res) => {
  // Verify secret token
  if (req.headers['x-telegram-bot-api-secret-token'] !== SECRET_TOKEN) {
    return res.sendStatus(401);
  }

  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Register handlers
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Bot is running via webhook!');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Webhook server running on port ${process.env.PORT || 3000}`);
});
```

### Media Handling

```javascript
// Send photo from URL
bot.sendPhoto(chatId, 'https://example.com/image.jpg', {
  caption: '<b>Beautiful image</b>\nSource: example.com',
  parse_mode: 'HTML'
});

// Send photo from file
const fs = require('fs');
bot.sendPhoto(chatId, fs.createReadStream('./image.png'), {
  caption: 'Local image'
});

// Send document
bot.sendDocument(chatId, fs.createReadStream('./report.pdf'), {
  caption: 'Monthly report'
});

// Send media group (album)
bot.sendMediaGroup(chatId, [
  { type: 'photo', media: 'https://example.com/1.jpg', caption: 'Photo 1' },
  { type: 'photo', media: 'https://example.com/2.jpg' },
  { type: 'photo', media: 'https://example.com/3.jpg' }
]);

// Handle incoming photos
bot.on('photo', async (msg) => {
  // Get highest resolution
  const photo = msg.photo[msg.photo.length - 1];
  const file = await bot.getFile(photo.file_id);
  const downloadUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  bot.sendMessage(msg.chat.id, `Photo received! Size: ${photo.width}x${photo.height}`);
});

// Handle documents
bot.on('document', async (msg) => {
  const doc = msg.document;
  bot.sendMessage(msg.chat.id,
    `Document received:\n` +
    `Name: ${doc.file_name}\n` +
    `Type: ${doc.mime_type}\n` +
    `Size: ${(doc.file_size / 1024).toFixed(1)} KB`
  );
});
```

### Conversation State Management

```javascript
const conversations = new Map();

function getState(chatId) {
  return conversations.get(chatId) || { step: 'idle', data: {} };
}

function setState(chatId, step, data = {}) {
  const current = getState(chatId);
  conversations.set(chatId, { step, data: { ...current.data, ...data } });
}

function clearState(chatId) {
  conversations.delete(chatId);
}

// Registration flow
bot.onText(/\/register/, (msg) => {
  setState(msg.chat.id, 'awaiting_name');
  bot.sendMessage(msg.chat.id, 'Let\'s register! What is your name?', {
    reply_markup: { force_reply: true }
  });
});

bot.on('message', async (msg) => {
  if (msg.text?.startsWith('/')) return; // Skip commands

  const state = getState(msg.chat.id);

  switch (state.step) {
    case 'awaiting_name':
      setState(msg.chat.id, 'awaiting_email', { name: msg.text });
      bot.sendMessage(msg.chat.id, `Nice, ${msg.text}! Now enter your email:`, {
        reply_markup: { force_reply: true }
      });
      break;

    case 'awaiting_email':
      if (!msg.text.includes('@')) {
        bot.sendMessage(msg.chat.id, 'Please enter a valid email address:');
        return;
      }
      setState(msg.chat.id, 'confirming', { email: msg.text });
      const data = getState(msg.chat.id).data;
      bot.sendMessage(msg.chat.id,
        `Please confirm your registration:\n\n` +
        `Name: ${data.name}\n` +
        `Email: ${data.email}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Confirm', callback_data: 'reg_confirm' },
                { text: '❌ Cancel', callback_data: 'reg_cancel' }
              ]
            ]
          }
        }
      );
      break;
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'reg_confirm') {
    const data = getState(chatId).data;
    // Save to database here
    await bot.answerCallbackQuery(query.id, { text: 'Registration complete!' });
    await bot.editMessageText(
      `✅ Registration successful!\n\nName: ${data.name}\nEmail: ${data.email}`,
      { chat_id: chatId, message_id: query.message.message_id }
    );
    clearState(chatId);
  }

  if (query.data === 'reg_cancel') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText('Registration cancelled.', {
      chat_id: chatId, message_id: query.message.message_id
    });
    clearState(chatId);
  }
});
```

### Error Handling & Rate Limiting

```javascript
// Global error handler
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

// Retry wrapper for API calls
async function safeSend(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.statusCode === 429) {
        const retryAfter = error.response.body?.parameters?.retry_after || 5;
        console.warn(`Rate limited. Retrying in ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (error.response?.statusCode === 403) {
        console.warn('Bot blocked by user or kicked from chat');
        return null;
      }
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Usage
await safeSend(() => bot.sendMessage(chatId, 'Hello!'));
```

---

## Python Patterns

### Quick Setup with `python-telegram-bot`

```bash
pip install python-telegram-bot python-dotenv
```

```python
# bot.py
import os
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    MessageHandler, ConversationHandler, filters
)

load_dotenv()

async def start(update: Update, context):
    keyboard = [
        [InlineKeyboardButton("📊 Stats", callback_data="stats"),
         InlineKeyboardButton("⚙️ Settings", callback_data="settings")],
        [InlineKeyboardButton("❓ Help", callback_data="help")]
    ]
    await update.message.reply_text(
        "Welcome! Choose an option:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def help_command(update: Update, context):
    await update.message.reply_text(
        "*Available Commands:*\n"
        "/start - Start the bot\n"
        "/help - Show help\n"
        "/register - Registration flow",
        parse_mode="Markdown"
    )

async def button_callback(update: Update, context):
    query = update.callback_query
    await query.answer()

    if query.data == "stats":
        await query.edit_message_text("📊 Your stats:\nMessages: 42")
    elif query.data == "settings":
        await query.edit_message_text("⚙️ Settings panel")
    elif query.data == "help":
        await query.edit_message_text("❓ Use /help for command list")

def main():
    app = Application.builder().token(os.getenv("BOT_TOKEN")).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CallbackQueryHandler(button_callback))

    print("Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()
```

### Conversation Handler (Multi-step Flow)

```python
from telegram.ext import ConversationHandler, CommandHandler, MessageHandler, filters

NAME, EMAIL, CONFIRM = range(3)

async def register_start(update: Update, context):
    await update.message.reply_text("Let's register! What is your name?")
    return NAME

async def receive_name(update: Update, context):
    context.user_data["name"] = update.message.text
    await update.message.reply_text(f"Nice, {update.message.text}! Enter your email:")
    return EMAIL

async def receive_email(update: Update, context):
    email = update.message.text
    if "@" not in email:
        await update.message.reply_text("Please enter a valid email:")
        return EMAIL

    context.user_data["email"] = email
    name = context.user_data["name"]

    keyboard = [
        [InlineKeyboardButton("✅ Confirm", callback_data="reg_confirm"),
         InlineKeyboardButton("❌ Cancel", callback_data="reg_cancel")]
    ]
    await update.message.reply_text(
        f"Confirm registration:\n\nName: {name}\nEmail: {email}",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    return CONFIRM

async def confirm_registration(update: Update, context):
    query = update.callback_query
    await query.answer()

    if query.data == "reg_confirm":
        data = context.user_data
        await query.edit_message_text(
            f"✅ Registered!\nName: {data['name']}\nEmail: {data['email']}"
        )
    else:
        await query.edit_message_text("Registration cancelled.")

    context.user_data.clear()
    return ConversationHandler.END

async def cancel(update: Update, context):
    await update.message.reply_text("Cancelled.")
    context.user_data.clear()
    return ConversationHandler.END

# Register the conversation handler
conv_handler = ConversationHandler(
    entry_points=[CommandHandler("register", register_start)],
    states={
        NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_name)],
        EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_email)],
        CONFIRM: [CallbackQueryHandler(confirm_registration)],
    },
    fallbacks=[CommandHandler("cancel", cancel)],
)

app.add_handler(conv_handler)
```

### Webhook with Python (Flask / FastAPI)

```python
# webhook_bot.py (with FastAPI)
import os
from fastapi import FastAPI, Request, Response
from telegram import Update
from telegram.ext import Application, CommandHandler

app = FastAPI()
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")
SECRET_TOKEN = os.getenv("WEBHOOK_SECRET")

# Build application
application = Application.builder().token(BOT_TOKEN).build()

async def start(update: Update, context):
    await update.message.reply_text("Bot running via webhook!")

application.add_handler(CommandHandler("start", start))

@app.on_event("startup")
async def on_startup():
    await application.initialize()
    await application.bot.set_webhook(
        url=f"{WEBHOOK_URL}/webhook",
        secret_token=SECRET_TOKEN
    )

@app.post("/webhook")
async def webhook(request: Request):
    if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != SECRET_TOKEN:
        return Response(status_code=401)

    data = await request.json()
    update = Update.de_json(data, application.bot)
    await application.process_update(update)
    return Response(status_code=200)

@app.on_event("shutdown")
async def on_shutdown():
    await application.shutdown()
```

### Media Handling in Python

```python
from telegram import InputMediaPhoto

async def handle_photo(update: Update, context):
    """Process incoming photos."""
    photo = update.message.photo[-1]  # Highest resolution
    file = await context.bot.get_file(photo.file_id)
    await file.download_to_drive(f"downloads/{photo.file_unique_id}.jpg")
    await update.message.reply_text(
        f"Photo saved! Size: {photo.width}x{photo.height}"
    )

async def send_album(update: Update, context):
    """Send media group."""
    media = [
        InputMediaPhoto("https://example.com/1.jpg", caption="Photo 1"),
        InputMediaPhoto("https://example.com/2.jpg"),
        InputMediaPhoto("https://example.com/3.jpg"),
    ]
    await update.message.reply_media_group(media)

async def send_document(update: Update, context):
    """Send a file."""
    with open("report.pdf", "rb") as f:
        await update.message.reply_document(
            document=f,
            filename="report.pdf",
            caption="Here is your report"
        )
```

### Quick Setup with `aiogram` (Async-first)

```bash
pip install aiogram python-dotenv
```

```python
# bot.py
import os
import asyncio
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

load_dotenv()

bot = Bot(token=os.getenv("BOT_TOKEN"))
dp = Dispatcher()

@dp.message(Command("start"))
async def start(message: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Click me", callback_data="clicked")]
    ])
    await message.answer("Welcome!", reply_markup=kb)

@dp.callback_query(F.data == "clicked")
async def on_click(callback: types.CallbackQuery):
    await callback.answer("Button clicked!")
    await callback.message.edit_text("You clicked the button!")

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Architecture Patterns

### Middleware / Plugin Pattern (Node.js)

```javascript
class BotMiddleware {
  constructor(bot) {
    this.bot = bot;
    this.middlewares = [];
  }

  use(fn) {
    this.middlewares.push(fn);
  }

  async process(msg) {
    let index = 0;
    const next = async () => {
      if (index < this.middlewares.length) {
        await this.middlewares[index++](msg, next);
      }
    };
    await next();
  }
}

// Usage
const mw = new BotMiddleware(bot);

// Logging middleware
mw.use(async (msg, next) => {
  console.log(`[${new Date().toISOString()}] ${msg.from.username}: ${msg.text}`);
  await next();
});

// Rate limiting middleware
const userRates = new Map();
mw.use(async (msg, next) => {
  const userId = msg.from.id;
  const now = Date.now();
  const lastMsg = userRates.get(userId) || 0;

  if (now - lastMsg < 1000) { // 1 message per second
    return; // Drop message
  }
  userRates.set(userId, now);
  await next();
});

// Auth middleware
const ADMIN_IDS = [123456789];
mw.use(async (msg, next) => {
  msg.isAdmin = ADMIN_IDS.includes(msg.from.id);
  await next();
});

bot.on('message', (msg) => mw.process(msg));
```

### Database Integration (SQLite)

```javascript
const Database = require('better-sqlite3');
const db = new Database('bot.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    settings JSON DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS messages_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    chat_id INTEGER,
    text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Prepared statements
const upsertUser = db.prepare(`
  INSERT INTO users (id, username, first_name)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    username = excluded.username,
    first_name = excluded.first_name
`);

const logMessage = db.prepare(`
  INSERT INTO messages_log (user_id, chat_id, text) VALUES (?, ?, ?)
`);

// Use in bot handlers
bot.on('message', (msg) => {
  upsertUser.run(msg.from.id, msg.from.username, msg.from.first_name);
  logMessage.run(msg.from.id, msg.chat.id, msg.text);
});
```

### Admin Panel Pattern

```javascript
const ADMIN_IDS = process.env.ADMIN_IDS?.split(',').map(Number) || [];

function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Access denied.');
  }

  bot.sendMessage(msg.chat.id, '🔧 Admin Panel:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Stats', callback_data: 'admin_stats' }],
        [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
        [{ text: '🚫 Ban User', callback_data: 'admin_ban' }],
        [{ text: '📋 User List', callback_data: 'admin_users' }]
      ]
    }
  });
});

// Broadcast to all users
bot.on('callback_query', async (query) => {
  if (!isAdmin(query.from.id)) return;

  if (query.data === 'admin_broadcast') {
    await bot.answerCallbackQuery(query.id);
    setState(query.message.chat.id, 'admin_broadcast');
    await bot.sendMessage(query.message.chat.id, 'Send the broadcast message:');
  }

  if (query.data === 'admin_stats') {
    await bot.answerCallbackQuery(query.id);
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const msgCount = db.prepare(
      "SELECT COUNT(*) as count FROM messages_log WHERE created_at > datetime('now', '-24 hours')"
    ).get();

    await bot.editMessageText(
      `📊 Bot Statistics:\n\n` +
      `👥 Total users: ${userCount.count}\n` +
      `💬 Messages (24h): ${msgCount.count}`,
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  }
});
```

### Multi-language Support

```javascript
const i18n = {
  en: {
    welcome: 'Welcome to the bot!',
    help: 'Here are the available commands:',
    settings: 'Settings',
    language: 'Language',
    choose_lang: 'Choose your language:'
  },
  es: {
    welcome: '!Bienvenido al bot!',
    help: 'Estos son los comandos disponibles:',
    settings: 'Configuracion',
    language: 'Idioma',
    choose_lang: 'Elige tu idioma:'
  },
  ru: {
    welcome: 'Добро пожаловать!',
    help: 'Доступные команды:',
    settings: 'Настройки',
    language: 'Язык',
    choose_lang: 'Выберите язык:'
  }
};

function t(userId, key) {
  const lang = userLanguages.get(userId) || 'en';
  return i18n[lang]?.[key] || i18n.en[key] || key;
}

const userLanguages = new Map();

bot.onText(/\/language/, (msg) => {
  bot.sendMessage(msg.chat.id, t(msg.from.id, 'choose_lang'), {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
        [{ text: '🇪🇸 Espanol', callback_data: 'lang_es' }],
        [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }]
      ]
    }
  });
});

bot.on('callback_query', async (query) => {
  if (query.data?.startsWith('lang_')) {
    const lang = query.data.replace('lang_', '');
    userLanguages.set(query.from.id, lang);
    await bot.answerCallbackQuery(query.id, { text: '✅' });
    await bot.editMessageText(t(query.from.id, 'welcome'), {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });
  }
});
```

---

## Deployment Patterns

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

# Non-root user
RUN addgroup -g 1001 -S botuser && \
    adduser -S botuser -u 1001
USER botuser

CMD ["node", "bot.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### Process Manager (PM2)

```bash
npm install -g pm2

# Start bot
pm2 start bot.js --name telegram-bot

# Auto-restart on crash
pm2 startup
pm2 save

# Monitor
pm2 monit
pm2 logs telegram-bot
```

### Serverless (Vercel / AWS Lambda)

```javascript
// api/webhook.js (Vercel Serverless)
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.BOT_TOKEN);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify secret
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const update = req.body;

    if (update.message?.text === '/start') {
      await bot.sendMessage(update.message.chat.id, 'Hello from serverless!');
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
```

---

## Telegram Payments (Stars)

```javascript
// Send invoice with Telegram Stars
bot.onText(/\/buy/, (msg) => {
  bot.sendInvoice(msg.chat.id, 'Premium Access', 'Get premium features for 30 days', 'premium_30d', '', 'XTR', [
    { label: 'Premium (30 days)', amount: 100 } // 100 Stars
  ]);
});

// Handle pre-checkout
bot.on('pre_checkout_query', async (query) => {
  // Validate the order
  await bot.answerPreCheckoutQuery(query.id, true);
});

// Handle successful payment
bot.on('message', async (msg) => {
  if (msg.successful_payment) {
    const payment = msg.successful_payment;
    await bot.sendMessage(msg.chat.id,
      `✅ Payment successful!\n` +
      `Amount: ${payment.total_amount} Stars\n` +
      `Your premium access is now active.`
    );
    // Activate premium for user
  }
});
```

---

## Inline Mode

```javascript
bot.on('inline_query', async (query) => {
  const searchTerm = query.query.toLowerCase();

  const results = [
    {
      type: 'article',
      id: '1',
      title: 'Hello World',
      description: 'Send a hello world message',
      input_message_content: { message_text: 'Hello, World! 👋' }
    },
    {
      type: 'article',
      id: '2',
      title: 'Current Time',
      description: 'Send the current time',
      input_message_content: {
        message_text: `🕐 Current time: ${new Date().toLocaleTimeString()}`,
        parse_mode: 'HTML'
      }
    }
  ].filter(r => r.title.toLowerCase().includes(searchTerm));

  await bot.answerInlineQuery(query.id, results, {
    cache_time: 10,
    is_personal: true
  });
});
```

---

## Security Best Practices

1. **Token security**: Store `BOT_TOKEN` in environment variables, never in code
2. **Webhook verification**: Always validate `X-Telegram-Bot-Api-Secret-Token` header
3. **Input validation**: Sanitize all user input before processing or storing
4. **Admin verification**: Check user IDs for admin-only commands
5. **Rate limiting**: Implement per-user rate limits to prevent abuse
6. **Error isolation**: Never expose internal errors to users
7. **HTTPS only**: Use HTTPS for all webhook endpoints
8. **Restrict updates**: Use `allowed_updates` to receive only needed update types
9. **File validation**: Check file sizes and types before processing uploads
10. **SQL injection**: Use parameterized queries for all database operations

---

## Common Gotchas

1. **Chat ID types**: Group/supergroup IDs are negative numbers
2. **Message editing**: Can only edit bot's own messages (or inline messages)
3. **Callback data limit**: Maximum 64 bytes per callback_data
4. **Markdown escaping**: MarkdownV2 requires escaping special characters
5. **File ID reuse**: `file_id` is specific to your bot; `file_unique_id` is universal
6. **Polling vs Webhook**: Cannot use both simultaneously
7. **Group privacy**: Bot only receives messages that mention it or are commands (unless privacy mode disabled)
8. **Rate limits**: ~30 messages/second to different chats, 20 messages/minute to same group
9. **Webhook response**: Must respond with 200 within reasonable time, or Telegram retries
10. **Migration**: Groups can migrate to supergroups, changing the chat_id

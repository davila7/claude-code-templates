# Telegram Bot API - Complete Methods Reference

> Based on Bot API 9.4 (February 2026). Base URL: `https://api.telegram.org/bot<token>/METHOD_NAME`

---

## Getting Updates

| Method | Description |
|---|---|
| `getUpdates` | Long polling. Returns array of `Update` objects. Use `offset` to confirm receipt, `timeout` for long polling, `allowed_updates` to filter. |
| `setWebhook` | Set HTTPS URL for incoming updates. Ports: 443, 80, 88, 8443. Supports `secret_token` header verification. `ip_address` for DNS workaround. `max_connections` (1-100, default 40). |
| `deleteWebhook` | Remove webhook integration. Optional `drop_pending_updates`. |
| `getWebhookInfo` | Get current webhook status: URL, pending count, last error, allowed updates. |

**Polling vs Webhook decision:**
- **Polling** (`getUpdates`): Simpler setup, good for development, no HTTPS needed. Set `timeout` to 30+ for long polling efficiency.
- **Webhook** (`setWebhook`): Better for production, lower latency, requires HTTPS. Use `secret_token` for verification.

---

## Bot Identity & Commands

| Method | Description |
|---|---|
| `getMe` | Returns basic bot info (id, name, username, can_join_groups, etc.) |
| `logOut` | Log out from cloud Bot API before switching to local server. |
| `close` | Close bot instance gracefully. |
| `setMyCommands` | Register bot commands visible in menu. Accepts `commands[]` and `scope` (default, private chats, groups, specific chat, etc.) and `language_code`. |
| `deleteMyCommands` | Remove commands for given scope/language. |
| `getMyCommands` | Get current command list for scope/language. |
| `setMyName` | Set bot display name (up to 64 chars) per language. |
| `getMyName` | Get bot display name. |
| `setMyDescription` | Bot description shown in empty chat (up to 512 chars). |
| `getMyDescription` | Get bot description. |
| `setMyShortDescription` | Brief description for sharing (up to 120 chars). |
| `getMyShortDescription` | Get short description. |
| `setMyDefaultAdministratorRights` | Set default admin rights when added to groups/channels. |
| `getMyDefaultAdministratorRights` | Get default admin rights. |
| `setMyProfilePhoto` | Update bot profile picture. |
| `removeMyProfilePhoto` | Delete bot profile image. |

---

## Sending Messages

### Text & Formatting

| Method | Description |
|---|---|
| `sendMessage` | Send text message. Supports `parse_mode` (HTML, Markdown, MarkdownV2), `entities`, `link_preview_options`, `reply_markup`, `reply_parameters`, `message_thread_id` for forum topics. |

**Parse modes:**
- **HTML**: `<b>bold</b>`, `<i>italic</i>`, `<u>underline</u>`, `<s>strike</s>`, `<code>code</code>`, `<pre>pre</pre>`, `<a href="url">link</a>`, `<tg-spoiler>spoiler</tg-spoiler>`, `<blockquote>quote</blockquote>`, `<tg-emoji emoji-id="ID">emoji</tg-emoji>`
- **MarkdownV2**: `*bold*`, `_italic_`, `__underline__`, `~strikethrough~`, `||spoiler||`, `` `code` ``, ` ```pre``` `, `[link](url)`, `>blockquote`, `![emoji](tg://emoji?id=ID)`. Escape: `_*[]()~>#+-=|{}.!`

### Media Messages

| Method | Description |
|---|---|
| `sendPhoto` | Send photo (file_id, URL, or upload). Max 10MB. Supports `caption`, `parse_mode`, `has_spoiler`, `show_caption_above_media`. |
| `sendVideo` | Send video. Max 50MB. Supports `duration`, `width`, `height`, `thumbnail`, `has_spoiler`, `supports_streaming`. |
| `sendAnimation` | Send GIF or H.264 video without sound. Max 50MB. |
| `sendAudio` | Send audio/music file. Max 50MB. Supports `title`, `performer`, `duration`. |
| `sendDocument` | Send general file. Max 50MB. `disable_content_type_detection` optional. |
| `sendVoice` | Send voice message (.ogg OPUS). Max 50MB. |
| `sendVideoNote` | Send round/circular video. Max 1 min, equal width/height. |
| `sendMediaGroup` | Send album of 2-10 photos/videos/documents/audios. Returns array of Messages. |
| `sendSticker` | Send .webp, .tgs (animated), or .webm (video) sticker. |
| `sendPaidMedia` | Send photo/video requiring Telegram Stars payment (up to 25000 Stars). |

### Interactive Content

| Method | Description |
|---|---|
| `sendLocation` | Send GPS point. Optional `live_period` (60-86400s) for live location, `heading`, `proximity_alert_radius`. |
| `sendVenue` | Send venue with name, address, and optional foursquare/google place IDs. |
| `sendContact` | Send phone contact (phone_number, first_name, optional last_name, vcard). |
| `sendPoll` | Create poll. `type`: "regular" or "quiz". Supports `is_anonymous`, `allows_multiple_answers`, `correct_option_id` (quiz), `explanation`, `open_period` or `close_date`. |
| `sendDice` | Send animated emoji with random value. Emoji: dice, darts, basketball, football, bowling, slot machine. |
| `sendInvoice` | Send payment invoice. Requires `title`, `description`, `payload`, `currency`, `prices[]`. Supports `provider_token`, `need_shipping_address`, `is_flexible`, Telegram Stars (`currency: "XTR"`). |
| `sendGame` | Send game. Requires `game_short_name` registered with @BotFather. |

### Message Draft (Streaming)

| Method | Description |
|---|---|
| `sendMessageDraft` | Stream partial messages during generation. Useful for AI-powered bots showing typing progress. |

---

## Message Operations

| Method | Description |
|---|---|
| `forwardMessage` | Forward message preserving original sender. |
| `forwardMessages` | Forward multiple messages (up to 100) as album. |
| `copyMessage` | Copy message content without forward header. Returns `MessageId`. |
| `copyMessages` | Copy multiple messages. Returns array of `MessageId`. |
| `editMessageText` | Edit text of sent message (bot's own or inline). |
| `editMessageCaption` | Edit media caption. |
| `editMessageMedia` | Replace media content entirely. |
| `editMessageReplyMarkup` | Update inline keyboard. |
| `editMessageLiveLocation` | Update live location message. |
| `stopMessageLiveLocation` | Stop live location updates. |
| `deleteMessage` | Delete message (bot's own: no time limit; others: within 48h in groups). |
| `deleteMessages` | Delete multiple messages (up to 100) at once. |
| `setMessageReaction` | Add/remove emoji or custom emoji reaction. |

---

## Chat Management

### Chat Information

| Method | Description |
|---|---|
| `getChat` | Get `ChatFullInfo`: photo, bio, permissions, linked chat, pinned message, sticker set, invite link, slow mode, etc. |
| `getChatAdministrators` | List all administrators with their rights. |
| `getChatMemberCount` | Get total member count. |
| `getChatMember` | Get info about specific member (status, rights, restrictions). |
| `leaveChat` | Bot leaves the group/supergroup/channel. |

### Chat Modification

| Method | Description |
|---|---|
| `setChatTitle` | Change chat title (1-128 chars). |
| `setChatDescription` | Change chat description (0-255 chars). |
| `setChatPhoto` | Set chat profile photo. |
| `deleteChatPhoto` | Remove chat photo. |
| `setChatPermissions` | Set default member permissions. `use_independent_chat_permissions` for granular control. |
| `setChatStickerSet` | Set supergroup sticker set. |
| `deleteChatStickerSet` | Remove supergroup sticker set. |
| `setChatBackground` | Set chat background (fill, wallpaper, pattern, theme). |
| `deleteChatBackground` | Reset chat background. |
| `pinChatMessage` | Pin message. `business_connection_id` supported. |
| `unpinChatMessage` | Unpin specific message. |
| `unpinAllChatMessages` | Unpin all messages. |

### Member Management

| Method | Description |
|---|---|
| `banChatMember` | Ban user (and optionally `revoke_messages`). `until_date` for temporary ban. |
| `unbanChatMember` | Unban user. `only_if_banned` to avoid adding removed users back. |
| `restrictChatMember` | Apply specific `ChatPermissions` to user. `until_date` for temporary. |
| `promoteChatMember` | Grant/revoke admin rights: `can_manage_chat`, `can_delete_messages`, `can_manage_video_chats`, `can_restrict_members`, `can_promote_members`, `can_change_info`, `can_invite_users`, `can_post_stories`, `can_edit_stories`, `can_delete_stories`, `can_pin_messages`, `can_manage_topics`, `can_manage_direct_messages`. |
| `setChatAdministratorCustomTitle` | Set custom title for admin (up to 16 chars). |
| `acceptChatJoinRequest` | Approve join request. |
| `declineChatJoinRequest` | Reject join request. |

### Invite Links

| Method | Description |
|---|---|
| `exportChatInviteLink` | Generate new primary invite link. |
| `createChatInviteLink` | Create additional invite link with optional `name`, `expire_date`, `member_limit`, `creates_join_request`. |
| `editChatInviteLink` | Edit non-primary invite link. |
| `revokeChatInviteLink` | Revoke invite link. |
| `approveChatJoinRequest` | Approve user who requested to join. |
| `declineChatJoinRequest` | Decline join request. |

---

## Forum Topics

| Method | Description |
|---|---|
| `createForumTopic` | Create topic in forum supergroup or private chat. Params: `name`, `icon_color`, `icon_custom_emoji_id`. |
| `editForumTopic` | Edit topic name and icon. |
| `closeForumTopic` | Close/archive topic. |
| `reopenForumTopic` | Reopen closed topic. |
| `deleteForumTopic` | Delete topic with all messages. |
| `unpinAllForumTopicMessages` | Unpin all messages in topic. |
| `editGeneralForumTopic` | Rename general topic. |
| `closeGeneralForumTopic` | Close general topic. |
| `reopenGeneralForumTopic` | Reopen general topic. |
| `hideGeneralForumTopic` | Hide general topic. |
| `unhideGeneralForumTopic` | Unhide general topic. |
| `getForumTopicIconStickers` | Get custom emoji stickers for topic icons. |

---

## Inline Mode

| Method | Description |
|---|---|
| `answerInlineQuery` | Respond to inline query with up to 50 results. Supports `cache_time`, `is_personal`, `next_offset` for pagination, `button` for switching to PM. |

**Result types:** `InlineQueryResultArticle`, `InlineQueryResultPhoto`, `InlineQueryResultGif`, `InlineQueryResultMpeg4Gif`, `InlineQueryResultVideo`, `InlineQueryResultAudio`, `InlineQueryResultVoice`, `InlineQueryResultDocument`, `InlineQueryResultLocation`, `InlineQueryResultVenue`, `InlineQueryResultContact`, `InlineQueryResultGame`, `InlineQueryResultCachedPhoto`, `InlineQueryResultCachedGif`, `InlineQueryResultCachedMpeg4Gif`, `InlineQueryResultCachedSticker`, `InlineQueryResultCachedDocument`, `InlineQueryResultCachedVideo`, `InlineQueryResultCachedVoice`, `InlineQueryResultCachedAudio`

---

## Callback Queries & Web Apps

| Method | Description |
|---|---|
| `answerCallbackQuery` | Respond to callback button press. Optional `text` (notification), `show_alert` (modal), `url` (open URL/game), `cache_time`. |
| `answerWebAppQuery` | Set result of Web App interaction. Returns `SentWebAppMessage`. |

---

## Payments

| Method | Description |
|---|---|
| `sendInvoice` | Send payment invoice with product info, prices, and optional shipping. |
| `createInvoiceLink` | Create invoice link for any chat. Returns URL string. |
| `answerShippingQuery` | Respond to shipping query with available options or error. |
| `answerPreCheckoutQuery` | Final confirmation before charging. Must respond within 10 seconds. |
| `refundStarPayment` | Refund Telegram Stars payment. Requires `user_id` and `telegram_payment_charge_id`. |
| `getStarTransactions` | Get bot's Star transaction history. |

**Telegram Stars:** Use `currency: "XTR"`, no `provider_token` needed. One price item only. Supports refunds via `refundStarPayment`.

---

## Stickers

| Method | Description |
|---|---|
| `sendSticker` | Send sticker by file_id, URL, or upload. |
| `getStickerSet` | Get sticker set by name. |
| `getCustomEmojiStickers` | Get custom emoji stickers by IDs (up to 200). |
| `uploadStickerFile` | Upload sticker file for later use in set. |
| `createNewStickerSet` | Create sticker set owned by user. Supports static, animated, video, mask, custom_emoji types. |
| `addStickerToSet` | Add sticker to existing set (up to 120 for static, 50 for animated/video). |
| `setStickerPositionInSet` | Move sticker within set. |
| `deleteStickerFromSet` | Remove sticker from set. |
| `replaceStickerInSet` | Replace existing sticker in set. |
| `setStickerEmojiList` | Set emoji list for sticker. |
| `setStickerKeywordList` | Set search keywords for sticker. |
| `setStickerMaskPosition` | Set mask position for mask sticker. |
| `setStickerSetTitle` | Rename sticker set. |
| `setStickerSetThumbnail` | Set sticker set thumbnail. |
| `setCustomEmojiStickerSetThumbnail` | Set custom emoji set thumbnail. |
| `deleteStickerSet` | Delete sticker set created by bot. |

---

## Games

| Method | Description |
|---|---|
| `sendGame` | Send game (registered via @BotFather). |
| `setGameScore` | Update game score. `force` to overwrite lower. `disable_edit_message` to not update message. |
| `getGameHighScores` | Get high score table around target user. |

---

## Gifts & Boosts

| Method | Description |
|---|---|
| `getAvailableGifts` | List available gifts for sending. |
| `sendGift` | Send gift to user or channel. |
| `getUserGifts` | Get gifts received by user. |
| `getChatGifts` | Get gifts for chat/user. |
| `getBusinessAccountGifts` | Get gifts for business account. |
| `getUserChatBoosts` | Get user's boosts for specific chat. |

---

## Suggested Posts (Channel Direct Messages)

| Method | Description |
|---|---|
| `approveSuggestedPost` | Approve incoming suggested post. |
| `declineSuggestedPost` | Reject incoming suggested post. |

---

## Checklists

| Method | Description |
|---|---|
| `addTaskToChecklist` | Append task to message checklist. |
| `editChecklistTask` | Modify task text or completion status. |
| `deleteChecklistTask` | Remove task from checklist. |

---

## Stories

| Method | Description |
|---|---|
| `repostStory` | Cross-post story across managed business accounts. |

---

## Giveaways

| Method | Description |
|---|---|
| `sendGiveaway` | Create scheduled giveaway. |
| `getGiveawayWinners` | List giveaway winners. |

---

## Passport

| Method | Description |
|---|---|
| `setPassportDataErrors` | Notify user of issues with their Telegram Passport documents. Accepts array of `PassportElementError` types. |

**Error types:** `PassportElementErrorDataField`, `PassportElementErrorFrontSide`, `PassportElementErrorReverseSide`, `PassportElementErrorSelfie`, `PassportElementErrorFile`, `PassportElementErrorFiles`, `PassportElementErrorTranslationFile`, `PassportElementErrorTranslationFiles`, `PassportElementErrorUnspecified`

---

## File Handling

| Method | Description |
|---|---|
| `getFile` | Get file download path. Returns `File` with `file_path`. Download: `https://api.telegram.org/file/bot<token>/<file_path>`. Max 20MB via Bot API. |

**File limits (standard Bot API):**
- Download: 20 MB max
- Upload: 50 MB max
- Photo upload: 10 MB max

**Local Bot API Server:**
- Download/Upload: up to 2000 MB
- Supports `file://` URIs
- HTTP webhooks allowed (no HTTPS required)

**Sending files three ways:**
1. **file_id**: Reuse previously uploaded file (most efficient)
2. **URL**: Telegram downloads from URL (max 5MB for photos, 20MB for others)
3. **Upload**: multipart/form-data upload

---

## Profile Audio

| Method | Description |
|---|---|
| `getUserProfileAudios` | Fetch user's profile audio list. |
| `getUserProfilePhotos` | Get user profile photos. `offset` and `limit` for pagination. |

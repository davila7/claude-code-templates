# Telegram Bot API - Complete Types Reference

> Based on Bot API 9.4 (February 2026). All types are JSON-serialized objects.

---

## Core Types

### Update

The root object for incoming updates. Contains `update_id` and exactly ONE of:

| Field | Type | Description |
|---|---|---|
| `update_id` | Integer | Unique update identifier |
| `message` | Message | New incoming message |
| `edited_message` | Message | Edited message |
| `channel_post` | Message | New channel post |
| `edited_channel_post` | Message | Edited channel post |
| `business_connection` | BusinessConnection | Bot connected/disconnected from business account |
| `business_message` | Message | New business account message |
| `edited_business_message` | Message | Edited business message |
| `deleted_business_messages` | BusinessMessagesDeleted | Deleted business messages |
| `message_reaction` | MessageReactionUpdated | Reaction changed on message |
| `message_reaction_count` | MessageReactionCountUpdated | Anonymous reaction count changed |
| `inline_query` | InlineQuery | Incoming inline query |
| `chosen_inline_result` | ChosenInlineResult | Result of inline query chosen |
| `callback_query` | CallbackQuery | Callback button pressed |
| `shipping_query` | ShippingQuery | Shipping address provided |
| `pre_checkout_query` | PreCheckoutQuery | Pre-checkout confirmation needed |
| `purchased_paid_media` | PaidMediaPurchased | User purchased paid media |
| `poll` | Poll | Poll state changed |
| `poll_answer` | PollAnswer | User changed vote |
| `my_chat_member` | ChatMemberUpdated | Bot's chat member status changed |
| `chat_member` | ChatMemberUpdated | Chat member status changed |
| `chat_join_request` | ChatJoinRequest | User requested to join chat |
| `chat_boost` | ChatBoostUpdated | Chat boost added |
| `removed_chat_boost` | ChatBoostRemoved | Chat boost removed |

### User

| Field | Type | Description |
|---|---|---|
| `id` | Integer | Unique identifier |
| `is_bot` | Boolean | True if user is a bot |
| `first_name` | String | First name |
| `last_name` | String | Optional. Last name |
| `username` | String | Optional. Username |
| `language_code` | String | Optional. IETF language tag |
| `is_premium` | Boolean | Optional. True if Telegram Premium |
| `added_to_attachment_menu` | Boolean | Optional. True if added to attachment menu |
| `can_join_groups` | Boolean | Optional. Bots only. Can be invited to groups |
| `can_read_all_group_messages` | Boolean | Optional. Bots only. Privacy mode disabled |
| `supports_inline_queries` | Boolean | Optional. Bots only. Supports inline queries |
| `can_connect_to_business` | Boolean | Optional. Bots only. Can connect to business accounts |
| `has_main_web_app` | Boolean | Optional. Bots only. Has main Web App |

### Chat

| Field | Type | Description |
|---|---|---|
| `id` | Integer | Unique identifier (can be negative for groups) |
| `type` | String | "private", "group", "supergroup", or "channel" |
| `title` | String | Optional. Title (groups/supergroups/channels) |
| `username` | String | Optional. Username |
| `first_name` | String | Optional. First name (private chats) |
| `last_name` | String | Optional. Last name (private chats) |
| `is_forum` | Boolean | Optional. True if supergroup is a forum |

### ChatFullInfo

Extended chat information returned by `getChat`. Includes all Chat fields plus:

| Field | Type | Description |
|---|---|---|
| `photo` | ChatPhoto | Optional. Chat photo |
| `active_usernames` | String[] | Optional. Active usernames |
| `emoji_status_custom_emoji_id` | String | Optional. Custom emoji status |
| `bio` | String | Optional. Bio (private chats) |
| `description` | String | Optional. Description |
| `invite_link` | String | Optional. Primary invite link |
| `pinned_message` | Message | Optional. Pinned message |
| `permissions` | ChatPermissions | Optional. Default permissions |
| `accent_color_id` | Integer | Optional. Accent color for name |
| `background_custom_emoji_id` | String | Optional. Background emoji |
| `slow_mode_delay` | Integer | Optional. Slow mode seconds |
| `linked_chat_id` | Integer | Optional. Linked channel/discussion group |
| `location` | ChatLocation | Optional. Location (location-based groups) |
| `available_reactions` | ReactionType[] | Optional. Allowed reactions |
| `max_reaction_count` | Integer | Optional. Max reactions per message |

---

## Message Type

The central type. Key fields:

### Identification & Metadata

| Field | Type | Description |
|---|---|---|
| `message_id` | Integer | Unique message ID within chat |
| `message_thread_id` | Integer | Optional. Forum topic thread ID |
| `from` | User | Optional. Sender |
| `sender_chat` | Chat | Optional. Sender chat (channels, anonymous admins) |
| `sender_boost_count` | Integer | Optional. Sender's boost count |
| `date` | Integer | Unix timestamp |
| `chat` | Chat | Chat the message belongs to |
| `is_topic_message` | Boolean | Optional. Sent in forum topic |
| `is_automatic_forward` | Boolean | Optional. Auto-forwarded to linked group |

### Content Fields

| Field | Type | Description |
|---|---|---|
| `text` | String | Text content (0-4096 chars) |
| `entities` | MessageEntity[] | Special entities in text |
| `caption` | String | Media caption (0-1024 chars) |
| `caption_entities` | MessageEntity[] | Special entities in caption |

### Reply & Forward

| Field | Type | Description |
|---|---|---|
| `reply_to_message` | Message | Optional. Original message being replied to |
| `external_reply` | ExternalReplyInfo | Optional. Reply to message in different chat |
| `quote` | TextQuote | Optional. Quoted part of reply |
| `forward_origin` | MessageOrigin | Optional. Info about original message for forwarded messages |
| `link_preview_options` | LinkPreviewOptions | Optional. Link preview settings |

### Media Fields

| Field | Type | Description |
|---|---|---|
| `photo` | PhotoSize[] | Optional. Available photo sizes |
| `video` | Video | Optional. Video content |
| `animation` | Animation | Optional. Animation/GIF |
| `audio` | Audio | Optional. Audio file |
| `document` | Document | Optional. General file |
| `voice` | Voice | Optional. Voice message |
| `video_note` | VideoNote | Optional. Video note |
| `sticker` | Sticker | Optional. Sticker |
| `contact` | Contact | Optional. Shared contact |
| `location` | Location | Optional. Shared location |
| `venue` | Venue | Optional. Venue info |
| `poll` | Poll | Optional. Native poll |
| `dice` | Dice | Optional. Dice animation |
| `game` | Game | Optional. Game |
| `invoice` | Invoice | Optional. Payment invoice |
| `successful_payment` | SuccessfulPayment | Optional. Successful payment |
| `paid_media` | PaidMediaInfo | Optional. Paid media content |
| `story` | Story | Optional. Forwarded story |
| `checklist` | Checklist | Optional. Checklist |

### Keyboard/Reply Markup

| Field | Type | Description |
|---|---|---|
| `reply_markup` | InlineKeyboardMarkup | Optional. Inline keyboard attached to message |

---

## MessageEntity

Special entities in message text or caption:

| Type Value | Description | Extra Fields |
|---|---|---|
| `mention` | @username mention | |
| `hashtag` | #hashtag | |
| `cashtag` | $USD cashtag | |
| `bot_command` | /command | |
| `url` | URL | |
| `email` | Email address | |
| `phone_number` | Phone number | |
| `bold` | **bold** text | |
| `italic` | *italic* text | |
| `underline` | underlined text | |
| `strikethrough` | ~~strikethrough~~ | |
| `spoiler` | spoiler text | |
| `blockquote` | block quote | |
| `expandable_blockquote` | Collapsible block quote | |
| `code` | inline `code` | |
| `pre` | code block | `language` (optional) |
| `text_link` | clickable text URL | `url` |
| `text_mention` | mention without username | `user` |
| `custom_emoji` | custom emoji | `custom_emoji_id` |

Fields: `offset` (Integer), `length` (Integer), `type` (String)

---

## Keyboard & Reply Markup Types

### InlineKeyboardMarkup

Grid of buttons shown inline with message.

```json
{
  "inline_keyboard": [
    [{"text": "Button 1", "callback_data": "btn1"}, {"text": "Button 2", "url": "https://example.com"}],
    [{"text": "Full width", "callback_data": "btn3"}]
  ]
}
```

### InlineKeyboardButton

| Field | Type | Description |
|---|---|---|
| `text` | String | Button label |
| `url` | String | Optional. HTTP/HTTPS/tg:// URL |
| `callback_data` | String | Optional. Data sent to bot (1-64 bytes) |
| `web_app` | WebAppInfo | Optional. Web App URL |
| `login_url` | LoginUrl | Optional. HTTPS URL for seamless login |
| `switch_inline_query` | String | Optional. Switch to inline mode in any chat |
| `switch_inline_query_current_chat` | String | Optional. Switch to inline in current chat |
| `switch_inline_query_chosen_chat` | SwitchInlineQueryChosenChat | Optional. Switch inline with chat filter |
| `callback_game` | CallbackGame | Optional. Launch game |
| `pay` | Boolean | Optional. Pay button (must be first) |
| `icon_custom_emoji_id` | String | Optional. Custom emoji icon (Bot API 9.4) |
| `style` | String | Optional. Button style/color (Bot API 9.4) |

### ReplyKeyboardMarkup

Custom keyboard below input field.

| Field | Type | Description |
|---|---|---|
| `keyboard` | KeyboardButton[][] | Button rows |
| `is_persistent` | Boolean | Optional. Always shown |
| `resize_keyboard` | Boolean | Optional. Fit to button count |
| `one_time_keyboard` | Boolean | Optional. Hide after use |
| `input_field_placeholder` | String | Optional. Placeholder text (1-64 chars) |
| `selective` | Boolean | Optional. Show only to specific users |

### KeyboardButton

| Field | Type | Description |
|---|---|---|
| `text` | String | Button text (sent as message if no special field) |
| `request_users` | KeyboardButtonRequestUsers | Optional. Request user selection |
| `request_chat` | KeyboardButtonRequestChat | Optional. Request chat selection |
| `request_contact` | Boolean | Optional. Send user's phone |
| `request_location` | Boolean | Optional. Send user's location |
| `request_poll` | KeyboardButtonPollType | Optional. Create poll |
| `web_app` | WebAppInfo | Optional. Open Web App |
| `icon_custom_emoji_id` | String | Optional. Custom emoji icon (Bot API 9.4) |
| `style` | String | Optional. Button style (Bot API 9.4) |

### ReplyKeyboardRemove

Remove custom keyboard: `{"remove_keyboard": true, "selective": false}`

### ForceReply

Force reply to bot's message: `{"force_reply": true, "input_field_placeholder": "Type here...", "selective": false}`

---

## Media Types

### PhotoSize

| Field | Type | Description |
|---|---|---|
| `file_id` | String | Identifier for downloading/reusing |
| `file_unique_id` | String | Unique identifier (no reuse) |
| `width` | Integer | Photo width |
| `height` | Integer | Photo height |
| `file_size` | Integer | Optional. File size in bytes |

### Video

All PhotoSize fields plus: `duration`, `thumbnail`, `file_name`, `mime_type`, `qualities` (VideoQuality[])

### VideoQuality (Bot API 9.4)

| Field | Type | Description |
|---|---|---|
| `file_id` | String | File identifier |
| `file_unique_id` | String | Unique file identifier |
| `width` | Integer | Video width |
| `height` | Integer | Video height |
| `codec` | String | Video codec |
| `file_size` | Integer | Optional. File size |

### Audio

Fields: `file_id`, `file_unique_id`, `duration`, `performer`, `title`, `file_name`, `mime_type`, `file_size`, `thumbnail`

### Document

Fields: `file_id`, `file_unique_id`, `thumbnail`, `file_name`, `mime_type`, `file_size`

### Voice

Fields: `file_id`, `file_unique_id`, `duration`, `mime_type`, `file_size`

### VideoNote

Fields: `file_id`, `file_unique_id`, `length` (diameter), `duration`, `thumbnail`, `file_size`

### Animation

Fields: `file_id`, `file_unique_id`, `width`, `height`, `duration`, `thumbnail`, `file_name`, `mime_type`, `file_size`

### Sticker

| Field | Type | Description |
|---|---|---|
| `file_id` | String | File identifier |
| `file_unique_id` | String | Unique identifier |
| `type` | String | "regular", "mask", or "custom_emoji" |
| `width` | Integer | Sticker width |
| `height` | Integer | Sticker height |
| `is_animated` | Boolean | True for .tgs stickers |
| `is_video` | Boolean | True for .webm stickers |
| `thumbnail` | PhotoSize | Optional. Thumbnail |
| `emoji` | String | Optional. Associated emoji |
| `set_name` | String | Optional. Sticker set name |
| `premium_animation` | File | Optional. Premium animation |
| `mask_position` | MaskPosition | Optional. Mask position |
| `custom_emoji_id` | String | Optional. Custom emoji ID |
| `needs_repainting` | Boolean | Optional. Needs repainting |

---

## Chat Member Types

### ChatMember Variants

| Type | Status | Description |
|---|---|---|
| `ChatMemberOwner` | "creator" | Chat creator. Fields: `is_anonymous`, `custom_title` |
| `ChatMemberAdministrator` | "administrator" | Admin with specific rights: `can_be_edited`, `can_manage_chat`, `can_delete_messages`, `can_manage_video_chats`, `can_restrict_members`, `can_promote_members`, `can_change_info`, `can_invite_users`, `can_post_stories`, `can_edit_stories`, `can_delete_stories`, `can_post_messages` (channels), `can_edit_messages` (channels), `can_pin_messages`, `can_manage_topics`, `can_manage_direct_messages` |
| `ChatMemberMember` | "member" | Regular member. Optional `until_date` for temporary membership |
| `ChatMemberRestricted` | "restricted" | Restricted member with specific permissions + `until_date` |
| `ChatMemberLeft` | "left" | User not in chat |
| `ChatMemberBanned` | "kicked" | Banned user. `until_date` for temporary ban |

### ChatPermissions

Default permissions for group members:

| Field | Type |
|---|---|
| `can_send_messages` | Boolean |
| `can_send_audios` | Boolean |
| `can_send_documents` | Boolean |
| `can_send_photos` | Boolean |
| `can_send_videos` | Boolean |
| `can_send_video_notes` | Boolean |
| `can_send_voice_notes` | Boolean |
| `can_send_polls` | Boolean |
| `can_send_other_messages` | Boolean |
| `can_add_web_page_previews` | Boolean |
| `can_change_info` | Boolean |
| `can_invite_users` | Boolean |
| `can_pin_messages` | Boolean |
| `can_manage_topics` | Boolean |

---

## Callback & Inline Query Types

### CallbackQuery

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique query identifier |
| `from` | User | Sender |
| `message` | MaybeInaccessibleMessage | Optional. Message with callback button |
| `inline_message_id` | String | Optional. ID of inline message |
| `chat_instance` | String | Global chat identifier |
| `data` | String | Optional. Data from callback button (up to 64 bytes) |
| `game_short_name` | String | Optional. Game short name |

### InlineQuery

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique query identifier |
| `from` | User | Sender |
| `query` | String | Query text (up to 256 chars) |
| `offset` | String | Offset for pagination |
| `chat_type` | String | Optional. "sender", "private", "group", "supergroup", "channel" |
| `location` | Location | Optional. User location (if requested) |

---

## Payment Types

### Invoice

Fields: `title`, `description`, `start_parameter`, `currency`, `total_amount`

### SuccessfulPayment

Fields: `currency`, `total_amount`, `invoice_payload`, `shipping_option_id`, `order_info`, `telegram_payment_charge_id`, `provider_payment_charge_id`

### ShippingQuery

Fields: `id`, `from`, `invoice_payload`, `shipping_address`

### PreCheckoutQuery

Fields: `id`, `from`, `currency`, `total_amount`, `invoice_payload`, `shipping_option_id`, `order_info`

### ShippingAddress

Fields: `country_code`, `state`, `city`, `street_line1`, `street_line2`, `post_code`

### LabeledPrice

Fields: `label` (String), `amount` (Integer - price in smallest currency unit, e.g., cents)

---

## Reaction Types

### ReactionTypeEmoji

Standard emoji reaction: `{"type": "emoji", "emoji": "👍"}`

### ReactionTypeCustomEmoji

Custom emoji reaction: `{"type": "custom_emoji", "custom_emoji_id": "emoji_id"}`

### ReactionTypePaid

Paid reaction: `{"type": "paid"}`

---

## Forum Topic Types

| Type | Description |
|---|---|
| `ForumTopic` | Topic info: `message_thread_id`, `name`, `icon_color`, `icon_custom_emoji_id` |
| `ForumTopicCreated` | Service message: topic created |
| `ForumTopicEdited` | Service message: topic edited |
| `ForumTopicClosed` | Service message: topic closed |
| `ForumTopicReopened` | Service message: topic reopened |
| `GeneralForumTopicHidden` | General topic hidden |
| `GeneralForumTopicUnhidden` | General topic unhidden |

---

## Business Types

| Type | Description |
|---|---|
| `BusinessConnection` | Bot connected/disconnected from business. Fields: `id`, `user`, `user_chat_id`, `date`, `can_reply`, `is_enabled` |
| `BusinessMessagesDeleted` | Messages deleted in business. Fields: `business_connection_id`, `chat`, `message_ids` |
| `BusinessIntro` | Business intro: `title`, `message`, `sticker` |
| `BusinessLocation` | Business location: `address`, `location` |
| `BusinessOpeningHours` | Business hours: `time_zone_name`, `opening_hours[]` |

---

## Gift Types (Bot API 9.3-9.4)

| Type | Description |
|---|---|
| `Gift` | Regular gift: `id`, `sticker`, `star_count`, `total_count`, `remaining_count` |
| `GiftInfo` | Gift metadata |
| `UniqueGift` | Unique/limited gift with rarity |
| `UniqueGiftInfo` | Unique gift metadata |
| `UniqueGiftColors` | Color scheme for unique gift |
| `GiftBackground` | Gift background style |
| `OwnedGiftRegular` | Owned regular gift |
| `UserRating` | User rating information |

---

## Paid Media Types

| Type | Description |
|---|---|
| `PaidMediaInfo` | Paid media info: `star_count`, `paid_media[]` |
| `PaidMediaPreview` | Preview before purchase: `type`, `width`, `height`, `duration` |
| `PaidMediaPhoto` | Purchased photo: `type`, `photo[]` |
| `PaidMediaVideo` | Purchased video: `type`, `video` |
| `PaidMediaPurchased` | Purchase event: `from`, `paid_media_payload` |

---

## Checklist Types (Bot API 9.2)

| Type | Description |
|---|---|
| `Checklist` | Checklist with tasks: `tasks[]` |
| `ChecklistTask` | Individual task: `id`, `text`, `is_completed` |
| `InputChecklist` | Input for creating checklist |
| `InputChecklistTask` | Input for creating task |
| `ChecklistTasksDone` | Service message: tasks completed |
| `ChecklistTasksAdded` | Service message: tasks added |

---

## Giveaway Types

| Type | Description |
|---|---|
| `Giveaway` | Active giveaway: `chats`, `winners_selection_date`, `winner_count`, `prize_description`, `premium_subscription_month_count` |
| `GiveawayCreated` | Service message: giveaway created |
| `GiveawayWinners` | Results: `chats`, `winners_selection_date`, `winner_count`, `winners[]` |
| `GiveawayCompleted` | Service message: giveaway completed |

---

## Background Types

| Type | Description |
|---|---|
| `ChatBackground` | Chat background: `type` |
| `BackgroundTypeFill` | Solid/gradient fill |
| `BackgroundTypeWallpaper` | Wallpaper image |
| `BackgroundTypePattern` | Pattern overlay |
| `BackgroundTypeChatTheme` | Chat theme |
| `BackgroundFillSolid` | Single color |
| `BackgroundFillGradient` | Two-color gradient |
| `BackgroundFillFreeformGradient` | Multi-color gradient |

---

## Passport Types

| Type | Description |
|---|---|
| `PassportData` | Passport data shared: `data[]`, `credentials` |
| `EncryptedPassportElement` | Encrypted element: `type`, `data`, `phone_number`, `email`, `files`, `front_side`, `reverse_side`, `selfie`, `translation` |
| `EncryptedCredentials` | Encrypted credentials: `data`, `hash`, `secret` |
| `PassportFile` | Uploaded passport file: `file_id`, `file_unique_id`, `file_size`, `file_date` |

**Element types:** `personal_details`, `passport`, `driver_license`, `identity_card`, `internal_passport`, `address`, `utility_bill`, `bank_statement`, `rental_agreement`, `passport_registration`, `temporary_registration`, `phone_number`, `email`

---

## Web App Types

| Type | Description |
|---|---|
| `WebAppInfo` | Web App URL: `url` |
| `WebAppData` | Data from Web App: `data`, `button_text` |
| `SentWebAppMessage` | Result of answerWebAppQuery: `inline_message_id` |

---

## Service Message Types

These appear as fields in Message for system events:

| Field | Type | Description |
|---|---|---|
| `new_chat_members` | User[] | New members added |
| `left_chat_member` | User | Member removed |
| `new_chat_title` | String | New chat title |
| `new_chat_photo` | PhotoSize[] | New chat photo |
| `delete_chat_photo` | Boolean | Chat photo deleted |
| `group_chat_created` | Boolean | Group created |
| `supergroup_chat_created` | Boolean | Supergroup created |
| `channel_chat_created` | Boolean | Channel created |
| `migrate_to_chat_id` | Integer | Group migrated to supergroup |
| `migrate_from_chat_id` | Integer | Supergroup migrated from group |
| `pinned_message` | MaybeInaccessibleMessage | Pinned message |
| `message_auto_delete_timer_changed` | MessageAutoDeleteTimerChanged | Auto-delete timer changed |
| `chat_owner_left` | ChatOwnerLeft | Owner left (Bot API 9.4) |
| `chat_owner_changed` | ChatOwnerChanged | Owner changed (Bot API 9.4) |
| `forum_topic_created` | ForumTopicCreated | Topic created |
| `forum_topic_edited` | ForumTopicEdited | Topic edited |
| `forum_topic_closed` | ForumTopicClosed | Topic closed |
| `forum_topic_reopened` | ForumTopicReopened | Topic reopened |
| `video_chat_scheduled` | VideoChatScheduled | Video chat scheduled |
| `video_chat_started` | VideoChatStarted | Video chat started |
| `video_chat_ended` | VideoChatEnded | Video chat ended |
| `video_chat_participants_invited` | VideoChatParticipantsInvited | Participants invited |
| `write_access_allowed` | WriteAccessAllowed | User allowed bot to write |
| `proximity_alert_triggered` | ProximityAlertTriggered | Live location proximity alert |
| `boost_added` | ChatBoostAdded | Boost added |
| `giveaway_created` | GiveawayCreated | Giveaway created |
| `giveaway_winners` | GiveawayWinners | Giveaway winners |
| `giveaway_completed` | GiveawayCompleted | Giveaway completed |
| `users_shared` | UsersShared | Users shared via keyboard button |
| `chat_shared` | ChatShared | Chat shared via keyboard button |

---

## Response Format

All API responses follow this structure:

```json
{
  "ok": true,
  "result": { ... }
}
```

Error response:

```json
{
  "ok": false,
  "error_code": 400,
  "description": "Bad Request: message text is empty"
}
```

### ResponseParameters

Returned in error responses when special action needed:

| Field | Type | Description |
|---|---|---|
| `migrate_to_chat_id` | Integer | Group migrated; use new chat ID |
| `retry_after` | Integer | Retry after N seconds (rate limited) |

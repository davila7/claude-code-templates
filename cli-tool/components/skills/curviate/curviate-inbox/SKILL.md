---
name: curviate-inbox
description: "Read and send LinkedIn messages with the Curviate CLI. Covers `inbox` (list, get, messages, search, mark-read), `inboxes` (personal and company-page discovery), `message` (new, send, get, edit, delete, react, attachment, InMail), replying as a company page, retrieval mode (`--mode`/`--max-age`) on the two inbox reads, and `webhook` for delivery of message events. Use when triaging conversations, reading a thread, sending or replying to a DM or InMail, or wiring event delivery."
version: 0.1.0
author: Curviate
license: MIT
tags: [LinkedIn, CLI, Agents, Sales, Recruiting, Outreach]
repository: https://github.com/Curviate/curviate-plugin
---

# Curviate: inbox and messaging

Messaging is the highest-consequence surface here: every send lands in a real person's inbox and
cannot be unsent. Preview first, always.

Command surface established against CLI `0.33.0`.

## Before any command

```bash
npm install -g @curviate/cli && curviate --version    # needs Node 18 or newer
curviate login --api-key <key>                        # or export CURVIATE_API_KEY
curviate account list --json                          # the acc_id for --account
```

- **Credentials resolve flag > environment > stored profile** (`CURVIATE_API_KEY`,
  `CURVIATE_BASE_URL`, `CURVIATE_ACCOUNT`).
- **`--profile <name>` picks the stored credential set; `--account <acc_id>` picks which connected
  LinkedIn account sends this message.** On a multi-account tenant, getting this wrong sends from the
  wrong person. Name the account explicitly on every write.
- **`--preview` before every send.** It renders the resolved request (recipient, text, acting
  account) without sending. On a read command it is refused with exit `2`.
- **`--json` on anything you parse**; **`--fields a,b,c`** to project (a message carries 22 fields);
  **`--verbose`** when a slim response looks suspiciously empty.
- **Put global flags at the end of the command.**
- **Branch on the exit code, never on prose.** See the table at the end.

### Text input

Message text is a positional argument, and `-` reads stdin. **Use a quoted heredoc**: the quoted
delimiter disables every shell expansion, so apostrophes, accents, `$` and backticks survive intact.
An unquoted heredoc has produced an empty message that went out blank.

```bash
cat <<'EOF' | curviate message send "<chat_id>" - --preview
Hi Thomas,

thanks for connecting. I saw the work you shared last week.
EOF
```

## Retrieval mode: `--mode` and `--max-age`

Exactly four reads decide between a stored copy and a live LinkedIn call: `profile me`,
`profile <id>`, `inbox get` and `inbox messages`. Two of them are here.

| `--mode` | Behaviour |
|---|---|
| `auto` (default) | A stored copy while it is fresh, otherwise fetch. |
| `live` | Always fetch from LinkedIn. |
| `refill` | A stored copy at any age; fetch only when nothing is stored. |
| `cache_only` | Never fetch. A store miss is refused, not fetched. |

`--max-age <seconds>` (0 to 31536000) overrides those presets in both directions; `--max-age 0` is
the same as `--mode live`. Every response carries `source: store | live` plus `observed_at` under
`--json`, and a `provenance:` line on stderr in human mode. Read `source` rather than assuming.

- **`cache_only` with `--max-age` is a usage error, exit `2`**, raised before any network call.
  `cache_only` never reaches LinkedIn at any age, so a freshness threshold cannot change its answer.
  Drop `--max-age`, or use `--mode refill`.
- **`cache_only` on a store miss is exit `14` (`NOT_STORED`)**: the chat may exist perfectly well on
  LinkedIn, this API just holds no copy. It is not "not found" (`4`), so re-checking the chat id is
  the wrong move, and it is not retryable as sent. Re-read with `refill`, `auto` or `live`.
- **`inbox messages`: one bare `--mode live` page restarts the chat walk and leaves it unservable by
  `cache_only` afterwards.** A listing is served from the store only over a *closed* walk.
  `inbox messages --all` walks to `cursor: null` and closes it. When you need a chat to be
  `cache_only`-servable later, reach for `--all` rather than a single live page.
- **Every other command refuses the flags outright rather than ignoring them**: `unknown flag
  --mode`, exit `2`.

## Reading: `inbox`

| Command | What it does | Confidence |
|---|---|---|
| `curviate inbox list` | Conversations, newest activity first, 20 by default. `--unread` / `--no-unread` filter by read state; `--inbox <folder>` selects `primary` (default), `inmail`, `archived`, `spam`, `jobs` or `starred`. | proven |
| `curviate inbox get <chat_id>` | One chat's detail including `last_message` (full text and sender), the cheap triage read. Accepts `--mode`/`--max-age`. | proven |
| `curviate inbox messages <chat_id>` | The messages in one chat. Full `text` per message; `is_sender` (0 or 1) says who sent each. `--before`/`--after` take ISO-8601 UTC with a `Z` suffix. Accepts `--mode`/`--max-age`. | proven |
| `curviate inbox search "<query>"` | Free-text search of the account's own inbox: participant names and message content. | proven |
| `curviate inbox mark-read <chat_id>` | Mark a chat read. | proven |

**Listing chats does not mark anything read**, so triage freely.

A chat item already carries the counterpart's identity: `user_id` (the `ACoAA…` member id), an
embedded `user{}` (`id`, `type`, `display_name`, `profile_url`, `public_picture_url`), and `name`,
the chat's own display name, which is populated on direct messages. Escalate to `curviate profile
<user_id>` only for what `user{}` does not carry: headline, network distance, the full profile.

### Traps

- **`--limit` on `inbox list` and `inbox messages` is validated client-side to 1-25** (default 20).
  Outside that range the command exits `2`.
- **Neither `inbox list` nor `inbox search` reliably answers "does a chat with X exist".** A single
  `inbox list --limit 25` call has repeatedly omitted a chat created seconds earlier, across
  candidates, not a one-off race. `inbox search` has a different defect: its result set is ranked
  and capped rather than exhaustive, so a common first name can omit an exact match that a rarer name
  finds immediately. When the answer matters, walk `inbox list` by `--cursor` to exhaustion (or a
  generous `--max-pages`) rather than trusting one page or the search.
- **Inbox threads carry no vanity slug.** `user.profile_url` is built from the member id and
  `public_identifier` is absent even under `--verbose`. Join inbox-driven flows on the member id.
- **`inbox list` has no date-range flags.** `--before`/`--after` exist on `inbox messages` only, and
  filter messages within one chat. Filter a chat list client-side on `last_message_timestamp`.
- **A very recent send or delete can take minutes to appear in `inbox messages`** (LinkedIn-side
  indexing). `message get <chat_id> <message_id>` reflects it immediately, use that to confirm a
  send, not a re-list.

## Discovering inboxes: `inboxes`

| Command | What it does | Confidence |
|---|---|---|
| `curviate inboxes list` | Every inbox the account can act in: its own, plus the company pages it administers. `--kind personal\|company` and `--company-id <id>` narrow it. Beta. | proven |
| `curviate inboxes chats <inbox_id>` | One inbox's conversations. Each chat id is send-ready. Beta. | proven |

**A `COMPANY_…` chat id sends as that page, with no extra flag.** Pass it to `message send` and the
message goes out from the page rather than from you; the output confirms with
`Sent as <name> (company page)`. Company inboxes are reply-only: they cannot start a conversation.
The page's own admin inbox has a second, richer surface under `company` (see `curviate-profile`).

## Sending: `message`

| Command | What it does | Confidence |
|---|---|---|
| `curviate message new --to <recipient> "<text>"` | Start a new chat. `--to` takes a profile URL, a bare slug or a member id, and resolves it for you. `--attach <file>` is repeatable. | proven |
| `curviate message send <chat_id> "<text>"` | Reply in an existing chat. A `COMPANY_` chat id sends as that page. | proven |
| `curviate message get <chat_id> <message_id>` | One message. Reflects a very recent send immediately, unlike the thread listing. | proven |
| `curviate message edit <chat_id> <message_id> "<text>"` | Edit a message within LinkedIn's allowed window. | proven |
| `curviate message delete <chat_id> <message_id>` | Delete a message. | proven |
| `curviate message react <chat_id> <message_id> <emoji>` | Add an emoji reaction to a message. | proven |
| `curviate message attachment <chat_id> <message_id> <attachment_id>` | Download an attachment. | proven |
| `curviate message inmail --to <recipient> --subject "<subject>" "<text>"` | Send an InMail. Both `--to` and `--subject` are required. Consumes an InMail credit. | proven |
| `curviate message inmail-balance` | Remaining InMail credits. Check before a run that depends on them. | proven |

**Chat ids** look like `CLASSIC_2-MzJmZTg1…` for a personal chat and `COMPANY_<id>_2-…` for a page.

**There is no idempotency key and no server-side de-duplication.** A send that times out may already
have landed. Re-read the thread (`inbox messages`, or `message get` for the id you just wrote)
before re-issuing anything.

## Event delivery: `webhook`

Message and account events arrive by webhook rather than by polling.

| Command | What it does | Confidence |
|---|---|---|
| `curviate webhook create --source <s> --request-url <https url> --account-ids <ids>` | Register an endpoint. `--source` is `messaging`, `user` or `account_status`. Also `--name`, `--events`, `--data`, `--no-enabled`. | proven |
| `curviate webhook list` | Registered webhooks. | proven |
| `curviate webhook events` | The canonical event catalogue, read it before subscribing to a name. | proven |
| `curviate webhook get <id>` | One webhook. | proven |
| `curviate webhook update <id>` | Update in place. `--request-url`, `--name`, `--enabled`, `--events`, `--data`, `--account-ids`. The source is immutable. | proven |
| `curviate webhook delete <id>` | Remove a subscription permanently. | proven |
| `curviate webhook verify --secret <s> --header <sig> --body <json\|file\|->` | Verify a delivery signature offline, no network call. `--max-age-secs` rejects a replay older than the given age (default 300). | proven |

Verify the signature on every delivery before acting on its body.

## Full command surface

<!-- generated: command surface, CLI 0.33.0 -->

Read from the CLI's own `--help` at version 0.33.0. Descriptions, traps and confidence
tags elsewhere in this skill are hand-written and carry the version they were established against.

Every command below that takes flags at all also accepts `--json`.

| Command | Arguments | Flags |
|---|---|---|
| `curviate inbox list` | *(none)* | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--preview`, `--verbose`, `--beta`, `--unread`, `--inbox` |
| `curviate inbox get` | `CHATID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--preview`, `--verbose`, `--beta`, `--mode`, `--max-age` |
| `curviate inbox mark-read` | `CHATID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--preview`, `--verbose`, `--beta` |
| `curviate inbox messages` | `CHATID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--preview`, `--verbose`, `--beta`, `--mode`, `--max-age`, `--before`, `--after` |
| `curviate inbox search` | `QUERY` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--preview`, `--verbose`, `--beta` |
| `curviate inboxes list` | *(none)* | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--preview`, `--verbose`, `--beta`, `--kind`, `--company-id` |
| `curviate inboxes chats` | `INBOXID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--preview`, `--verbose`, `--beta` |
| `curviate message` | `CHATID` `TEXT` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--preview`, `--verbose`, `--beta`, `--attach` |
| `curviate message new` | `TEXT` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--preview`, `--verbose`, `--beta`, `--to` *(required)*, `--attach` |
| `curviate message send` | `CHATID` `TEXT` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--preview`, `--verbose`, `--beta`, `--attach` |
| `curviate message get` | `CHATID` `MESSAGEID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--preview`, `--verbose`, `--beta` |
| `curviate message edit` | `CHATID` `MESSAGEID` `TEXT` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--preview`, `--verbose`, `--beta` |
| `curviate message delete` | `CHATID` `MESSAGEID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--preview`, `--verbose`, `--beta` |
| `curviate message react` | `CHATID` `MESSAGEID` `EMOJI` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--preview`, `--verbose`, `--beta`, `-emoji, --emojiAlias` |
| `curviate message attachment` | `CHATID` `MESSAGEID` `ATTACHMENTID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--preview`, `--verbose`, `--beta`, `-o, --output` |
| `curviate message inmail` | `TEXT` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--preview`, `--verbose`, `--beta`, `--to` *(required)*, `--subject` *(required)* |
| `curviate message inmail-balance` | *(none)* | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--preview`, `--verbose`, `--beta` |
| `curviate webhook create` | *(none)* | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--preview`, `--verbose`, `--beta`, `--source` *(required)*, `--request-url` *(required)*, `--account-ids` *(required)*, `--name`, `--no-enabled`, `--events`, `--data` |
| `curviate webhook list` | *(none)* | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--preview`, `--verbose`, `--beta` |
| `curviate webhook events` | *(none)* | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--preview`, `--verbose`, `--beta` |
| `curviate webhook get` | `ID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--preview`, `--verbose`, `--beta` |
| `curviate webhook update` | `ID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--preview`, `--verbose`, `--beta`, `--request-url`, `--name`, `--enabled`, `--events`, `--data`, `--account-ids` |
| `curviate webhook delete` | `ID` | `--api-key`, `--profile`, `--account`, `--base-url`, `--timeout`, `--fields`, `--limit`, `--cursor`, `--preview`, `--verbose`, `--beta` |
| `curviate webhook verify` | *(none)* | `--secret` *(required)*, `--header` *(required)*, `--body` *(required)*, `--max-age-secs` |

<!-- /generated -->

## Exit codes to branch on here

| Code | Meaning | What to do |
|---|---|---|
| `1` | `INTERNAL` from the server itself: a genuine bug on the platform side. | Worth one retry; if it repeats it is a bug to report, not a state to work around. |
| `2` | Usage or invalid input, often raised before any network call: a `--limit` outside 1-25, `cache_only` with `--max-age`, a missing `--subject` on an InMail. | Fix the invocation. Never retry unchanged. |
| `4` | Not found: a wrong chat, message or member identifier. | Re-resolve the id; do not retry as sent. |
| `5` | Three causes, one code: read `error.code`. `NO_ACTIVE_SEAT`: the account is on no active seat. `LINKEDIN_FEATURE_NOT_SUBSCRIBED`: LinkedIn itself lacks the feature. `BETA_NOT_ENABLED`: the operation is beta-gated and this workspace has not opted in (pass `--beta` for one call, or a human enables it in Settings). | Branch on `error.code`: the three fixes have nothing in common, and none is fixed by retrying unchanged. |
| `6` | `PLATFORM_RATE_LIMIT` and its siblings. Carries `retry_after` in whole seconds. A response naming `budgetRow` means only that row is paused; every other row on the account keeps working. | **Back off and retry** after that many seconds. On a named `budgetRow`, switch to other work on the account rather than backing off across the board. |
| `7` | Transient platform fault: a request that got no response at all (network error, DNS failure, timeout) or one that came back as something other than a valid API answer. Carries `retryLikelyToSucceed: true`. | Retry with backoff. |
| `8` | Account or connection state. Read `error.code`: `ACCOUNT_RESTRICTED`, `LINKEDIN_AUTH_FAILED`, `LINKEDIN_COOKIE_INVALID` need a reconnect. | Depends on `error.code`. |
| `10` | The edit or delete window expired, or the recipient is unreachable. | Not retryable as sent. Do not resend. |
| `13` | `BUDGET_EXHAUSTED`: a safety rule of your own refused the send, not LinkedIn. Read `error.safetyReason`: `ceiling` means the row named in `error.budgetRow` hit its configured limit; `activity_window` means the account is outside the hours it works in (no `budgetRow` on that one). **Nothing reached LinkedIn and nothing was spent; the message was not delivered.** `reset_at` can be weeks out, and may be `null` where no clock frees it. | **Do not back off and retry.** `error.safetyHint.parameter` names the exact setting to change. Read `quotas[]` via `curviate account get <acc_id> --json`, then wait for the named reset or change that setting. |
| `14` | `NOT_STORED`: a `cache_only` read the store cannot answer. | Re-read with `refill`, `auto` or `live`. |

---
name: slack-bot-builder
description: "Build Slack apps using the Bolt framework across Python, JavaScript, and Java. Covers Block Kit for rich UIs, interactive components, slash commands, event handling, OAuth installation flows, and Workflow Builder integration. Focus on best practices for production-ready Slack apps. Use when: slack bot, slack app, bolt framework, block kit, slash command."
source: vibeship-spawner-skills (Apache 2.0)
---

# Slack Bot Builder

## Patterns

### Bolt App Foundation Pattern

The Bolt framework is Slack's recommended approach for building apps.
It handles authentication, event routing, request verification, and
HTTP request processing so you can focus on app logic.

Key benefits:
- Event handling in a few lines of code
- Security checks and payload validation built-in
- Organized, consistent patterns
- Works for experiments and production

Available in: Python, JavaScript (Node.js), Java


**When to use**: ['Starting any new Slack app', 'Migrating from legacy Slack APIs', 'Building production Slack integrations']

```python
# Python Bolt App
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
import os

# Initialize with tokens from environment
app = App(
    token=os.environ["SLACK_BOT_TOKEN"],
    signing_secret=os.environ["SLACK_SIGNING_SECRET"]
)

# Handle messages containing "hello"
@app.message("hello")
def handle_hello(message, say):
    """Respond to messages containing 'hello'."""
    user = message["user"]
    say(f"Hey there <@{user}>!")

# Handle slash command
@app.command("/ticket")
def handle_ticket_command(ack, body, client):
    """Handle /ticket slash command."""
    # Acknowledge immediately (within 3 seconds)
    ack()

    # Open a modal for ticket creation
    client.views_open(
        trigger_id=body["trigger_id"],
        view={
            "type": "modal",
            "callback_id": "ticket_modal",
            "title": {"type": "plain_text", "text": "Create Ticket"},
            "submit": {"type": "plain_text", "text": "Submit"},
            "blocks": [
                {
                    "type": "input",
                    "block_id": "title_block",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "title_input"
                    },
                    "label": {"type": "plain_text", "text": "Title"}
                },
                {
                    "type": "input",
                    "block_id": "desc_block",
                    "element": {
                        "type": "plain_text_input",
                        "multiline": True,
                        "action_id": "desc_input"
                    },
                    "label": {"type": "plain_text", "text": "Description"}
                },
                {
                    "type": "input",
                    "block_id": "priority_block",
                    "element": {
                        "type": "static_select",
                        "action_id": "priority_select",
   
```

### Block Kit UI Pattern

Block Kit is Slack's UI framework for building rich, interactive messages.
Compose messages using blocks (sections, actions, inputs) and elements
(buttons, menus, text inputs).

Limits:
- Up to 50 blocks per message
- Up to 100 blocks in modals/Home tabs
- Block text limited to 3000 characters

Use Block Kit Builder to prototype: https://app.slack.com/block-kit-builder


**When to use**: ['Building rich message layouts', 'Adding interactive components to messages', 'Creating forms in modals', 'Building Home tab experiences']

```python
from slack_bolt import App
import os

app = App(token=os.environ["SLACK_BOT_TOKEN"])

def build_notification_blocks(incident: dict) -> list:
    """Build Block Kit blocks for incident notification."""
    severity_emoji = {
        "critical": ":red_circle:",
        "high": ":large_orange_circle:",
        "medium": ":large_yellow_circle:",
        "low": ":white_circle:"
    }

    return [
        # Header
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{severity_emoji.get(incident['severity'], '')} Incident Alert"
            }
        },
        # Details section
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Incident:*\n{incident['title']}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Severity:*\n{incident['severity'].upper()}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Service:*\n{incident['service']}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Reported:*\n<!date^{incident['timestamp']}^{date_short} {time}|{incident['timestamp']}>"
                }
            ]
        },
        # Description
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Description:*\n{incident['description'][:2000]}"
            }
        },
        # Divider
        {"type": "divider"},
        # Action buttons
        {
            "type": "actions",
            "block_id": f"incident_actions_{incident['id']}",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Acknowledge"},
                    "style": "primary",
                    "action_id": "acknowle
```

### OAuth Installation Pattern

Enable users to install your app in their workspaces via OAuth 2.0.
Bolt handles most of the OAuth flow, but you need to configure it
and store tokens securely.

Key OAuth concepts:
- Scopes define permissions (request minimum needed)
- Tokens are workspace-specific
- Installation data must be stored persistently
- Users can add scopes later (additive)

70% of users abandon installation when confronted with excessive
permission requests - request only what you need!


**When to use**: ['Distributing app to multiple workspaces', 'Building public Slack apps', 'Enterprise-grade integrations']

```python
from slack_bolt import App
from slack_bolt.oauth.oauth_settings import OAuthSettings
from slack_sdk.oauth.installation_store import FileInstallationStore
from slack_sdk.oauth.state_store import FileOAuthStateStore
import os

# For production, use database-backed stores
# For example: PostgreSQL, MongoDB, Redis

class DatabaseInstallationStore:
    """Store installation data in your database."""

    async def save(self, installation):
        """Save installation when user completes OAuth."""
        await db.installations.upsert({
            "team_id": installation.team_id,
            "enterprise_id": installation.enterprise_id,
            "bot_token": encrypt(installation.bot_token),
            "bot_user_id": installation.bot_user_id,
            "bot_scopes": installation.bot_scopes,
            "user_id": installation.user_id,
            "installed_at": installation.installed_at
        })

    async def find_installation(self, *, enterprise_id, team_id, user_id=None, is_enterprise_install=False):
        """Find installation for a workspace."""
        record = await db.installations.find_one({
            "team_id": team_id,
            "enterprise_id": enterprise_id
        })

        if record:
            return Installation(
                bot_token=decrypt(record["bot_token"]),
                # ... other fields
            )
        return None

# Initialize OAuth-enabled app
app = App(
    signing_secret=os.environ["SLACK_SIGNING_SECRET"],
    oauth_settings=OAuthSettings(
        client_id=os.environ["SLACK_CLIENT_ID"],
        client_secret=os.environ["SLACK_CLIENT_SECRET"],
        scopes=[
            "channels:history",
            "channels:read",
            "chat:write",
            "commands",
            "users:read"
        ],
        user_scopes=[],  # User token scopes if needed
        installation_store=DatabaseInstallationStore(),
        state_store=FileOAuthStateStore(expiration_seconds=600)
    )
)

# OAuth routes are handled a
```

## ⚠️ Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| Issue | critical | ## Acknowledge immediately, process later |
| Issue | critical | ## Proper state validation |
| Issue | critical | ## Never hardcode or log tokens |
| Issue | high | ## Request minimum required scopes |
| Issue | medium | ## Know and respect the limits |
| Issue | high | ## Socket Mode: Only for development |
| Issue | critical | ## Bolt handles this automatically |

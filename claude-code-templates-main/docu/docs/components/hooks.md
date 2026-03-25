---
sidebar_position: 4
---

# Hooks

Automation triggers that execute actions based on events. Browse and install from **[aitmpl.com](https://aitmpl.com)**.

## 🪝 What are Hooks?

Hooks are automation scripts that trigger actions when specific events occur in your development workflow. They run automatically in the background.

## Installation

### 📦 Basic Installation
Install this component locally in your project. Works with your existing Claude Code setup.

```bash
npx claude-code-templates@latest --hook git/auto-git-add --yes
```

### Multiple Hooks
```bash
npx claude-code-templates@latest --hook notifications/discord-notifications,git/smart-commit --yes
```

## ⚙️ Hook Configuration

Most hooks require configuration after installation:

### Environment Variables
```bash
# Notification hooks
DISCORD_WEBHOOK_URL=your_discord_webhook
SLACK_WEBHOOK_URL=your_slack_webhook
TELEGRAM_BOT_TOKEN=your_telegram_token

# Deployment hooks
DEPLOY_API_KEY=your_deploy_key
STAGING_URL=your_staging_url
PRODUCTION_URL=your_production_url
```

## 🔄 Hook Events

Hooks trigger on various events:
- **File changes** → `git/auto-git-add`
- **Commits** → `git/pre-commit-validation`
- **File save** → `quality/lint-on-save`
- **Test run** → `testing/coverage-reporter`

## 🛠️ Managing Hooks

### Enable/Disable Hooks
```bash
# Disable a hook
echo '{"enabled": false}' > .claude/hooks/discord-notifications.json

# Re-enable a hook
echo '{"enabled": true}' > .claude/hooks/discord-notifications.json
```

## 📁 Hook Categories

Browse hooks by automation area to add the right triggers for your workflow:

### Git Automation
Automatic Git operations and version control workflows. Examples: `auto-git-add` for automatic staging, `smart-commit` for intelligent commits, `pre-commit-validation` for quality checks.

### Notifications
Real-time alerts to communication platforms. Examples: `discord-notifications` for Discord alerts, `slack-notifications` for team updates, `telegram-notifications` for mobile alerts.

### Testing & Quality
Automated testing and code quality enforcement. Examples: `auto-test-runner` for continuous testing, `coverage-reporter` for test metrics, `lint-on-save` for code quality.

### Performance Monitoring
Performance tracking and system optimization. Examples: `performance-monitor` for system metrics, `memory-tracker` for resource usage, `build-time-tracker` for compilation monitoring.

### Deployment
Automated deployment and CI/CD triggers. Examples: `auto-deploy` for automatic deployment, `staging-deploy` for environment management, `production-guard` for safety checks.

### Documentation
Automatic documentation maintenance. Examples: `auto-doc-update` for documentation sync, `changelog-generator` for release notes, `api-doc-sync` for API documentation.

## 🎯 How to Choose Hooks

Select hooks based on your team structure and automation needs:

### By Team Size
- **Solo projects**: Use `auto-git-add` and `performance-monitor` for personal productivity
- **Small teams**: Add `slack-notifications` and `auto-test-runner` for coordination
- **Large teams**: Include `pre-commit-validation` and `production-guard` for safety

### By Project Type
- **Web applications**: Choose `auto-test-runner` and `auto-deploy` for development automation
- **Open source libraries**: Use `changelog-generator` and `lint-on-save` for maintenance
- **API services**: Select `performance-monitor` and `api-doc-sync` for service management

### By Development Stage
- **Active development**: Focus on `auto-git-add` and `lint-on-save` for productivity
- **Testing phase**: Use `coverage-reporter` and `slack-notifications` for visibility
- **Production**: Add `production-guard` and `deployment-metrics` for reliability

## 💡 Pro Tips

- **Start with Git hooks** for basic automation
- **Add notifications** for team coordination
- **Use testing hooks** for quality assurance
- **Monitor performance** with tracking hooks
- **Browse [aitmpl.com](https://aitmpl.com)** for specialized automation

---

**Find more hooks:** [Browse all hooks on aitmpl.com](https://aitmpl.com) → Filter by "Hooks"
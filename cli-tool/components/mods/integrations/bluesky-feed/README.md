# bluesky-feed

Your [Bluesky](https://bsky.app) timeline in a side pane: the posts of the accounts you follow, a field to write and send a post, and a like button on every post.

```
 🦋 BLUESKY  FOLLOWING              @you.bsky.social · updated now
──────────────────────────────────────────────────────────────────
✎ post: What's up?
300 left · Enter posts · links and #tags are clickable

Mara Quinn @mara.dev · 5m
Shipped a Claude Code mod that turns every failing test into a toast.
🔗 aitmpl.com: Claude Mods catalog
♡ 128  ↩ 9  ↻ 14  open ↗
──────────────────────────────────────────────────────────────────
↻ reposted by Sam Ortiz
Infra Notes @infra-notes.bsky.social · 27m
Our p99 dropped 40% after moving the cache in front of the auth check.
▣ 2 images
♥ 55  ↩ 3  ↻ 6  open ↗
──────────────────────────────────────────────────────────────────
[ more ] [ refresh ] [ close ]
```

`/bsky` opens it (`/bsky stop` closes it).

- **Timeline**: your Following timeline (`app.bsky.feed.getTimeline`), newest first. Reposts and replies are marked. Images, videos, link cards and quoted posts are described in one line, not drawn. `more` loads the next page, up to 120 posts. While the pane is open it refreshes every `pollSeconds`.
- **Post**: type in the field and press Enter. The counter turns yellow near Bluesky's 300-character limit and red past it. Links and `#hashtags` are sent as richtext facets, so they are clickable on bsky.app. `@mentions` are sent as plain text, because linking one would take one more request per name to resolve the handle.
- **Like**: press the count next to the heart to like a post. Press it again to unlike, which deletes your like record. The heart turns pink right away and goes back if Bluesky refuses.
- **open ↗** opens the post on bsky.app.

On Claude Code's mobile surface the pane is read-only: the mobile surface draws no input field.

## Why Bluesky

Bluesky's API is free and public. You don't need a developer account or credits: an app password is enough. X was considered first and ruled out. Since April 2026 X's self-serve API no longer allows likes, and reading the home timeline is billed per post ([X API changelog](https://docs.x.com/changelog), [pricing](https://docs.x.com/x-api/getting-started/pricing)).

Bluesky's documented limits are 3,000 requests per 5 minutes per IP and 5,000 write points per hour, where a post or like costs 3 points. Logging in is limited to 30 times per 5 minutes. The mod logs in once, refreshes the session when the access token expires, and reads at most once per `pollSeconds`.

## Scope and secrets

The mod uses an **app password**, never your account password. Create one in Bluesky under Settings, Privacy and security, App passwords. You can revoke it there at any time.

The app password and the session tokens are kept in memory and sent only to `service`, which must be `https://`. Plain `http://` is accepted only for a PDS on your own machine (`localhost`, `127.0.0.1`). Any other `http://` value falls back to `https://bsky.social`. They are never logged, drawn or written to disk. The app password option is stored as sensitive. Posts are held in memory while the pane is open and are not stored either.

The mod reads your timeline, creates posts, creates likes and deletes likes. It does nothing else with your account.

## Options

```
  handle: string        your handle, e.g. you.bsky.social (required)
  appPassword: string   a Bluesky app password (required, sensitive)
  service: string       your PDS; https://bsky.social unless you self-host
  limit: number         posts per page, 10-50 (default 30)
  pollSeconds: number   refresh interval while open, 30-3600 (default 120)
  openOnStart: boolean  open the pane at session start (default false)
```

`pollSeconds` is honoured to the nearest 5 seconds.

## Install

```sh
npx claude-code-templates@latest --mod integrations/bluesky-feed
claude
```

The mod is written to `.claude/skills/bluesky-feed/`. Claude Code auto-loads it from there as `bluesky-feed@skills-dir` once you accept the workspace trust prompt. To load it for one session with hot reload, run `claude --plugin-dir .claude/skills/bluesky-feed`. `claude plugin validate .claude/skills/bluesky-feed` prints every event the mod hooks and every `$` call it makes. `claude plugin test .claude/skills/bluesky-feed` runs its tests.

Options are read from user settings (`~/.claude/settings.json`, never project settings), from `--settings <file>` or from managed settings. They go under the plugin's full id:

```json
{ "pluginConfigs": { "bluesky-feed@skills-dir": { "options": { "handle": "you.bsky.social", "appPassword": "xxxx-xxxx-xxxx-xxxx" } } } }
```

**Requirements.** Claude Code 2.1.287 or later, where mods are on by default. The mod is typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods

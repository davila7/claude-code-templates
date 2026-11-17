# live-preview

A pane with a real screenshot of the app you are building. A headless Chrome, Chromium or Edge loads your dev server and the mod draws the picture next to the transcript. The capture is taken again at the end of every turn in which Claude edited a frontend file, so you can see what a change did without switching to the browser.

```bash
npx claude-code-templates@latest --mod ui/live-preview
```

Then start your dev server and run:

```
/preview http://localhost:4321
```

| Command | What it does |
| --- | --- |
| `/preview` | Opens the pane on the configured URL (default `http://localhost:3000`) |
| `/preview <url>` | Captures another http(s) URL for the rest of the session |
| `/preview mobile` / `/preview desktop` | Captures at 390×844 or 1280×800 |
| `/preview stop` | Closes the pane |

The pane's buttons are **↻ Refresh**, **Mobile 390 / Desktop 1280**, and **Attach to prompt →**, which adds `@.claude/previews/latest.png` to your prompt so Claude can look at the same screenshot ("the border is too thick on mobile").

A new capture is taken after a turn that used Edit, Write, MultiEdit or NotebookEdit on a file with a watched extension (`tsx jsx ts js mjs css scss sass less html astro vue svelte mdx md json svg`). Files under `node_modules`, `dist`, `build`, `.next`, `.astro`, `.claude` and `.git` are ignored.

## Where the picture draws

The pane uses the terminal's `Image` element:

- **kitty, Ghostty**, and **iTerm2 3.5+** with fullscreen rendering (Claude Code 2.1.305+)
- **tmux** with `set -g allow-passthrough on` and `set -g focus-events on` (Claude Code 2.1.310+)

In any other terminal the pane shows the image's alt text. Claude Desktop, VS Code and the mobile app have no `Image` element, so the pane says where the file is (`.claude/previews/latest.png`).

## Options

Set them in `~/.claude/settings.json` under `pluginConfigs["live-preview@skills-dir"].options`.

| Option | Default | What it does |
| --- | --- | --- |
| `url` | `http://localhost:3000` | Page to capture (http or https only) |
| `browser` | auto | Path to the Chrome/Chromium/Edge executable. When empty, the mod tries `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser` and `microsoft-edge` on PATH, then the standard macOS app locations (fixed system paths, the one exception to the catalog's no-absolute-paths rule) |
| `browserArgs` | — | Comma-separated extra flags, e.g. `--no-sandbox` when running as root in a container |
| `watch` | frontend set | Comma-separated extensions that trigger a capture |

## Notes

- The browser runs through `$.process.run` with a fixed argument vector, never through a shell, and only http(s) URLs are accepted, so a URL can't be read as a browser flag.
- Each capture overwrites `.claude/previews/latest.png`. The mod writes `.claude/previews/.gitignore` so the captures stay out of git.
- A capture takes one to three seconds. A capture that starts while another is running is skipped.

Needs Claude Code 2.1.305 or later (2.1.310 for tmux).

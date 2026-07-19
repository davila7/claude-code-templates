#!/usr/bin/env node
/**
 * pre-push-review — Claude Code PreToolUse gate.
 *
 * Fires whenever Claude Code is about to run a Bash `git push`, runs the bundled
 * expert panel (./ai-review-panel.mjs) over the commits being pushed, and BLOCKS the
 * push if a blocking (default: critical) issue is found — so code is never pushed
 * without an exhaustive multi-agent review, in every repo, automatically.
 *
 * This is a plugin-local, self-contained hook: it depends only on files shipped inside
 * this plugin (resolved via CLAUDE_PLUGIN_ROOT, with a fallback relative to this file),
 * NOT on any hand-installed ~/.config or ~/.claude script. That is the whole point —
 * portable and versioned instead of per-machine hand-wiring.
 *
 * Protocol: reads the PreToolUse JSON on stdin. Exit 0 = allow the push; exit 2 = block
 * (stderr is fed back to the model as the reason).
 *
 * Escape hatch: set PREPUSH_REVIEW_SKIP=1 (or AI_REVIEW_SKIP=1) to bypass.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

function readStdin() {
  return new Promise((res) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    // Bound the read — a PreToolUse payload is small; never accumulate unboundedly.
    process.stdin.on('data', (c) => {
      if (data.length < 1_000_000) data += c;
    });
    process.stdin.on('end', () => res(data));
    // Safety: if no stdin arrives, don't hang the tool call.
    setTimeout(() => res(data), 2000).unref?.();
  });
}

if (process.env.PREPUSH_REVIEW_SKIP === '1' || process.env.AI_REVIEW_SKIP === '1') {
  process.exit(0);
}

const raw = await readStdin();
let payload = {};
try {
  payload = JSON.parse(raw || '{}');
} catch {
  process.exit(0); // can't parse → don't interfere
}

const toolName = payload.tool_name || payload.toolName || '';
const command = (payload.tool_input || payload.toolInput || {}).command || '';
const cwd = payload.cwd || process.cwd();

// Only act on a REAL `git push` command segment — not "push" inside a quoted arg
// (e.g. git commit -m "push ...") or inside another command (echo/printf "git push").
// Split on shell separators and require a segment that starts with git + flags + push.
const PUSH_RE = /^\s*git\s+(-C\s+\S+\s+|--?\S+\s+)*push(\s|$|["'])/;
const isGitPush = command
  .split(/&&|\|\||;|\||\n/)
  .some((seg) => PUSH_RE.test(seg.trim()));
if (toolName !== 'Bash' || !isGitPush) process.exit(0);

// Resolve the bundled panel. CLAUDE_PLUGIN_ROOT is injected by Claude Code for plugin
// hooks; fall back to this file's own directory so the gate also works when run directly.
const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || resolve(here, '..');
const panel = join(pluginRoot, 'scripts', 'ai-review-panel.mjs');
if (!existsSync(panel)) process.exit(0); // advisory: no panel → allow

let out = '';
let code = 0;
try {
  out = execFileSync('node', [panel, '--branch'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  out = `${e.stdout || ''}${e.stderr || ''}`;
  code = typeof e.status === 'number' ? e.status : 0;
}

// Panel exit codes: 0 = ok/advisory, 1 = blocking (critical) issues, 2 = CLI unavailable.
if (code === 1) {
  process.stderr.write(
    'pre-push-review BLOCKED this push — critical issue(s) found by the expert panel:\n\n' +
      out +
      '\nFix the critical issue(s) and push again. (To bypass once: set PREPUSH_REVIEW_SKIP=1, ' +
      'or ask the user to confirm the override.)\n',
  );
  process.exit(2);
}

// Allowed: drop a pass-marker keyed on the HEAD sha so an in-repo husky pre-push gate can
// skip re-running the panel (no double work). When this hook is bypassed (background /
// disabled), no marker is written and the repo hook runs the panel itself.
try {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const dir = join(homedir(), '.cache', 'git-ai-review');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `pass-${sha}`), String(Date.now()));
} catch {
  /* marker is best-effort */
}

// Surface a concise summary so the review is visible in the transcript.
const summary = (out.match(/SUMMARY:.*/) || ['(panel ran)'])[0];
process.stdout.write(`[pre-push-review] ${summary}\n`);
process.exit(0);

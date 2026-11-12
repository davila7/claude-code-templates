const { spawn } = require('child_process');

/**
 * How to start the `claude` CLI so each argument reaches it as one argv entry.
 *
 * POSIX: no shell. A prompt with spaces, quotes, `$(...)` or `;` is passed
 * verbatim and is never shell syntax. (With `shell: true`, Node joins the
 * arguments with spaces, so `--prompt "fix the bug"` reached claude as three
 * words, and a missing claude never raised ENOENT.)
 *
 * Windows: an npm install of Claude Code is `claude.cmd`, which Node can only
 * start through cmd.exe, so the shell stays on and each argument is wrapped in
 * double quotes, inside which cmd.exe takes & | < > ^ literally. A double
 * quote in the text becomes a single quote: it is the one character that
 * cannot survive cmd.exe and the .cmd shim intact.
 *
 * @param {string[]} args - Arguments for claude
 * @param {string} [platform] - process.platform (overridable for tests)
 * @returns {{ command: string, args: string[], shell: boolean }}
 */
function claudeLaunchSpec(args, platform = process.platform) {
  if (platform !== 'win32') {
    return { command: 'claude', args: args.map(String), shell: false };
  }
  const quoted = args.map(arg => {
    // Trailing backslashes would escape the closing quote: double them.
    const text = String(arg).replace(/"/g, "'").replace(/(\\+)$/, '$1$1');
    return `"${text}"`;
  });
  return { command: 'claude', args: quoted, shell: true };
}

/** spawn('claude', args) with the platform rules above. */
function spawnClaude(args, options = {}) {
  const spec = claudeLaunchSpec(args);
  return spawn(spec.command, spec.args, { ...options, shell: spec.shell });
}

/** A copy-pasteable POSIX shell command that runs claude with these arguments. */
function claudeCommandLine(args) {
  return ['claude', ...args.map(arg => `'${String(arg).replace(/'/g, `'\\''`)}'`)].join(' ');
}

module.exports = { claudeLaunchSpec, spawnClaude, claudeCommandLine };

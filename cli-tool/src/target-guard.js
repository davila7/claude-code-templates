'use strict';

/**
 * Refuse to install into a folder that is never a project: the Windows system
 * folder (an administrator terminal opens in C:\Windows\System32) or the root
 * of a drive. Writes there fail with EPERM, or worse, succeed. Before 1.33 this
 * was about 18% of all failed installs.
 */

const path = require('path');

/**
 * Why `dir` is not a safe install target, or null when it is.
 * Returns { reason: 'system_dir' | 'drive_root', dir } with the resolved path.
 */
function unsafeTarget(dir, { platform = process.platform, env = process.env } = {}) {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const resolved = p.resolve(dir);
  const trimmed = resolved.length > p.parse(resolved).root.length ? resolved.replace(/[\\/]+$/, '') : resolved;

  if (trimmed === p.parse(trimmed).root) return { reason: 'drive_root', dir: trimmed };

  if (platform === 'win32') {
    const windowsDir = p.resolve(env.SystemRoot || env.windir || 'C:\\Windows').replace(/[\\/]+$/, '').toLowerCase();
    const lower = trimmed.toLowerCase();
    if (lower === windowsDir || lower.startsWith(windowsDir + '\\')) return { reason: 'system_dir', dir: trimmed };
  }
  return null;
}

/** The lines that explain the refusal and say where to go instead. */
function unsafeTargetMessage(target, { platform = process.platform, env = process.env } = {}) {
  const what = target.reason === 'system_dir'
    ? 'it is a Windows system folder (a terminal opened as administrator starts there)'
    : 'it is the root of a drive, not a project folder';
  const example = platform === 'win32'
    ? `cd "${(env.USERPROFILE || 'C:\\Users\\you')}\\path\\to\\your-project"`
    : 'cd ~/path/to/your-project';
  return [
    `Not installing into ${target.dir}: ${what}. Nothing was written.`,
    `Open your project folder first (${example}) and run the same command again,`,
    'or add --directory <your project folder>.'
  ];
}

module.exports = { unsafeTarget, unsafeTargetMessage };

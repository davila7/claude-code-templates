#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';

const SERVICE = 'workorai';
const CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
const TOKEN_PATTERN = /^wai_\S{16,}$/;

// Role-aware storage slots — see
// `docs/plans/2026-05-29-workorai-skill-employer-update-design.md`
// (Q4 in the WorkorAI repo).
const ROLE_VALUES = new Set(['candidate', 'employer']);
const DEFAULT_ROLE = 'candidate';
const ENV_KEY_BY_ROLE = {
  candidate: 'WORKORAI_MCP_API_KEY',
  employer: 'WORKORAI_EMPLOYER_MCP_API_KEY',
};
const SHARED_FILE_BY_ROLE = {
  candidate: join(CONFIG_HOME, 'workorai', 'mcp-token'),
  employer: join(CONFIG_HOME, 'workorai', 'mcp-token-employer'),
};
// OS secret store account name. Distinguishes roles inside the same
// service entry so candidate + employer keys coexist.
const ACCOUNT_BY_ROLE = {
  candidate: 'candidate',
  employer: 'employer',
};

const extractRoleFlag = (argv) => {
  let role = DEFAULT_ROLE;
  let seen = false;
  const rest = [];
  for (const arg of argv) {
    const match = /^--role(?:=(.+))?$/.exec(arg);
    if (!match) {
      rest.push(arg);
      continue;
    }
    if (seen) {
      // Two `--role=` flags would silently last-write-wins and route
      // the call to the wrong storage slot. Surface it instead.
      throw new Error(
        '--role specified more than once. Pick one of: ' +
          `${[...ROLE_VALUES].join(', ')}.`,
      );
    }
    const value = match[1];
    if (!value || !ROLE_VALUES.has(value)) {
      throw new Error(
        `--role requires one of: ${[...ROLE_VALUES].join(', ')}`,
      );
    }
    role = value;
    seen = true;
  }
  return { role, rest };
};

const rawArgs = process.argv.slice(2);
const command = rawArgs[0];
let role;
let args;
try {
  const extracted = extractRoleFlag(rawArgs.slice(1));
  role = extracted.role;
  args = extracted.rest;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const ACCOUNT = ACCOUNT_BY_ROLE[role];
const ENV_KEY = ENV_KEY_BY_ROLE[role];
const SHARED_FILE_PATH = SHARED_FILE_BY_ROLE[role];

// Test isolation hook — set `WORKORAI_DISABLE_OS_KEYSTORE=1` to short-
// circuit the macOS/Linux/Windows secret-store paths so the tests can
// exercise env + shared-file behaviour without touching the real
// keystore (which would prompt for unlock or fail in CI).
const OS_KEYSTORE_DISABLED = process.env.WORKORAI_DISABLE_OS_KEYSTORE === '1';

const usage = () => {
  console.error(`Usage:
  node credential-store.mjs get [--role=candidate|employer]
  node credential-store.mjs save [--role=candidate|employer] [--best-effort|--shared-file]
  node credential-store.mjs delete [--role=candidate|employer] [--shared-file]

save reads the WorkorAI MCP key from piped stdin or prompts in an interactive terminal.
get prints the key to stdout only when found.
Default read order: env(${ENV_KEY}) -> OS secret store -> shared file fallback.
Default save backend: OS secret store.
Default role is 'candidate'. Pass --role=employer to use the employer key slot
(env WORKORAI_EMPLOYER_MCP_API_KEY, file ~/.config/workorai/mcp-token-employer,
OS keystore account 'employer').
Use --best-effort after explicit consent to save to OS secret store, then fall back to the shared 0600 file if OS storage is unavailable.
Use --shared-file only when the user explicitly chooses file fallback.`);
};

const normalizeToken = (value) => value.trim();

const redactSecrets = (value) => value.replace(/wai_\S+/g, 'wai_[REDACTED]');

const assertValidToken = (token) => {
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error('Invalid WorkorAI MCP key format. Expected wai_... token.');
  }
};

const commandExists = (name) => {
  const checker = platform() === 'win32' ? 'where' : 'command';
  const checkerArgs = platform() === 'win32' ? [name] : ['-v', name];
  const result = spawnSync(checker, checkerArgs, {
    shell: platform() !== 'win32',
    stdio: 'ignore',
  });

  return result.status === 0;
};

const readHiddenTtyToken = async () => {
  if (!process.stdin.isTTY) {
    throw new Error(
      'No WorkorAI MCP key provided on stdin. Run this command in an interactive terminal and paste the key when prompted, or pass it through stdin.'
    );
  }

  process.stderr.write('Paste WorkorAI MCP key: ');
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  const canUseRawMode = typeof process.stdin.setRawMode === 'function';

  if (canUseRawMode) {
    process.stdin.setRawMode(true);
  }

  let token = '';

  return await new Promise((resolvePromise, rejectPromise) => {
    const cleanup = () => {
      process.stdin.off('data', handleData);

      if (canUseRawMode) {
        process.stdin.setRawMode(false);
      }

      process.stdin.pause();
    };

    const handleData = (chunk) => {
      for (const char of String(chunk)) {
        if (char === '\u0003') {
          cleanup();
          process.stderr.write('\n');
          rejectPromise(new Error('Cancelled.'));
          return;
        }

        if (char === '\r' || char === '\n') {
          cleanup();
          process.stderr.write('\n');
          resolvePromise(normalizeToken(token));
          return;
        }

        if (char === '\u007f' || char === '\b') {
          token = token.slice(0, -1);
          continue;
        }

        token += char;
      }
    };

    process.stdin.on('data', handleData);
  });
};

const readTokenForSave = async () => {
  if (!process.stdin.isTTY) {
    const input = readFileSync(0, 'utf8');
    const token = normalizeToken(input);

    if (!token) {
      throw new Error(
        'No WorkorAI MCP key provided on stdin. Run this command in an interactive terminal/PTY and paste the key when prompted, or pass it through stdin.'
      );
    }

    assertValidToken(token);
    return token;
  }

  const token = await readHiddenTtyToken();
  assertValidToken(token);
  return token;
};

const tryGetFromEnv = () => {
  const token = normalizeToken(process.env[ENV_KEY] ?? '');

  if (!token) {
    return null;
  }

  assertValidToken(token);
  return token;
};

// Differentiate "not-found" (the normal fall-through case) from
// "backend error" (locked vault, dismissed unlock prompt, missing
// secret-tool daemon). Both still return null so the caller falls
// through to the next backend, but the latter is logged to stderr
// with redacted detail so users have a chance to see why the
// keystore read missed.
//
// On Linux, `secret-tool lookup` exits 1 with NO stderr output when
// the entry is missing — Node's execFileSync then throws with a
// generic "Command failed: secret-tool lookup ..." message. The
// patterns alone cannot disambiguate that from a real backend error;
// the helper below also inspects exit code + stderr emptiness for the
// Linux backend specifically.
//
// On Windows, PowerShell SecretManagement emits "The secret <name>
// was not found." for normal misses, which the patterns now match.
//
// Track whether ANY OS-store read surfaced a real backend error so
// handleGet can later flag that a shared-file fallback might be stale.
const KEYSTORE_NOT_FOUND_PATTERNS = [
  /The specified item could not be found in the keychain/i, // macOS security
  /The secret .* was not found/i,                            // PowerShell SecretManagement
  /Cannot find a secret with name/i,                         // PowerShell SecretManagement variant
  /Cannot find any secret/i,                                 // older PowerShell SecretManagement
  /No matching results/i,                                    // some secret-tool builds
  /No secret found for/i,                                    // secret-tool variant
  /could not be found/i,                                     // generic catch-all
];

let osStoreReadErrorSurfaced = false;

const errorLooksLikeNotFound = (backendLabel, error) => {
  const raw = error instanceof Error ? error.message : String(error);

  // Linux secret-tool: exit code 1 with no stderr means "not present".
  // Anything else (locked seahorse, missing D-Bus, etc.) carries
  // non-empty stderr or a different exit code.
  if (backendLabel === 'Linux Secret Service') {
    const status = typeof error?.status === 'number' ? error.status : null;
    const stderr = error?.stderr ? String(error.stderr).trim() : '';
    if (status === 1 && stderr.length === 0) {
      return true;
    }
  }

  return KEYSTORE_NOT_FOUND_PATTERNS.some((re) => re.test(raw));
};

const surfaceKeystoreReadFailure = (backendLabel, error) => {
  if (errorLooksLikeNotFound(backendLabel, error)) {
    return; // ordinary "no entry" — stay silent
  }
  osStoreReadErrorSurfaced = true;
  const raw = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `credential-store: ${backendLabel} read failed (falling through): ${redactSecrets(raw)}\n`,
  );
};

// Returns true when the error is a benign "no entry" miss (silent),
// false when a real backend failure was surfaced to stderr. Callers
// use the return value to propagate non-zero exit through
// `deleteFromOsStore` → `handleDelete` so scripts piping `delete` into
// follow-up commands can detect failure.
const surfaceKeystoreDeleteFailure = (backendLabel, error) => {
  if (errorLooksLikeNotFound(backendLabel, error)) {
    return true; // "nothing to delete" — caller treats as success
  }
  const raw = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `credential-store: ${backendLabel} delete failed: ${redactSecrets(raw)}\n`,
  );
  return false;
};

const getFromMacKeychain = () => {
  if (platform() !== 'darwin') {
    return null;
  }

  try {
    return normalizeToken(
      execFileSync('/usr/bin/security', [
        'find-generic-password',
        '-a',
        ACCOUNT,
        '-s',
        SERVICE,
        '-w',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    );
  } catch (error) {
    surfaceKeystoreReadFailure('macOS Keychain', error);
    return null;
  }
};

const saveToMacKeychain = (token) => {
  const result = spawnSync('/usr/bin/security', [
    'add-generic-password',
    '-a',
    ACCOUNT,
    '-s',
    SERVICE,
    '-w',
    token,
    '-U',
  ], { encoding: 'utf8' });

  if (result.status === 0) {
    return;
  }

  const details = redactSecrets(
    normalizeToken(result.stderr || result.stdout || result.error?.message || 'No system error details.')
  );

  throw new Error(
    `macOS Keychain save failed (exit ${result.status ?? 'unknown'}): ${details}. If this is a headless or sandboxed agent session, allow Keychain access, use ${ENV_KEY}, or explicitly approve shared file fallback with --shared-file.`
  );
};

// Each platform delete helper returns true when its work succeeded
// (including the wrong-platform no-op case) and false when a real
// backend failure was surfaced to stderr. `deleteFromOsStore`
// aggregates the three results.
const deleteFromMacKeychain = () => {
  if (platform() !== 'darwin') {
    return true;
  }
  try {
    execFileSync('/usr/bin/security', [
      'delete-generic-password',
      '-a',
      ACCOUNT,
      '-s',
      SERVICE,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    return true;
  } catch (error) {
    return surfaceKeystoreDeleteFailure('macOS Keychain', error);
  }
};

const getFromLinuxSecretService = () => {
  if (platform() !== 'linux' || !commandExists('secret-tool')) {
    return null;
  }

  try {
    return normalizeToken(
      execFileSync('secret-tool', [
        'lookup',
        'service',
        SERVICE,
        'account',
        ACCOUNT,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    );
  } catch (error) {
    surfaceKeystoreReadFailure('Linux Secret Service', error);
    return null;
  }
};

const saveToLinuxSecretService = (token) => {
  if (!commandExists('secret-tool')) {
    throw new Error(`secret-tool is not installed. Use ${ENV_KEY} or --shared-file.`);
  }

  execFileSync('secret-tool', [
    'store',
    '--label',
    'WorkorAI MCP key',
    'service',
    SERVICE,
    'account',
    ACCOUNT,
  ], { input: token, stdio: ['pipe', 'ignore', 'ignore'] });
};

const deleteFromLinuxSecretService = () => {
  if (platform() !== 'linux' || !commandExists('secret-tool')) {
    return true;
  }

  try {
    execFileSync('secret-tool', [
      'clear',
      'service',
      SERVICE,
      'account',
      ACCOUNT,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    return true;
  } catch (error) {
    return surfaceKeystoreDeleteFailure('Linux Secret Service', error);
  }
};

const findPowerShell = () => {
  if (platform() !== 'win32') {
    return null;
  }

  if (commandExists('pwsh')) {
    return 'pwsh';
  }

  if (commandExists('powershell')) {
    return 'powershell';
  }

  return null;
};

// PowerShell SecretManagement keys on a single Name; unlike macOS
// Keychain and Linux Secret Service it does NOT expose a separate
// "account" attribute. Embed the role in the secret name itself so
// candidate and employer keys do not collide on the same Windows host.
const powerShellSecretName = () => `${SERVICE}-${ACCOUNT}`;

const getFromPowerShellSecretManagement = () => {
  const powerShell = findPowerShell();

  if (!powerShell) {
    return null;
  }

  try {
    return normalizeToken(
      execFileSync(powerShell, [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Get-Secret -Name '${powerShellSecretName()}' -AsPlainText -ErrorAction Stop`,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    );
  } catch (error) {
    // Differentiate "secret not present" (normal — fall through to the
    // next backend) from any other failure (vault locked, module not
    // installed, dismissed prompt). The latter is silenced today; log
    // the redacted detail so users have a chance to see why the read
    // missed.
    surfaceKeystoreReadFailure('PowerShell SecretManagement', error);
    return null;
  }
};

const saveToPowerShellSecretManagement = (token) => {
  const powerShell = findPowerShell();

  if (!powerShell) {
    throw new Error(`PowerShell is not available. Use ${ENV_KEY} or --shared-file.`);
  }

  const result = spawnSync(powerShell, [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `$secret = ConvertTo-SecureString -String $env:WORKORAI_SECRET_INPUT -AsPlainText -Force; Set-Secret -Name '${powerShellSecretName()}' -Secret $secret`,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      WORKORAI_SECRET_INPUT: token,
    },
  });

  if (result.status === 0) {
    return;
  }

  const details = redactSecrets(
    normalizeToken(result.stderr || result.stdout || result.error?.message || 'No system error details.')
  );

  throw new Error(`PowerShell SecretManagement save failed (exit ${result.status ?? 'unknown'}): ${details}`);
};

const removePowerShellSecretManagement = () => {
  if (platform() !== 'win32') {
    return true;
  }

  const powerShell = findPowerShell();
  if (!powerShell) {
    return true;
  }

  try {
    execFileSync(powerShell, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Remove-Secret -Name '${powerShellSecretName()}' -ErrorAction SilentlyContinue`,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    return true;
  } catch (error) {
    return surfaceKeystoreDeleteFailure('PowerShell SecretManagement', error);
  }
};

const tryGetFromOsStore = () => {
  if (OS_KEYSTORE_DISABLED) {
    return null;
  }

  const token =
    getFromMacKeychain() ??
    getFromLinuxSecretService() ??
    getFromPowerShellSecretManagement();

  if (!token) {
    return null;
  }

  assertValidToken(token);
  return token;
};

const readTokenFile = (filePath) => {
  if (!existsSync(filePath)) {
    return null;
  }

  const fileMode = statSync(filePath).mode & 0o777;

  if (platform() !== 'win32' && fileMode !== 0o600) {
    throw new Error(`${filePath} must have 0600 permissions.`);
  }

  const token = normalizeToken(readFileSync(filePath, 'utf8'));
  assertValidToken(token);
  return token;
};

const saveTokenFile = (filePath, token) => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${token}\n`, { mode: 0o600 });

  if (platform() !== 'win32') {
    chmodSync(filePath, 0o600);
  }

  return filePath;
};

const deleteTokenFile = (filePath) => {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
};

const saveToOsStore = (token) => {
  // Test hook: when BOTH `WORKORAI_DISABLE_OS_KEYSTORE=1` AND
  // `WORKORAI_TEST_FAKE_KEYSTORE_ERROR=<text>` are set, throw an
  // error carrying that message. Gating on the disable env var means
  // the hook is unreachable in any production context where the user
  // hasn't already opted into test-isolation mode — a wrapper that
  // forgets to set DISABLE_OS_KEYSTORE cannot force a fake error.
  // Lets the role-test suite exercise the `handleSave` catch path
  // with a token-bearing message and assert the redaction contract.
  if (OS_KEYSTORE_DISABLED) {
    const fakeError = process.env.WORKORAI_TEST_FAKE_KEYSTORE_ERROR;
    if (fakeError) {
      throw new Error(fakeError);
    }
    throw new Error(
      `OS keystore disabled via WORKORAI_DISABLE_OS_KEYSTORE. Use ${ENV_KEY} or --shared-file.`,
    );
  }

  if (platform() === 'darwin') {
    saveToMacKeychain(token);
    return 'macOS Keychain';
  }

  if (platform() === 'linux') {
    saveToLinuxSecretService(token);
    return 'Secret Service';
  }

  if (platform() === 'win32') {
    saveToPowerShellSecretManagement(token);
    return 'PowerShell SecretManagement';
  }

  throw new Error(`No OS secret store backend for ${platform()}. Use ${ENV_KEY} or --shared-file.`);
};

const deleteFromOsStore = () => {
  if (OS_KEYSTORE_DISABLED) {
    // Test hook (gated identically to WORKORAI_TEST_FAKE_KEYSTORE_ERROR):
    // simulate the aggregated-failure path so the C1 contract
    // (handleDelete must exit 1 on a real keystore delete failure)
    // can be tested without spinning up an actual keystore. Emits
    // the same stderr line surfaceKeystoreDeleteFailure would.
    if (process.env.WORKORAI_TEST_FAKE_DELETE_FAILURE === '1') {
      process.stderr.write(
        'credential-store: macOS Keychain delete failed: simulated keystore failure\n',
      );
      return false;
    }
    return true;
  }
  // Run all three; only the current platform's helper does real work,
  // the other two short-circuit to `true`. Aggregate so a real backend
  // failure on the active platform propagates to the exit code.
  const macOk = deleteFromMacKeychain();
  const linuxOk = deleteFromLinuxSecretService();
  const winOk = removePowerShellSecretManagement();
  return macOk && linuxOk && winOk;
};

// Surface the test-isolation kill-switch when the user has it set.
// Silent skip of the OS keystore mid-production is a debugging trap
// (the user thinks their keychain is being consulted; it isn't).
// Emitted once per CLI invocation, only on a command that actually
// would touch the keystore.
const warnIfKeystoreDisabled = (command) => {
  if (!OS_KEYSTORE_DISABLED) return;
  if (command !== 'get' && command !== 'save' && command !== 'delete') return;
  process.stderr.write(
    'credential-store: WORKORAI_DISABLE_OS_KEYSTORE=1 — OS secret store ' +
      'bypassed (test-isolation mode). Unset to use the system keychain.\n',
  );
};

const handleGet = () => {
  warnIfKeystoreDisabled('get');
  const fromEnv = tryGetFromEnv();
  if (fromEnv) {
    process.stdout.write(`${fromEnv}\n`);
    return;
  }
  const fromOs = tryGetFromOsStore();
  if (fromOs) {
    process.stdout.write(`${fromOs}\n`);
    return;
  }

  // If the OS keystore read surfaced a real backend error (not a plain
  // "no entry" miss), the shared file is a potentially-stale fallback:
  // the keystore may carry a newer token that the file hasn't seen.
  // Make that explicit so the user can debug an auth failure that
  // would otherwise look like "I just saved the key, why doesn't it
  // work" — see silent-failure HIGH F3.
  const fromFile = readTokenFile(SHARED_FILE_PATH);
  if (!fromFile) {
    process.exit(1);
  }

  if (osStoreReadErrorSurfaced) {
    process.stderr.write(
      'credential-store: returning shared-file fallback token because the ' +
        'OS keystore read errored above. Re-run `save` if authentication ' +
        'against WorkorAI MCP fails.\n',
    );
  }

  process.stdout.write(`${fromFile}\n`);
};

const handleSave = async () => {
  // Only warn when the OS keystore is actually about to be touched.
  // `--shared-file` short-circuits to the file fallback, so the
  // disable env var is irrelevant — the warning would just train
  // users to ignore credential-store stderr noise.
  if (!args.includes('--shared-file')) warnIfKeystoreDisabled('save');
  const token = await readTokenForSave();

  if (args.includes('--shared-file')) {
    const path = saveTokenFile(SHARED_FILE_PATH, token);
    console.error(`Saved WorkorAI MCP key to shared file fallback at ${path}`);
    return;
  }

  try {
    const backend = saveToOsStore(token);
    console.error(`Saved WorkorAI MCP key to ${backend}`);

    if (args.includes('--best-effort')) {
      const path = saveTokenFile(SHARED_FILE_PATH, token);
      console.error(`Mirrored WorkorAI MCP key to shared file fallback at ${path}`);
    }
  } catch (error) {
    if (!args.includes('--best-effort')) {
      throw error;
    }

    const path = saveTokenFile(SHARED_FILE_PATH, token);
    const details = redactSecrets(error instanceof Error ? error.message : String(error));

    console.error(`OS secret store unavailable: ${details}`);
    console.error(`Saved WorkorAI MCP key to shared file fallback at ${path}`);
  }
};

const handleDelete = () => {
  if (!args.includes('--shared-file')) warnIfKeystoreDisabled('delete');
  if (args.includes('--shared-file')) {
    deleteTokenFile(SHARED_FILE_PATH);
    return;
  }

  const ok = deleteFromOsStore();
  if (!ok) {
    process.stderr.write(
      'credential-store: delete reported failures on the OS keystore. The ' +
        'entry may still be present in the keychain/vault. Re-run with ' +
        '--shared-file to clear the file fallback explicitly, or resolve ' +
        'the keystore error reported above before retrying.\n',
    );
    process.exit(1);
  }
};

try {
  if (command === 'get') {
    handleGet();
  } else if (command === 'save') {
    await handleSave();
  } else if (command === 'delete') {
    handleDelete();
  } else {
    usage();
    process.exit(2);
  }
} catch (error) {
  console.error(redactSecrets(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}

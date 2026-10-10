'use strict';

const chalk = require('chalk');

const provider = require('./providers/orcarouter');
const { CredentialStore } = require('./providers/orcarouter/credential-store');
const { apiKeySource, pkceSource, FLOWS } = require('./providers/orcarouter/credential-sources');
const { redactSecret, safeError } = require('./providers/orcarouter/redact');
const {
  CONSOLE_KEYS_URL,
  CONSOLE_AUTHORIZED_APPS_URL,
  KEY_PREFIX,
  ERROR_CODES,
} = require('./providers/orcarouter/constants');

/**
 * OrcaRouter commands for the CLI.
 *
 * Two explicit, independently usable ways in:
 *
 *   --orcarouter-api-key <key>   paste an existing sk-orca-… key   ("OrcaRouter - API")
 *   --orcarouter-connect         OAuth 2.0 + PKCE sign-in          ("OrcaRouter - Auth")
 *
 * plus status, model listing, and logout. Every one of them goes through the same
 * credential store, so downstream code never sees which entry point was used.
 */

const FLOW_LABELS = {
  [FLOWS.loopback]: 'OAuth 2.0 + PKCE (loopback redirect, Flow A)',
  [FLOWS.oob]: 'OAuth 2.0 + PKCE (out-of-band code, Flow B)',
  [FLOWS.device]: 'OAuth 2.0 device grant (Flow C)',
};

function printUrl(url) {
  console.log('');
  console.log(chalk.cyan('Open this URL to authorize OrcaRouter:'));
  console.log(chalk.underline(url));
  console.log('');
}

function printDeviceInstructions(info) {
  console.log('');
  if (info.verificationUriComplete) {
    console.log(chalk.cyan('Open this on any device — the code is already filled in:'));
    console.log(chalk.underline(info.verificationUriComplete));
  } else {
    console.log(chalk.cyan(`Open ${info.verificationUri} and enter the code: ${info.userCode}`));
  }
  console.log(chalk.gray(`The code expires in ${Math.round(info.expiresIn / 60)} minutes.`));
  console.log('');
}

function makePrompts() {
  // @clack/prompts is already a CLI dependency; requiring it lazily keeps the
  // non-interactive paths (CI, --orcarouter-status) free of TTY assumptions.
  const clack = require('@clack/prompts');
  return {
    showUrl: printUrl,
    showDeviceInstructions: printDeviceInstructions,
    async askForKey({ message }) {
      const answer = await clack.password({ message });
      if (clack.isCancel(answer)) return null;
      return typeof answer === 'string' ? answer.trim() : '';
    },
    async askForCode() {
      const answer = await clack.text({
        message: 'Paste the authorization code shown in your browser',
        placeholder: 'code',
      });
      if (clack.isCancel(answer)) return null;
      return typeof answer === 'string' ? answer.trim() : '';
    },
    warnScope({ requested, granted, missing }) {
      console.log(
        chalk.yellow(
          `Note: OrcaRouter granted scope "${granted}" instead of "${requested}"` +
            (missing && missing.length ? ` (missing: ${missing.join(', ')})` : '') +
            '. The stored key is usable for inference.'
        )
      );
    },
  };
}

async function openBrowser(url) {
  try {
    const open = require('open');
    await open(url, { wait: false });
  } catch (error) {
    // The URL has already been printed; a missing browser is not fatal.
    console.log(chalk.gray(`(Could not open a browser automatically: ${error.message})`));
  }
}

function makeStore(options = {}) {
  return new CredentialStore({
    env: options.env || process.env,
    filePath: options.credentialFile,
  });
}

function describeCredential(record, sourceLabel) {
  const lines = [
    `  Provider:     OrcaRouter (${provider.PROVIDER_ID})`,
    `  How:          ${sourceLabel}`,
    `  Key:          ${redactSecret(record.key)}`,
    `  Account:      ${record.account}`,
    `  Scope:        ${record.scope}`,
  ];
  return lines.join('\n');
}

/**
 * Write the OrcaRouter selection into the project's .claude/settings.json so
 * Claude Code routes through the gateway. The key itself is never written to
 * settings.json; it stays in the credential store and is injected into the
 * child process environment.
 */
function applyProjectSettings(options, record) {
  const targetDir = options.directory || process.cwd();
  const settingsPath = provider.claudeSettingsPath(targetDir);
  const settings = {
    env: {
      ANTHROPIC_BASE_URL: provider.getStatus({ env: options.env }).anthropicBaseUrl,
    },
  };
  if (options.dryRun) {
    console.log(chalk.gray(`Would update ${settingsPath}:`));
    console.log(JSON.stringify(settings, null, 2));
    return settingsPath;
  }
  provider.writeProjectSettings({ targetDir, settings });
  console.log(chalk.gray(`Updated ${settingsPath} to route Claude Code through OrcaRouter.`));
  console.log(
    chalk.gray(
      'The credential is kept in the local OrcaRouter credential store, not in settings.json.'
    )
  );
  if (record) {
    console.log(
      chalk.gray(
        'Run Claude Code with the OrcaRouter credential injected, or install the ' +
          '`partnerships/orcarouter` setting for a static env preset.'
      )
    );
  }
  return settingsPath;
}

async function runConnect(options) {
  const store = makeStore(options);
  const prompts = options.prompts || makePrompts();

  const existing = store.load().credential;
  if (existing && !existing.needsReauth && !options.force) {
    console.log(
      chalk.green(
        `An OrcaRouter credential is already stored (${redactSecret(existing.key)}, ` +
          `method: ${existing.method}). Reusing it instead of issuing a new PKCE key — ` +
          'a user may issue at most 10 per 24 hours. Pass --force to authorize again.'
      )
    );
    return existing;
  }

  let flow = FLOWS.loopback;
  if (options.orcarouterNoBrowser || options.noBrowser) flow = FLOWS.oob;
  if (options.orcarouterDevice || options.device) flow = FLOWS.device;
  if (!options.prompts && flow === FLOWS.loopback && !process.stdout.isTTY) {
    // No terminal to click in: fall back to a flow that works headless.
    flow = FLOWS.oob;
  }

  console.log(chalk.cyan(`Connecting to OrcaRouter — ${FLOW_LABELS[flow]}`));
  const result = await pkceSource.acquire({
    store,
    flow,
    prompts,
    env: options.env,
    openBrowser,
    appName: 'Claude Code Templates',
    timeoutMs: options.timeoutMs,
  });

  console.log(chalk.green('\nConnected.'));
  console.log(describeCredential(result.credential, `OrcaRouter - Auth (${flow})`));
  console.log(
    chalk.gray(
      `The key is durable: it is reused on every run until you revoke it at ${CONSOLE_AUTHORIZED_APPS_URL}.`
    )
  );
  return result.credential;
}

async function runApiKey(options) {
  const store = makeStore(options);
  const prompts = options.prompts || makePrompts();
  const key = options.apiKey !== undefined ? options.apiKey : null;
  const result = await apiKeySource.acquire({ store, apiKey: key, prompts });
  console.log(chalk.green('\nOrcaRouter API key stored.'));
  console.log(describeCredential(result.credential, 'OrcaRouter - API'));
  console.log(
    chalk.gray(
      `Manage or revoke this key at ${CONSOLE_KEYS_URL}. Update it by running this again; ` +
        'clear it with --orcarouter-logout.'
    )
  );
  return result.credential;
}

async function runStatus(options) {
  const status = provider.getStatus({
    store: makeStore(options),
    env: options.env,
  });
  console.log(chalk.bold('\nOrcaRouter provider\n'));
  console.log(`  Registered as: ${status.name} (${status.provider})`);
  console.log('  Authentication options:');
  for (const source of status.sources) {
    console.log(`    - ${source.label}  [${source.kind === 'api_key' ? 'API key' : 'OAuth 2.0 + PKCE'}]`);
  }
  console.log(`  Inference (OpenAI-compatible): ${status.apiBaseUrl}`);
  console.log(`  Inference (Anthropic wire):    ${status.anthropicBaseUrl}`);
  console.log(`  Authorization origin:          ${status.authBaseUrl}`);
  console.log('\n  Credential:');
  if (!status.credential.configured) {
    console.log('    not configured — use --orcarouter-api-key or --orcarouter-connect');
  } else {
    console.log(`    method:      ${status.credential.method}`);
    console.log(`    account:     ${status.credential.account}`);
    console.log(`    key:         ${status.credential.maskedKey}`);
    console.log(`    scope:       ${status.credential.scope}`);
    console.log(`    source:      ${status.credential.source}`);
    console.log(`    generation:  ${status.credential.generation}`);
    if (status.credential.needsReauth) {
      console.log(
        chalk.yellow(
          '    status:      rejected by the gateway — run --orcarouter-connect or store a new key'
        )
      );
    }
  }

  const catalog = await provider.getModelOptions(
    { capability: 'chat' },
    { store: makeStore(options), env: options.env }
  );
  console.log('\n  Model catalog:');
  console.log(`    source:      ${catalog.source}${catalog.degraded ? ' (DEGRADED)' : ''}`);
  console.log(`    endpoint:    ${catalog.catalogUrl}`);
  console.log(`    chat models: ${catalog.count}`);
  if (catalog.degraded && catalog.message) {
    console.log(chalk.yellow(`    reason:      ${catalog.message}`));
  }
}

const CAPABILITY_CHOICES = [
  'chat',
  'chat+image',
  'chat+audio',
  'chat+video',
  'embedding',
  'image',
  'video',
  'rerank',
];

function parseCapability(value) {
  if (!value || value === true) return { capability: 'chat', extraModalities: [] };
  const raw = String(value).trim().toLowerCase();
  if (CAPABILITY_CHOICES.includes(raw)) {
    if (raw.startsWith('chat+')) {
      return { capability: 'chat', extraModalities: raw.split('+').slice(1) };
    }
    return { capability: raw, extraModalities: [] };
  }
  throw safeError(
    `Unknown capability "${value}". Choose one of: ${CAPABILITY_CHOICES.join(', ')}`,
    { code: ERROR_CODES.unsupportedFlow }
  );
}

async function runModels(options) {
  const { capability, extraModalities } = parseCapability(options.orcarouterModels);
  const result = await provider.getModelOptions(
    { capability, extraModalities },
    { store: makeStore(options), env: options.env }
  );

  const heading = extraModalities.length
    ? `${capability} + ${extraModalities.join(' + ')} input`
    : capability;
  console.log(chalk.bold(`\nOrcaRouter models for ${heading}\n`));
  console.log(`  Catalog: ${result.catalogUrl}`);
  console.log(
    `  Source:  ${result.source}${result.degraded ? chalk.yellow(' (degraded — verified fallback)') : ''}`
  );
  if (result.degraded && result.message) console.log(chalk.yellow(`  Reason:  ${result.message}`));
  console.log('');

  if (result.count === 0) {
    console.log(
      chalk.yellow(
        `  No models in this catalog advertise the "${heading}" capability. ` +
          'The gateway only exposes what its metadata declares, so nothing is listed rather ' +
          'than showing models that cannot serve this input.'
      )
    );
    return result;
  }
  for (const model of result.options) {
    const ctx = model.context_length ? `${Math.round(model.context_length / 1000)}k ctx` : 'ctx n/a';
    const modalities = model.input_modalities.length ? model.input_modalities.join(', ') : 'text';
    const verified = model.verified ? ' [verified fallback]' : '';
    console.log(`  ${model.id}`);
    console.log(chalk.gray(`      ${model.label} — ${ctx} — input: ${modalities}${verified}`));
  }
  console.log('');
}

function runLogout(options) {
  const store = makeStore(options);
  const removed = store.clear();
  if (removed) {
    console.log(chalk.green('Stored OrcaRouter credential removed.'));
  } else {
    console.log(chalk.gray('No stored OrcaRouter credential to remove.'));
  }
  if (options.env && options.env.ORCAROUTER_API_KEY) {
    console.log(
      chalk.gray(
        'ORCAROUTER_API_KEY is still set in the environment; unset it to fully sign out.'
      )
    );
  }
  return removed;
}

/**
 * Dispatch the OrcaRouter flags. Returns true when one of them was handled.
 */
async function runOrcaRouterCommand(options = {}) {
  const wantsConnect = !!options.orcarouterConnect;
  const wantsApiKey = options.orcarouterApiKey !== undefined && options.orcarouterApiKey !== null;
  const wantsStatus = !!options.orcarouterStatus;
  const wantsModels = options.orcarouterModels !== undefined && options.orcarouterModels !== null;
  const wantsLogout = !!options.orcarouterLogout;

  if (!wantsConnect && !wantsApiKey && !wantsStatus && !wantsModels && !wantsLogout) return false;

  options.orcarouterNoBrowser = options.orcarouterNoBrowser || options.orcarouterFlow === 'oob';
  options.orcarouterDevice = options.orcarouterFlow === 'device';

  try {
    if (wantsLogout) {
      runLogout(options);
      return true;
    }
    if (wantsStatus) {
      await runStatus(options);
      return true;
    }
    if (wantsModels) {
      await runModels(options);
      return true;
    }
    if (wantsApiKey) {
      const record = await runApiKey(options);
      applyProjectSettings(options, record);
      return true;
    }
    const record = await runConnect(options);
    applyProjectSettings(options, record);
    return true;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error(chalk.red(`OrcaRouter: ${message}`));
    if (error && error.code === ERROR_CODES.needsReauth) {
      console.error(
        chalk.gray(
          `The stored key was rejected. Reauthorize with --orcarouter-connect, or store a new ` +
            `key with --orcarouter-api-key. Review authorized apps at ${CONSOLE_AUTHORIZED_APPS_URL}.`
        )
      );
    }
    if (error && error.code === ERROR_CODES.invalidKey) {
      console.error(chalk.gray(`Keys start with ${KEY_PREFIX} and are created at ${CONSOLE_KEYS_URL}.`));
    }
    process.exitCode = 1;
    return true;
  }
}

module.exports = {
  runOrcaRouterCommand,
  runConnect,
  runApiKey,
  runStatus,
  runModels,
  runLogout,
  parseCapability,
  CAPABILITY_CHOICES,
  // exported for tests that want the same seams without a TTY
  makePrompts,
  makeStore,
  applyProjectSettings,
};

'use strict';

/**
 * Shared secret redaction.
 *
 * Every credential leaving this module passes through `redactSecret` (for
 * human-readable output) or `redactDeep` (for structured payloads) before it is
 * logged, thrown, or written. Errors are built with `safeError`, which strips
 * any occurrence of a known secret from the message.
 */

const MASK = '***';
const MIN_PROBED_LENGTH = 8;

const SECRET_PATTERNS = [
  /sk-orca-[A-Za-z0-9._-]+/g,
  /sk-ant-[A-Za-z0-9._-]+/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /\beyJ[A-Za-z0-9._-]{20,}\b/g,
];

const SECRET_KEY_NAMES = new Set([
  'key',
  'apikey',
  'api_key',
  'token',
  'access_token',
  'auth_token',
  'authorization',
  'code_verifier',
  'codeverifier',
  'verifier',
  'device_code',
  'devicecode',
  'client_secret',
  'secret',
  'password',
  'credential',
]);

function isSecretKey(name) {
  const normalized = String(name).toLowerCase().replace(/[-_]/g, '');
  if (SECRET_KEY_NAMES.has(String(name).toLowerCase())) return true;
  if (SECRET_KEY_NAMES.has(normalized)) return true;
  return /(apikey|secret|token|password|credential)/.test(normalized);
}

/**
 * Mask a secret for display. Keeps a short, non-identifying tail so a user can
 * tell two keys apart, never enough to reconstruct the key.
 *
 * @param {unknown} value
 * @param {{keep?: number}} [options]
 * @returns {string}
 */
function redactSecret(value, options = {}) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.length === 0) return '';
  const keep = options.keep || 4;
  if (text.length <= MIN_PROBED_LENGTH) return MASK;
  return `${MASK}${text.slice(-keep)}`;
}

/**
 * Remove anything that looks like a secret from free text, including secrets
 * this process never held (a key echoed back by an error body, for example).
 *
 * @param {string} text
 * @param {string[]} [known]
 * @returns {string}
 */
function scrub(text, known = []) {
  let out = String(text === null || text === undefined ? '' : text);
  // Known secrets include values that do not match any pattern at all — a PKCE
  // verifier or a state token — so they are masked by value, not by shape.
  for (const secret of known) {
    if (secret && String(secret).length >= MIN_PROBED_LENGTH) {
      out = out.split(String(secret)).join(MASK);
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, MASK);
  }
  return out;
}

/**
 * Recursively redact a structured value. Secret-looking keys are masked
 * wholesale; everything else is scrubbed for key shapes.
 *
 * @param {unknown} value
 * @param {string[]} [known]
 * @returns {unknown}
 */
function redactDeep(value, known = []) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrub(value, known);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, known));

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (isSecretKey(key)) {
      out[key] = item ? MASK : item;
    } else {
      out[key] = redactDeep(item, known);
    }
  }
  return out;
}

/**
 * Build an Error whose message is safe to print. `known` is the list of
 * secrets that must never survive into the message.
 *
 * @param {string|Error} message
 * @param {{code?: string, details?: object, known?: string[], status?: number}} [options]
 * @returns {Error}
 */
function safeError(message, options = {}) {
  const raw = message instanceof Error ? message.message : String(message);
  const error = new Error(scrub(raw, options.known));
  error.name = 'OrcaRouterError';
  if (options.code) error.code = options.code;
  if (options.status) error.status = options.status;
  if (options.details) error.details = redactDeep(options.details, options.known);
  return error;
}

/** True when a value would leak through the redactors untouched. */
function containsSecret(text, secrets) {
  if (!text) return false;
  return secrets.some((secret) => secret && String(text).includes(String(secret)));
}

module.exports = {
  MASK,
  isSecretKey,
  redactSecret,
  redactDeep,
  scrub,
  safeError,
  containsSecret,
};

#!/usr/bin/env node
// Checks a Claude Platform OAuth setup step by step, with the same values the backend uses.
// Node 18+, no dependencies. Reads configuration from environment variables only and never
// prints the private key, the operator token or refresh tokens.
//
//   CPO_SIGNING_KEY_FILE     path to the PKCS#8 PEM private key (or CPO_SIGNING_KEY_PEM with its content)
//   CPO_KID                  key id registered in the issuer's inline JWKS
//   CPO_ISSUER               issuer URL registered in Console (the "iss" claim)
//   CPO_OPERATOR_SUBJECT     subject of the operator federation rule
//   CPO_ORGANIZATION_ID      organization that owns the app
//   CPO_SERVICE_ACCOUNT_ID   operator service account (svac_...)
//   CPO_OPERATOR_RULE_ID     operator federation rule (fdrl_...)
//   CPO_CLIENT_ID            OAuth app client id (clid_...)          for: link, exchange
//   CPO_CLIENT_SUBJECT       subject of the client rule               for: link, exchange
//   CPO_REDIRECT_URI         a registered redirect URI                for: link, exchange
//   CPO_MODEL                model for the billed check (default claude-haiku-5-5; set it if that id is rejected)
//
// Commands:
//   operator                 get an operator token (proves key, issuer and operator rule)
//   profile [name]           create a user profile and print its id
//   link <uprof_...>         push an authorization request and print the URL to open
//   exchange <code>          exchange the code from the redirect (within 5 minutes of approval)
//   bill <uprof_...>         make a tiny billed call: 403 before linking, 200 after
import { createPrivateKey, randomBytes, randomUUID, sign, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const AUTH = 'https://auth.claude.com';
const API = 'https://api.anthropic.com';
const VERSION = '2026-10-21';
const BETA = 'user-profiles-billing-2026-10-01';
const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
// PKCE verifier between "link" and "exchange": a per-user directory, not a shared temp path.
const PENDING_DIR = join(homedir(), '.cache', 'platform-oauth-linked-billing');
const PENDING = join(PENDING_DIR, 'pending.json');

const env = (name, required = true) => {
  const v = process.env[name];
  if (!v && required) fail('Missing environment variable ' + name);
  return v;
};
function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function privateKey() {
  const pem = process.env.CPO_SIGNING_KEY_PEM || (process.env.CPO_SIGNING_KEY_FILE && readFileSync(process.env.CPO_SIGNING_KEY_FILE, 'utf8'));
  if (!pem) fail('Set CPO_SIGNING_KEY_FILE or CPO_SIGNING_KEY_PEM');
  return createPrivateKey(pem);
}

function assertion(sub, aud) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: env('CPO_KID'), typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: env('CPO_ISSUER'), sub, aud, iat: now, exp: now + 300, jti: randomUUID() }));
  // ieee-p1363 = raw r||s, the form JWS requires. Node's default DER fails with jwt_signature_invalid.
  const sig = sign('sha256', Buffer.from(header + '.' + payload), { key: privateKey(), dsaEncoding: 'ieee-p1363' });
  return header + '.' + payload + '.' + b64url(sig);
}

async function post(url, body, headers = {}) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, data, text };
}

const errorOf = (r) => r.data?.error?.type || r.data?.error || 'HTTP ' + r.status;
const detailOf = (r) => r.data?.error?.message || r.data?.error_description || r.text.slice(0, 300);

async function operatorToken() {
  const r = await post(API + '/v1/oauth/token', {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: assertion(env('CPO_OPERATOR_SUBJECT'), API),
    federation_rule_id: env('CPO_OPERATOR_RULE_ID'),
    organization_id: env('CPO_ORGANIZATION_ID'),
    service_account_id: env('CPO_SERVICE_ACCOUNT_ID'),
  });
  if (r.status !== 200 || !r.data?.access_token) fail('operator token: ' + r.status + ' ' + (errorOf(r)) + ': ' + (detailOf(r)));
  return { token: r.data.access_token, expiresIn: r.data.expires_in };
}

const clientAssertion = () => ({ client_assertion_type: ASSERTION_TYPE, client_assertion: assertion(env('CPO_CLIENT_SUBJECT'), AUTH) });

const [cmd, arg] = process.argv.slice(2);

if (cmd === 'operator') {
  const { expiresIn } = await operatorToken();
  console.log('✓ operator token issued (expires in ' + expiresIn + 's). Key, issuer, operator rule and service account match.');
} else if (cmd === 'profile') {
  const { token } = await operatorToken();
  const ref = createHash('sha256').update(randomBytes(16)).digest('hex').slice(0, 32);
  const r = await post(API + '/v1/user_profiles', { name: arg || 'Test customer', external_user_details: { reference_id: ref } }, {
    authorization: 'Bearer ' + token,
    'anthropic-version': VERSION,
  });
  if (r.status >= 300 || !r.data?.id) fail('user profile: ' + r.status + ' ' + (errorOf(r)) + ': ' + (detailOf(r)));
  console.log('✓ user profile created: ' + r.data.id);
} else if (cmd === 'link') {
  if (!arg?.startsWith('uprof_')) fail('Usage: link <uprof_...>');
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(24));
  const r = await post(AUTH + '/v1/oauth/par', {
    response_type: 'code',
    client_id: env('CPO_CLIENT_ID'),
    redirect_uri: env('CPO_REDIRECT_URI'),
    scope: 'billing:attribution offline_access',
    connection_type: 'organization_shared',
    connection_auth_target: 'platform',
    user_profile_id: arg,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...clientAssertion(),
  });
  if (r.status >= 300 || !r.data?.request_uri) fail('PAR: ' + r.status + ' ' + (errorOf(r)) + ': ' + (detailOf(r)));
  mkdirSync(PENDING_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(PENDING, JSON.stringify({ verifier, state, at: Date.now() }), { mode: 0o600 });
  const url = new URL(AUTH + '/oauth/authorize');
  url.searchParams.set('client_id', env('CPO_CLIENT_ID'));
  url.searchParams.set('request_uri', r.data.request_uri);
  console.log('✓ PAR accepted. Open this URL signed in as the test customer (valid 10 minutes):');
  console.log(url.toString());
  console.log('After approving, copy "code" from the redirect and run: exchange <code> (state should be ' + state + ')');
} else if (cmd === 'exchange') {
  if (!arg) fail('Usage: exchange <code>');
  if (!existsSync(PENDING)) fail('No pending link. Run "link <uprof_...>" first.');
  const { verifier, at } = JSON.parse(readFileSync(PENDING, 'utf8'));
  if (Date.now() - at > 15 * 60_000) { unlinkSync(PENDING); fail('The pending link is older than 15 minutes. Run "link" again.'); }
  const r = await post(AUTH + '/v1/oauth/token', {
    grant_type: 'authorization_code',
    code: arg,
    code_verifier: verifier,
    redirect_uri: env('CPO_REDIRECT_URI'),
    client_id: env('CPO_CLIENT_ID'),
    ...clientAssertion(),
  });
  unlinkSync(PENDING);
  if (r.status !== 200) fail('code exchange: ' + r.status + ' ' + (errorOf(r)) + ': ' + (detailOf(r)));
  // Tokens are deliberately not printed or saved: this is only a check.
  console.log('✓ linked: connection ' + r.data.connection_id + ', scope "' + r.data.scope + '", refresh token ' + (r.data.refresh_token ? 'issued' : 'NOT issued (is offline_access on?)'));
} else if (cmd === 'bill') {
  if (!arg?.startsWith('uprof_')) fail('Usage: bill <uprof_...>');
  const { token } = await operatorToken();
  const r = await post(API + '/v1/messages', {
    model: process.env.CPO_MODEL || 'claude-haiku-5-5',
    max_tokens: 16,
    messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    billing_policy: { type: 'billing_policy', bill_to: 'user_profile' },
  }, {
    authorization: 'Bearer ' + token,
    'anthropic-version': VERSION,
    'anthropic-beta': BETA,
    'anthropic-user-profile-id': arg,
  });
  if (r.status === 200) console.log('✓ billed call returned 200 (model ' + r.data.model + '). Check the usage in the customer\'s organization.');
  else if (r.status === 403 && r.text.includes('user_profile_billing_not_authorized')) console.log('• 403 user_profile_billing_not_authorized: this profile has not linked (expected before approval).');
  else if (r.status === 403 && r.text.includes('user_profile_not_billable')) fail('403 user_profile_not_billable: that organization has no API billing (Claude.ai plans cannot be linked).');
  else fail('billed call: ' + r.status + ' ' + (errorOf(r)) + ': ' + (detailOf(r)));
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  console.log('Commands: operator | profile [name] | link <uprof_...> | exchange <code> | bill <uprof_...>');
  process.exit(cmd ? 1 : 0);
}

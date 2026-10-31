// Defaults, user overrides and validation. Pure: callers pass env and the parsed user file.

export const TIERS = ['micro', 'low', 'medium', 'high'];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const DEFAULTS = {
  baselineTier: 'low',
  // Haiku 5.5 is the worker at `low` and `micro`: at high effort it scored above Sonnet 5.5 at low, and at xhigh near
  // Sonnet at medium, for a fraction of the cost per attempt (Anthropic's OSWorld 2.1 effort chart: computer use, not
  // coding). Opus 5.5 at medium matched or beat Sonnet 5.5 at xhigh at 25-50% lower cost per task on Terminal-Bench
  // 4.0, FrontierCode v1.1 and CursorBench 4.0 (anthropic.com/claude-sonnet-5-5). `high` is Opus 5.5 at xhigh, the
  // strongest setting this router asks for. These are routing defaults, not a claim of equal model quality.
  routes: {
    high: { model: 'opus', effort: 'xhigh' },
    medium: { model: 'opus', effort: 'medium' },
    low: { model: 'haiku', effort: 'high' },
    micro: { model: 'haiku', effort: 'medium' },
  },
  // `id` selects the native model. List prices in USD per million tokens; `cacheRead` is absolute,
  // not a multiplier (Opus 5.5 reads at 0.05x input, the rest at the standard 0.1x). Haiku 5.5 lists the rates for
  // prompts up to 100k tokens; above that Anthropic charges 5x on input, output and cache read, so estimates run low there. A price change must also change
  // test/fixtures/list-prices.json, with its source and date. `output` feeds the shadow estimate and the downgrade tax.
  // `efforts` lists what the model accepts; an empty list means no effort field and no adaptive thinking. A change
  // must also change test/fixtures/effort-support.json, from a new probe against the real API.
  models: {
    opus: {
      id: 'claude-opus-5-5',
      input: 4,
      output: 20,
      cacheRead: 0.2,
      contextWindow: 1_000_000,
      billing: 'plan',
      efforts: EFFORTS,
    },
    sonnet: {
      id: 'claude-sonnet-5-5',
      input: 2,
      output: 10,
      cacheRead: 0.2,
      contextWindow: 1_000_000,
      billing: 'plan',
      efforts: EFFORTS,
    },
    haiku: {
      id: 'claude-haiku-5-5',
      input: 0.1,
      output: 0.5,
      cacheRead: 0.01,
      contextWindow: 1_000_000,
      billing: 'plan',
      efforts: EFFORTS,
    },
  },
  cache: {
    writeMultiplier: { '5m': 1.25, '1h': 2 },
    ttlMs: { '5m': 300_000, '1h': 3_600_000 },
    warmMarginMs: 30_000,
  },
  policy: {
    upgradeVotes: 2,
    upgradeBase: 0.75,
    upgradeSlope: 0.15,
    upgradePivotUsd: 0.5, // tax at which half the slope applies: $0.20 of tax raises the bar to ~0.79, $4 to ~0.88
    jumpConfidence: 0.95,
    downgradeVotes: 2,
    downgradeMass: 0.9,
    downgradeSlope: 0.08, // a cold candidate raises the bar toward ~0.98, same shape as the upgrade bar
    downgradePivotUsd: 0.5,
    downgradeHorizonTurns: 5, // turns whose output and read savings offset a downgrade's cache write
    continuationMass: 0.7,
    escalationHoldTurns: 2,
    // Ceiling on a cold cache write to a `credits` model. No default model bills credits, so this is
    // inert until a user adds one in router.json; a Claude Code turn starts near 100k tokens.
    cashCapUsd: 2,
  },
  // The active entry of `classifiers`. Each entry speaks the same typed-questions API. `keyOption` names the plugin
  // option that holds the bearer key; a `{name}` in `endpoint` is filled from the plugin option of that name. Both
  // must be in CLASSIFIER_OPTIONS. Cloudflare wraps the answer in `result`; the parser reads both shapes.
  classifier: 'jev',
  classifiers: {
    jev: {
      label: 'Jev',
      endpoint: 'https://api.typesafe.ai/v1/systemone',
      model: 'jev-1.13.0',
      keyOption: 'typesafe_api_key',
      timeoutMs: 1500,
    },
    clef: {
      label: 'Clef',
      endpoint: 'https://api.cloudflare.com/client/v4/accounts/{cloudflare_account_id}/ai/run/@cf/cloudflare/clef',
      model: 'clef',
      keyOption: 'cloudflare_api_token',
      timeoutMs: 3000,
    },
    'clef-flash': {
      label: 'Clef Flash',
      endpoint:
        'https://api.cloudflare.com/client/v4/accounts/{cloudflare_account_id}/ai/run/@cf/cloudflare/clef-flash',
      model: 'clef-flash',
      keyOption: 'cloudflare_api_token',
      timeoutMs: 3000,
    },
  },
  context: { recentTurns: 6, maxTextChars: 1200 },
};

// Keys a route, a model or a classifier entry may carry. The other closed sections take their key sets from DEFAULTS.
const ROUTE_KEYS = ['model', 'effort'];
const MODEL_KEYS = ['id', 'input', 'output', 'cacheRead', 'contextWindow', 'billing', 'efforts'];
const CLASSIFIER_KEYS = ['label', 'endpoint', 'model', 'keyOption', 'timeoutMs'];
// The plugin options a classifier can read, the userConfig fields of plugin.json, with what each holds as the pane
// names it. The engine lets a Mod read only declared options and literally named environment variables, so a
// classifier cannot name a setting of its own.
export const CLASSIFIER_OPTIONS = {
  typesafe_api_key: 'API key',
  cloudflare_api_token: 'API token',
  cloudflare_account_id: 'account ID',
};
const OPTION_NAMES = Object.keys(CLASSIFIER_OPTIONS);
// A JSON file can hold these as own keys; merged into a plain object they reach the prototype chain.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const MIGRATION_HINT =
  'run node scripts/migrate-config.mjs /path/to/router.json from the router plugin directory';

export function loadConfig({ userFile = null } = {}) {
  if (userFile !== null) checkShape(userFile);
  const config = merge(DEFAULTS, userFile ?? {});
  validate(config);
  return config;
}

export function activeClassifier(config) {
  return config.classifiers[config.classifier];
}

// The `{name}` placeholders of an endpoint, in order.
export function endpointSettings(endpoint) {
  return [...endpoint.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map((match) => match[1]);
}

// The router.json `file` with `id` as the active classifier; the default is written as no key at all.
export function withClassifier(file, id) {
  const { classifier: _, ...rest } = file;
  return id === DEFAULTS.classifier ? rest : { ...rest, classifier: id };
}

export const sameRoute = (a, b) => a.model === b.model && (a.effort ?? null) === (b.effort ?? null);

// A route draft carries `base`, the routes and baseline it was made from. A tier counts as edited when it differs
// from its base; everything else follows `current`, so a change saved elsewhere meanwhile is neither shown stale
// nor written back.
export function effectiveRoutes(draft, current) {
  const { base } = draft;
  return {
    routes: Object.fromEntries(
      TIERS.map((tier) => [
        tier,
        sameRoute(draft.routes[tier], base.routes[tier]) ? current.routes[tier] : draft.routes[tier],
      ]),
    ),
    baselineTier: draft.baselineTier === base.baselineTier ? current.baselineTier : draft.baselineTier,
  };
}

// The router.json `file` with the tiers and baseline the person edited in `draft`; everything else stays as the
// file has it now, so an edit made on disk meanwhile survives. Only differences from DEFAULTS are written, so a later
// change of a default still reaches tiers the user never edited; a route equal to the default is removed.
export function withRoutes(file, draft) {
  const { base } = draft;
  const { routes: kept = {}, baselineTier: keptBaseline, ...rest } = file;
  const routes = {};
  for (const tier of TIERS) {
    if (sameRoute(draft.routes[tier], base.routes[tier])) {
      // Untouched here: keep the file's own entry verbatim, so an inherited effort stays inherited.
      if (kept[tier]) routes[tier] = kept[tier];
      continue;
    }
    const { model, effort = null } = draft.routes[tier];
    const preset = DEFAULTS.routes[tier];
    if (model === preset.model && effort === (preset.effort ?? null)) continue;
    routes[tier] = { model, effort };
  }
  const baseline =
    draft.baselineTier === base.baselineTier
      ? keptBaseline
      : draft.baselineTier === DEFAULTS.baselineTier
        ? undefined
        : draft.baselineTier;
  return {
    ...rest,
    ...(Object.keys(routes).length ? { routes } : {}),
    ...(baseline === undefined ? {} : { baselineTier: baseline }),
  };
}

// The pane's policy controls and the router.json fields they stand for. The classifier deadline saves on its own.
const TUNING_FIELDS = {
  downgradeVotes: ['policy', 'downgradeVotes'],
  horizon: ['policy', 'downgradeHorizonTurns'],
  cashCapUsd: ['policy', 'cashCapUsd'],
};

export function tuningOf(config) {
  return Object.fromEntries(
    Object.entries(TUNING_FIELDS).map(([key, [section, field]]) => [key, config[section][field]]),
  );
}

// The router.json `file` with only the tuning values the person changed in `draft` against `saved`. A value equal to
// the default is written as no key, and a section left empty is dropped, as for routes and deadlines.
export function withTuning(file, draft, saved) {
  let next = file;
  for (const [key, [section, field]] of Object.entries(TUNING_FIELDS)) {
    if (draft[key] === saved[key]) continue;
    const { [field]: _, ...kept } = next[section] ?? {};
    const entry = draft[key] === DEFAULTS[section][field] ? kept : { ...kept, [field]: draft[key] };
    const { [section]: __, ...rest } = next;
    next = Object.keys(entry).length ? { ...rest, [section]: entry } : rest;
  }
  return next;
}

// The router.json `file` with classifier `id` given `timeoutMs`. A built-in classifier's default deadline is written
// as no override, and an entry or section left empty is dropped, so a later change of the default still reaches it.
export function withClassifierTimeout(file, id, timeoutMs) {
  const { classifiers = {}, ...rest } = file;
  const { [id]: current = {}, ...others } = classifiers;
  const { timeoutMs: _, ...entry } = current;
  const isDefault = Object.hasOwn(DEFAULTS.classifiers, id) && DEFAULTS.classifiers[id].timeoutMs === timeoutMs;
  const kept = isDefault ? entry : { ...entry, timeoutMs };
  const next = Object.keys(kept).length ? { ...others, [id]: kept } : others;
  return Object.keys(next).length ? { ...rest, classifiers: next } : rest;
}

export function rank(tier) {
  return TIERS.indexOf(tier);
}

// The model entry a tier routes to.
export const routeModel = (config, tier) => config.models[config.routes[tier].model];

// Whether a Claude Code version, such as 2.1.289 or a 2.1.290-beta build, runs the router: 2.1.289 or newer.
export function supportedVersion(version) {
  const parts = /^(\d+)\.(\d+)\.(\d+)(?:$|-)/.exec(version ?? '');
  if (!parts) return false;
  const [major, minor, patch] = parts.slice(1).map(Number);
  return major > 2 || (major === 2 && (minor > 1 || (minor === 1 && patch >= 289)));
}

function merge(base, override) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] =
      Object.hasOwn(base, key) && typeof value === 'object' && value !== null && !Array.isArray(value)
        ? merge(base[key], value)
        : value;
  }
  return out;
}

// The 0.8 gateway layout: these keys only existed there.
export const isGatewayLayout = (file) =>
  Object.hasOwn(file, 'gateway') ||
  Object.hasOwn(file, 'log') ||
  Object.values(file.models ?? {}).some(
    (model) => model && (Object.hasOwn(model, 'features') || Object.hasOwn(model, 'maxOutput')),
  );

// The raw file, before the merge: only known keys, and every section an object. Messages name the path, never the
// value. An open map (model aliases, cache TTL labels) takes any key but the forbidden ones.
function checkShape(file) {
  if (file && typeof file === 'object' && isGatewayLayout(file))
    throw new Error(`router.json uses gateway settings; ${MIGRATION_HINT}`);
  if (file && typeof file === 'object' && Object.hasOwn(file, 'jev'))
    throw new Error(`router.json uses the 1.1 jev section; ${MIGRATION_HINT}`);
  checkObject(file, 'router.json', Object.keys(DEFAULTS));
  const { routes, models, cache, policy, classifiers, context } = file;
  if (routes !== undefined) {
    checkObject(routes, 'routes', TIERS);
    for (const [tier, route] of Object.entries(routes)) checkObject(route, `routes.${tier}`, ROUTE_KEYS);
  }
  if (models !== undefined) {
    checkObject(models, 'models');
    for (const [alias, model] of Object.entries(models)) checkObject(model, `models.${alias}`, MODEL_KEYS);
  }
  if (cache !== undefined) {
    checkObject(cache, 'cache', Object.keys(DEFAULTS.cache));
    for (const map of ['writeMultiplier', 'ttlMs'])
      if (cache[map] !== undefined) checkObject(cache[map], `cache.${map}`);
  }
  if (policy !== undefined) checkObject(policy, 'policy', Object.keys(DEFAULTS.policy));
  if (classifiers !== undefined) {
    checkObject(classifiers, 'classifiers');
    for (const [id, entry] of Object.entries(classifiers)) checkObject(entry, `classifiers.${id}`, CLASSIFIER_KEYS);
  }
  if (context !== undefined) checkObject(context, 'context', Object.keys(DEFAULTS.context));
}

// `allowed` null: an open map.
function checkObject(value, path, allowed = null) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${path} must be an object`);
  for (const key of Object.keys(value)) {
    const at = path === 'router.json' ? key : `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`${at} is not allowed`);
    if (allowed && !allowed.includes(key)) throw new Error(`${at} is not a known key`);
  }
}

const isNumber = (value, min, { above = false, integer = false } = {}) =>
  Number.isFinite(value) && (above ? value > min : value >= min) && (!integer || Number.isInteger(value));

function validate(config) {
  for (const tier of TIERS) {
    const route = config.routes[tier];
    if (!route || typeof route.model !== 'string') throw new Error(`routes.${tier}.model is required`);
    if (!Object.hasOwn(config.models, route.model)) throw new Error(`routes.${tier}.model is not in models`);
    // null keeps the session effort; it is how a file overrides a default route that names one.
    if (route.effort != null && !EFFORTS.includes(route.effort))
      throw new Error(`routes.${tier}.effort must be one of ${EFFORTS.join(', ')} or null`);
  }
  for (const [alias, model] of Object.entries(config.models)) {
    for (const field of ['input', 'cacheRead', 'contextWindow']) {
      if (!Number.isFinite(model[field]) || model[field] < 0)
        throw new Error(`models.${alias}.${field} must be a non-negative number`);
    }
    if (model.output !== undefined && !(Number.isFinite(model.output) && model.output >= 0))
      throw new Error(`models.${alias}.output must be a non-negative number`);
    if (typeof model.id !== 'string' || !model.id) throw new Error(`models.${alias}.id is required`);
    if (!['plan', 'credits'].includes(model.billing))
      throw new Error(`models.${alias}.billing must be plan or credits`);
    if (!Array.isArray(model.efforts) || model.efforts.some((e) => !EFFORTS.includes(e)))
      throw new Error(`models.${alias}.efforts must list valid effort levels`);
  }
  if (!TIERS.includes(config.baselineTier)) throw new Error(`baselineTier must be one of ${TIERS.join(', ')}`);
  const p = config.policy;
  for (const field of ['upgradeBase', 'jumpConfidence', 'downgradeMass', 'continuationMass']) {
    if (!(isNumber(p[field], 0) && p[field] <= 1)) throw new Error(`policy.${field} must be between 0 and 1`);
  }
  for (const field of ['upgradeVotes', 'downgradeVotes', 'downgradeHorizonTurns', 'escalationHoldTurns']) {
    if (!isNumber(p[field], 1, { integer: true })) throw new Error(`policy.${field} must be a positive integer`);
  }
  // The pivot divides: tax / (tax + pivot). Zero makes a free switch NaN and silently stops that switch.
  for (const side of ['upgrade', 'downgrade']) {
    if (!isNumber(p[`${side}Slope`], 0)) throw new Error(`policy.${side}Slope must be a non-negative number`);
    if (!isNumber(p[`${side}PivotUsd`], 0, { above: true })) throw new Error(`policy.${side}PivotUsd must be positive`);
  }
  if (!isNumber(p.cashCapUsd, 0)) throw new Error('policy.cashCapUsd must be a non-negative number');
  const { cache, context } = config;
  for (const map of ['writeMultiplier', 'ttlMs']) {
    for (const [ttl, value] of Object.entries(cache[map]))
      if (!isNumber(value, 0, { above: true })) throw new Error(`cache.${map}.${ttl} must be positive`);
  }
  if (!isNumber(cache.warmMarginMs, 0)) throw new Error('cache.warmMarginMs must be a non-negative number');
  for (const [id, entry] of Object.entries(config.classifiers)) {
    const at = `classifiers.${id}`;
    for (const field of ['label', 'endpoint', 'model']) {
      if (typeof entry[field] !== 'string' || !entry[field]) throw new Error(`${at}.${field} is required`);
    }
    // The bearer key travels with the request: plain http only to this machine, as the test stubs use.
    if (!/^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/)/.test(entry.endpoint))
      throw new Error(`${at}.endpoint must be an https URL, or http on localhost`);
    // Only `{name}` placeholders: a stray brace would reach the network as part of the URL.
    if (/[{}]/.test(entry.endpoint.replace(/\{[a-z][a-z0-9_]*\}/g, '')))
      throw new Error(`${at}.endpoint placeholders must look like {lower_snake_case}`);
    if (endpointSettings(entry.endpoint).some((name) => !OPTION_NAMES.includes(name)))
      throw new Error(`${at}.endpoint placeholders must be one of ${OPTION_NAMES.join(', ')}`);
    if (!OPTION_NAMES.includes(entry.keyOption))
      throw new Error(`${at}.keyOption must be one of ${OPTION_NAMES.join(', ')}`);
    if (!isNumber(entry.timeoutMs, 0, { above: true })) throw new Error(`${at}.timeoutMs must be positive`);
  }
  if (typeof config.classifier !== 'string' || !Object.hasOwn(config.classifiers, config.classifier))
    throw new Error('classifier is not in classifiers');
  for (const field of ['recentTurns', 'maxTextChars']) {
    if (!isNumber(context[field], 1, { integer: true })) throw new Error(`context.${field} must be a positive integer`);
  }
}

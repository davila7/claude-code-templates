import { activeClassifier, CLASSIFIER_OPTIONS, endpointSettings, routeModel } from './config.mjs';
import { tierForModel } from './route.mjs';

// Cost order, cheapest first, so the colors read as a scale. Hex values: every surface draws them.
export const TIER_COLOR = { micro: '#5fd7af', low: '#5f9fe0', medium: '#d7af5f', high: '#e0708a' };

export function modelName(id) {
  if (!id) return 'no response yet';
  return id
    .replace(/^claude-/, '')
    .replace(/-([0-9])-([0-9])(-\d{8})?$/, ' $1.$2')
    .replace(/^./, (c) => c.toUpperCase());
}

// "Opus 5.5 · high"; a model with no effort reading shows its name alone.
export const routeLabel = (model, effort) =>
  `${modelName(model)}${effort === null || effort === undefined ? '' : ` · ${effort}`}`;

// Changes of tier between consecutive replies; a reply routing did not choose breaks no run.
export const switchCount = (tiers) => tiers.slice(1).filter((tier, i) => tier && tiers[i] && tier !== tiers[i]).length;

export const percent = (value) => `${Math.round(value * 100)}%`;

export const REASONS = {
  ready: 'ready for the next turn',
  'same-tier': 'the task fits the current tier',
  'no-advice': 'keeping the current model without classifier advice',
  continuation: 'continuing the previous task',
  uncertain: 'the classifier could not justify a change',
  upgrade: 'enough support for a stronger model',
  jump: 'clear need for a stronger model',
  downgrade: 'enough support for a cheaper model',
  'upgrade-pending': 'waiting before upgrading',
  'downgrade-pending': 'switching is not justified yet',
  hold: 'staying after an escalation',
  escalation: 'repeated tool failures need a stronger model',
  'cash-gate': 'estimated cold cache write exceeds the cap',
  'context-fit': 'a larger context window is needed',
  'context-unknown': 'context is not measured reliably',
  'model-unavailable': 'the requested model is not available',
  pinned: 'one-turn model pin',
};

// The active decision model behind the router. Named in the UI only where it explains a reading or a failure.
export const classifierLabel = (config) => activeClassifier(config).label;
// The credentials error of classifier `id` from the view, or null when its key and endpoint settings are all there.
// Not yet read counts as a missing key.
export const missingCredentials = (view, id) =>
  view.credentials && Object.hasOwn(view.credentials, id) ? view.credentials[id] : 'missing-key';
// What classifier `id` lacks, named by the setting the person enters: "no API token", "no account ID".
export function missingText(config, id, missing) {
  const entry = config.classifiers[id];
  const option = missing === 'missing-key' ? entry.keyOption : endpointSettings(entry.endpoint)[0];
  return `no ${CLASSIFIER_OPTIONS[option] ?? 'setting'}`;
}

// Every setting the configured classifiers read, grouped by classifier: "Jev: API key · Clef, Clef Flash: API token,
// account ID".
export function credentialsNeeded(config) {
  const groups = new Map();
  for (const entry of Object.values(config.classifiers)) {
    const needs = [entry.keyOption, ...endpointSettings(entry.endpoint)].map((option) => CLASSIFIER_OPTIONS[option]);
    const key = needs.join(', ');
    groups.set(key, [...(groups.get(key) ?? []), entry.label]);
  }
  return [...groups].map(([needs, labels]) => `${labels.join(', ')}: ${needs}`).join(' · ');
}

// The active classifier with what went wrong: "Jev: no API key", "Clef timed out". Short: the band keeps it whole.
export function classifierStatus(config, error) {
  const label = activeClassifier(config).label;
  return error === 'missing-key' || error === 'missing-account'
    ? `${label}: ${missingText(config, config.classifier, error)}`
    : `${label} ${CLASSIFIER_ERRORS[error]?.text ?? error}`;
}

// Every classifier error: its words after the label (missing credentials name the setting instead), whether the band
// warns (busy and cancelled are routine and pass silently), and whether the wait counts as a timed reading (a request
// that was never sent does not).
const CLASSIFIER_ERRORS = {
  'missing-key': { text: null, warn: true, timed: false },
  'missing-account': { text: null, warn: true, timed: false },
  paused: { text: 'paused after failures', warn: true, timed: false },
  busy: { text: 'busy', warn: false, timed: false },
  timeout: { text: 'timed out', warn: true, timed: true },
  auth: { text: 'rejected the key', warn: true, timed: true },
  http: { text: 'request failed', warn: true, timed: true },
  unreachable: { text: 'unreachable', warn: true, timed: true },
  policy: { text: 'blocked by network policy', warn: true, timed: true },
  malformed: { text: 'sent a bad answer', warn: true, timed: true },
  cancelled: { text: 'cancelled', warn: false, timed: true },
};
export const classifierWarns = (error) => CLASSIFIER_ERRORS[error]?.warn === true;
// No error, or one outside the table, times the wait.
export const classifierTimed = (error) => CLASSIFIER_ERRORS[error]?.timed !== false;
// One or two words for the band; REASONS holds the sentence the pane shows.
export const SHORT_REASONS = {
  ready: 'ready',
  'same-tier': '= fits',
  'no-advice': '= no advice',
  continuation: '→ continuing',
  uncertain: '= uncertain',
  upgrade: '↑ upgrade',
  jump: '↑ jump',
  downgrade: '↓ downgrade',
  'upgrade-pending': '… waiting to go up',
  'downgrade-pending': '… waiting to go down',
  hold: '= holding',
  escalation: '↑ tool errors',
  'cash-gate': '= cash cap',
  'context-fit': '↑ context',
  'context-unknown': '= context unknown',
  'model-unavailable': '! model unavailable',
  'native-fallback': '! fallback',
  pinned: '⏵ pinned',
  interrupted: 'interrupted',
};

export const GATEWAY_SETTINGS = 'v0.8 gateway settings remain · see /router';
export const GATEWAY_CLEANUP = [
  'Remove from settings.json, then restart: model jev-router[1m], its modelPicker row,',
  'env.ANTHROPIC_BASE_URL for 127.0.0.1:43170, env.CLAUDE_CODE_GATEWAY_HINT_HEADERS,',
  'and a statusLine that runs the router scripts/statusline.mjs.',
];

export function formatTokens(value) {
  if (!Number.isFinite(value)) return 'unknown';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function bar(value, maximum, width = 16) {
  if (!Number.isFinite(value) || !(maximum > 0)) return { text: 'unknown', percent: null, color: 'gray' };
  const fraction = Math.max(0, value / maximum);
  const filled = Math.min(width, Math.round(fraction * width));
  return {
    text: `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`,
    percent: Math.round(fraction * 100),
    color: fraction > 0.8 ? 'red' : fraction > 0.6 ? 'yellow' : 'green',
  };
}

export function usageMetrics(config, view, usage) {
  const model = view.actualModel ?? view.selectedModel ?? view.nativeModel;
  const tier = tierForModel(config, model);
  const spec = tier ? routeModel(config, tier) : null;
  const window = spec?.contextWindow ?? null;
  const observed = Number.isFinite(usage?.context?.tokens) ? usage.context.tokens : null;
  const candidates = [view.contextTokens, observed === null ? null : observed + (view.outputTokens ?? 0)].filter(
    (value) => Number.isFinite(value),
  );
  const nextContext = candidates.length ? Math.max(...candidates) : null;
  const reuse = view.inputTokens > 0 && Number.isFinite(view.cacheRead) ? view.cacheRead / view.inputTokens : null;
  const cost = Number.isFinite(usage?.cost?.usd) ? usage.cost.usd : null;
  const cacheBenefit =
    spec && Number.isFinite(view.cacheRead) ? ((spec.input - spec.cacheRead) * view.cacheRead) / 1e6 : null;
  return {
    window,
    observed,
    nextContext,
    reuse,
    cost,
    cacheBenefit,
    contextBar: bar(nextContext, window),
    cacheBar: {
      ...bar(reuse, 1),
      color: reuse === null ? 'gray' : reuse >= 0.6 ? 'green' : reuse >= 0.2 ? 'yellow' : 'gray',
    },
  };
}

// Scaled from the lowest to the highest reading: a long session's inputs sit close together, and a scale from zero
// draws them all as full blocks. Equal readings draw a flat middle line.
export function sparkline(values) {
  if (!values.length || !values.every(Number.isFinite)) return 'no history yet';
  const symbols = '▁▂▃▄▅▆▇█';
  const minimum = Math.min(...values);
  const span = Math.max(...values) - minimum;
  return values.map((value) => symbols[span > 0 ? Math.round(((value - minimum) / span) * 7) : 3]).join('');
}

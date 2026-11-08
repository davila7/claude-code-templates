import { EFFORTS, routeModel } from './config.mjs';

export function cacheKey(modelId, effort) {
  return effort ? `${modelId}@${effort}` : modelId;
}

export function clampEffort(wanted, supported) {
  if (!wanted || supported.length === 0) return null;
  if (supported.includes(wanted)) return wanted;
  for (let i = EFFORTS.indexOf(wanted); i >= 0; i -= 1) if (supported.includes(EFFORTS[i])) return EFFORTS[i];
  return supported[0];
}

export function nextContextTokens(facts) {
  const previous = facts.lastRequest ? facts.lastRequest.tokens + facts.lastRequest.outputTokens : 0;
  return Math.max(previous, Number.isFinite(facts.contextTokens) ? facts.contextTokens : 0);
}

export function routeEffort(config, tier, sentEffort) {
  const route = config.routes[tier];
  const model = routeModel(config, tier);
  if (model.efforts.length === 0) return null;
  if (route.effort) return clampEffort(route.effort, model.efforts);
  if (typeof sentEffort === 'number' && Number.isFinite(sentEffort)) return sentEffort;
  return clampEffort(sentEffort, model.efforts);
}

export function routeCacheKey(config, tier, sentEffort) {
  return cacheKey(routeModel(config, tier).id, routeEffort(config, tier, sentEffort));
}

export function isWarm(state, now, cache) {
  return Boolean(
    state?.prefixTokens > 0 && now >= state.lastAt && now < state.lastAt + cache.ttlMs['5m'] - cache.warmMarginMs,
  );
}

export function cacheState(state, now, cache) {
  return isWarm(state, now, cache) ? 'fresh' : 'unknown';
}

// Bounds are scenarios, never an independent ledger. Unknown incumbent cache can still be served.
export function inputBounds(config, tier, tokens, facts, now) {
  const model = routeModel(config, tier);
  const state = facts.models[routeCacheKey(config, tier, facts.effort)];
  const prefix = Math.min(state?.prefixTokens ?? tokens, tokens);
  const fresh = isWarm(state, now, config.cache);
  const maximumWrite = model.input * Math.max(...Object.values(config.cache.writeMultiplier));
  return {
    min: (model.cacheRead * prefix + model.input * (tokens - prefix)) / 1e6,
    max: fresh ? (model.cacheRead * prefix + maximumWrite * (tokens - prefix)) / 1e6 : (maximumWrite * tokens) / 1e6,
  };
}

export function coldWriteUsd(config, alias, tokens) {
  return (config.models[alias].input * Math.max(...Object.values(config.cache.writeMultiplier)) * tokens) / 1e6;
}

export function switchingTaxUsd(config, candidate, incumbent, facts, now) {
  const tokens = nextContextTokens(facts);
  return (
    inputBounds(config, candidate, tokens, facts, now).max - inputBounds(config, incumbent, tokens, facts, now).min
  );
}

export function shadowEconomics(config, candidate, incumbent, facts, now) {
  const proposed = routeModel(config, candidate);
  const current = routeModel(config, incumbent);
  if (!(proposed.output > 0) || !(current.output > 0)) return null;
  const tokens = nextContextTokens(facts);
  const outputTokens = facts.lastRequest?.outputTokens ?? 0;
  const output = ((proposed.output - current.output) * outputTokens) / 1e6;
  const nextTurnUsd = switchingTaxUsd(config, candidate, incumbent, facts, now) + output;
  const laterTurnUsd = ((proposed.cacheRead - current.cacheRead) * tokens) / 1e6 + output;
  const paybackTurns =
    nextTurnUsd <= 0 && laterTurnUsd <= 0
      ? 0
      : nextTurnUsd > 0 && laterTurnUsd < 0
        ? Math.ceil(nextTurnUsd / -laterTurnUsd)
        : null;
  return { nextTurnUsd, laterTurnUsd, paybackTurns, outputTokens };
}

export function downgradeTaxUsd(config, candidate, incumbent, facts, now, turns) {
  const estimate = shadowEconomics(config, candidate, incumbent, facts, now);
  if (!estimate) return Math.max(0, switchingTaxUsd(config, candidate, incumbent, facts, now));
  return Math.max(0, estimate.nextTurnUsd + (turns - 1) * estimate.laterTurnUsd);
}

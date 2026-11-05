import { routeModel, TIERS } from './config.mjs';
import * as costs from './cost.mjs';
import { clip, extractFacts } from './facts.mjs';
import { CONTEXT_FILL, decide, fitTier, initialState } from './policy.mjs';

// Exact observed API snapshot, not a rule that merges different dated versions.
const SNAPSHOTS = { 'claude-haiku-4-5': 'claude-haiku-4-5-20251001' };

// A request this much smaller than the last means the history was compacted or rewound: the cached prefixes the
// observations describe are gone, so they are dropped rather than priced as warm.
const HISTORY_SHRINK = 0.8;

// Whether the engine served the requested model, allowing for a dated snapshot of it.
export function isSameModel(requested, served) {
  return requested === served || SNAPSHOTS[requested] === served;
}

// The engine may echo our own routed model on a continuation; any third model is its fallback.
export function isNativeFallback(loop, model) {
  if (loop.suspended) return true;
  const known = [loop.engineModel, loop.decision?.model].filter(Boolean);
  return known.length > 0 && !known.some((id) => isSameModel(id, model));
}

export function tierForModel(config, id) {
  const order = [config.baselineTier, ...TIERS.filter((tier) => tier !== config.baselineTier)];
  return order.find((tier) => isSameModel(routeModel(config, tier).id, id)) ?? null;
}

export function emptyLoop(config, model) {
  return {
    lastRoute: tierForModel(config, model) ?? config.baselineTier,
    state: initialState(),
    models: {},
    resolutions: {},
    lastRequest: null,
    historyMeasured: false,
    lastMessageCount: null,
    generation: 0,
    turnId: null,
    decision: null,
    ineligible: [],
  };
}

export function resetHistory(loop) {
  return {
    ...loop,
    generation: loop.generation + 1,
    models: {},
    resolutions: {},
    historyMeasured: false,
    state: { ...loop.state, votes: [], holdUntilTurn: 0, escalatedSignature: null },
    // The active turn keeps its route, pin and fallback suspension; the next turn decides afresh.
    ineligible: [],
  };
}

export function prepareLoop(loop, messageCount) {
  const next = loop.lastMessageCount !== null && messageCount < loop.lastMessageCount ? resetHistory(loop) : loop;
  return { ...next, lastMessageCount: messageCount };
}

export function nativeFacts(config, loop, { messages, prompt, effort, turnId, contextTokens }) {
  const facts = extractFacts({ messages, output_config: { effort } }, loop, config.context);
  if (typeof prompt === 'string') facts.prompt = clip(prompt, config.context.maxTextChars);
  return { ...facts, pin: null, contextTokens, turnKey: turnId };
}

export function isModelAllowed(id, available, nativeModel) {
  if (available === undefined) return true;
  if (!Array.isArray(available) || !available.every((v) => typeof v === 'string')) return false;
  if (available.includes('default') && id === nativeModel) return true;
  const family = /^claude-(opus|sonnet|haiku)-/.exec(id)?.[1];
  const specific = available.filter((v) => family && v.startsWith(`claude-${family}-`));
  if (specific.length) return specific.some((v) => id === v || id.startsWith(`${v}-`));
  return available.some((v) => id === v || id.startsWith(`${v}-`) || (family && v === family));
}

function economicConfig(config, loop) {
  const models = Object.fromEntries(
    Object.entries(config.models).map(([alias, model]) => [
      alias,
      { ...model, id: Object.hasOwn(loop.resolutions, model.id) ? loop.resolutions[model.id] : model.id },
    ]),
  );
  return { ...config, models };
}

export function chooseRoute(config, loop, { facts, advice, pin, nativeModel, contextKnown, availableModels, now }) {
  const projected = economicConfig(config, loop);
  let result =
    pin && TIERS.includes(pin)
      ? { tier: pin, reason: 'pinned', state: { ...loop.state, turn: loop.state.turn + 1 } }
      : decide({
          config: projected,
          facts,
          advice,
          state: loop.state,
          baseline: config.baselineTier,
          now,
          costs,
        });
  // Without a reliable reading of the context, a tier with a smaller window than the last route's might overflow.
  const shrinksUnmeasured = (tier) =>
    (!contextKnown || !loop.historyMeasured) &&
    routeModel(config, tier).contextWindow < routeModel(config, loop.lastRoute).contextWindow;
  const fits = (tier) => {
    const model = routeModel(config, tier);
    return (
      !shrinksUnmeasured(tier) &&
      isModelAllowed(model.id, availableModels, nativeModel) &&
      !loop.ineligible.includes(model.id) &&
      (!contextKnown || costs.nextContextTokens(facts) <= model.contextWindow * CONTEXT_FILL)
    );
  };
  if (contextKnown) {
    const fitted = fitTier(config, result.tier, costs.nextContextTokens(facts));
    if (fitted !== result.tier) result = { ...result, tier: fitted, reason: 'context-fit' };
  }
  if (shrinksUnmeasured(result.tier)) result = { ...result, tier: loop.lastRoute, reason: 'context-unknown' };
  if (!fits(result.tier)) {
    const fallback = [loop.lastRoute, tierForModel(config, nativeModel), ...TIERS].find((tier) => tier && fits(tier));
    result = { ...result, tier: fallback ?? null, reason: 'model-unavailable' };
  }
  const model = result.tier ? routeModel(config, result.tier).id : nativeModel;
  const effort = result.tier ? costs.routeEffort(config, result.tier, facts.effort) : facts.effort;
  let comparison = null;
  const candidate = pin ?? advice?.choice;
  if (contextKnown && loop.lastRequest && TIERS.includes(candidate) && candidate !== loop.lastRoute) {
    const tokens = costs.nextContextTokens(facts);
    const proposed = costs.inputBounds(projected, candidate, tokens, facts, now);
    const incumbent = costs.inputBounds(projected, loop.lastRoute, tokens, facts, now);
    const forecast = costs.shadowEconomics(projected, candidate, loop.lastRoute, facts, now);
    // Without both output prices, compare input only, as shadowEconomics does.
    const output = forecast
      ? ((routeModel(projected, candidate).output - routeModel(projected, loop.lastRoute).output) *
          loop.lastRequest.outputTokens) /
        1e6
      : 0;
    comparison = {
      candidate,
      incumbent: loop.lastRoute,
      minUsd: proposed.min - incumbent.max + output,
      maxUsd: proposed.max - incumbent.min + output,
      paybackTurns: forecast?.paybackTurns ?? null,
      outputTokens: loop.lastRequest.outputTokens,
    };
  }
  const decision = { ...result, model, effort, comparison, pinned: Boolean(pin), requestedPin: pin ?? null };
  return {
    ...loop,
    state: result.state,
    lastRoute: pin ? loop.lastRoute : (result.tier ?? loop.lastRoute),
    turnId: facts.turnKey,
    decision,
    suspended: false,
  };
}

export function continueRoute(config, loop, { nativeModel, contextTokens, contextKnown, availableModels, effort }) {
  if (!loop.decision) return loop;
  let decision = loop.decision;
  if (contextKnown && decision.tier) {
    const fitted = fitTier(config, decision.tier, contextTokens);
    if (fitted !== decision.tier)
      decision = {
        ...decision,
        tier: fitted,
        model: routeModel(config, fitted).id,
        effort: costs.routeEffort(config, fitted, effort),
        reason: 'context-fit',
      };
  }
  if (!isModelAllowed(decision.model, availableModels, nativeModel) || loop.ineligible.includes(decision.model)) {
    decision = { ...decision, tier: null, model: nativeModel, effort, reason: 'model-unavailable' };
  }
  return { ...loop, decision };
}

export function observeResponse(loop, { usage, requestedModel, effort, stopReason, now }) {
  let next = loop;
  if (stopReason === 'model_context_window_exceeded') {
    next = { ...next, ineligible: [...new Set([...next.ineligible, requestedModel])] };
  }
  if (!usage?.model) return next;
  const sameModel = isSameModel(requestedModel, usage.model);
  if (!sameModel) next = { ...next, suspended: true };
  const counts = ['input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'output_tokens'];
  if (!counts.every((key) => Number.isFinite(usage[key]) && usage[key] >= 0)) return next;
  const tokens = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens;
  if (tokens === 0) return next;
  const resolutions = sameModel ? { ...next.resolutions, [requestedModel]: usage.model } : { ...next.resolutions };
  if (!sameModel) delete resolutions[requestedModel];
  let models = next.models;
  if (next.lastRequest && tokens < next.lastRequest.tokens * HISTORY_SHRINK) models = {};
  // A substituted model's effort is not reported, so do not credit its estimated cache.
  if (sameModel)
    models = {
      ...models,
      [costs.cacheKey(usage.model, effort)]: {
        lastAt: now,
        prefixTokens: usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
      },
    };
  return {
    ...next,
    historyMeasured: true,
    models,
    resolutions,
    lastRequest: {
      model: usage.model,
      tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens,
      cacheWriteTokens: usage.cache_creation_input_tokens,
      at: now,
    },
  };
}

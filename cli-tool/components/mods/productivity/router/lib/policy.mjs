// Switching policy v0 (docs/architecture.md): stickiness, escalation floor, cost-gated votes.
import { rank, routeModel, TIERS } from './config.mjs';
import * as nativeCosts from './cost.mjs';

export function initialState() {
  return { turn: 0, votes: [], holdUntilTurn: 0, escalatedSignature: null };
}

// Returns { tier, reason, state, estimate }. `baseline` is the tier used when nothing argues otherwise.
export function decide({ config, facts, advice, state, baseline, now, costs = nativeCosts }) {
  const next = { ...state, turn: state.turn + 1, votes: [...state.votes] };
  const incumbent = facts.lastRoute && TIERS.includes(facts.lastRoute) ? facts.lastRoute : baseline;
  const stay = (reason, estimate = null) => result(incumbent, reason, next, estimate);

  if (facts.failure && facts.failure.signature !== next.escalatedSignature && rank(incumbent) < TIERS.length - 1) {
    next.escalatedSignature = facts.failure.signature;
    next.holdUntilTurn = next.turn + config.policy.escalationHoldTurns;
    next.votes = [];
    const target = TIERS[rank(incumbent) + 1];
    const gated = cashGate(config, target, facts, now, costs);
    return gated.blocked ? gatedResult(gated, incumbent, next) : result(target, 'escalation', next);
  }
  if (next.turn <= next.holdUntilTurn) return stay('hold');
  if (!advice) return stay('no-advice');
  if (advice.continuation >= config.policy.continuationMass) return stay('continuation');
  if (advice.choice === 'uncertain') return stay('uncertain');

  const choice = advice.choice;
  next.votes = [...next.votes.slice(-2), { tier: choice, turn: next.turn }];
  if (rank(choice) === rank(incumbent)) return stay('same-tier');

  if (rank(choice) > rank(incumbent)) {
    const upgrade = massAbove(advice.probabilities, incumbent);
    const gated = cashGate(config, choice, facts, now, costs);
    if (gated.blocked) return gatedResult(gated, incumbent, next);
    const tax = Math.max(0, costs.switchingTaxUsd(config, choice, incumbent, facts, now));
    const threshold =
      config.policy.upgradeBase + config.policy.upgradeSlope * (tax / (tax + config.policy.upgradePivotUsd));
    const jump = rank(choice) - rank(incumbent) >= 2 && upgrade >= config.policy.jumpConfidence;
    const streak = trailing(next.votes, (v) => rank(v.tier) > rank(incumbent));
    const cache = {
      candidate: cacheOf(config, choice, facts, now, costs),
      incumbent: cacheOf(config, incumbent, facts, now, costs),
    };
    const estimate = { taxUsd: tax, threshold, upgradeMass: upgrade, streak, cache };
    if (jump || (streak >= config.policy.upgradeVotes && upgrade >= threshold))
      return result(choice, jump ? 'jump' : 'upgrade', next, estimate);
    return stay('upgrade-pending', estimate);
  }

  const support = massAtOrBelow(advice.probabilities, choice);
  const streak = trailing(next.votes, (v) => rank(v.tier) <= rank(choice));
  // A downgrade is not always cheaper this turn: a cold candidate next to a warm incumbent can pay a bigger cache
  // write than it saves. The bar rises with that cost, net of what the next turns save, the way the upgrade bar does.
  const tax = costs.downgradeTaxUsd(config, choice, incumbent, facts, now, config.policy.downgradeHorizonTurns);
  const threshold =
    config.policy.downgradeMass + config.policy.downgradeSlope * (tax / (tax + config.policy.downgradePivotUsd));
  const estimate = { downgradeMass: support, streak, taxUsd: tax, threshold };
  if (support >= threshold && streak >= config.policy.downgradeVotes) {
    const gated = cashGate(config, choice, facts, now, costs);
    return gated.blocked ? gatedResult(gated, incumbent, next) : result(choice, 'downgrade', next, estimate);
  }
  return stay('downgrade-pending', estimate);
}

// Share of a model's window the next request may fill. The estimate leaves out the new prompt and tool
// results, so a model drops out before the conversation reaches its limit.
export const CONTEXT_FILL = 0.8;

// The lowest tier at or above `tier` whose model fits `tokens` of context. Routes need not grow in window
// with rank, so the search falls back to any tier that fits, then to the largest window, keeping `tier` on a tie.
export function fitTier(config, tier, tokens) {
  const windowOf = (t) => routeModel(config, t).contextWindow;
  const fits = (t) => tokens <= windowOf(t) * CONTEXT_FILL;
  if (fits(tier)) return tier;
  return (
    TIERS.slice(rank(tier)).find(fits) ??
    TIERS.find(fits) ??
    TIERS.reduce((best, t) => (windowOf(t) > windowOf(best) ? t : best), tier)
  );
}

// Cold-write guard: an automatic route (upgrade, downgrade or escalation) to a credits-billed model whose cache is not warm must not start with a cache
// write above `cashCapUsd`. It bounds that one estimated write, not the spend of the turn: a warm cache passes, and
// output is not counted.
function cashGate(config, tier, facts, now, costs) {
  const alias = config.routes[tier].model;
  if (config.models[alias].billing !== 'credits') return { blocked: false };
  if (costs.isWarm(facts.models[costs.routeCacheKey(config, tier, facts.effort)], now, config.cache))
    return { blocked: false };
  const cold = costs.coldWriteUsd(config, alias, costs.nextContextTokens(facts));
  if (cold <= config.policy.cashCapUsd) return { blocked: false };
  const fallback = [...TIERS].reverse().find((t) => routeModel(config, t).billing === 'plan');
  const estimate = { coldUsd: cold, cap: config.policy.cashCapUsd, cache: cacheOf(config, tier, facts, now, costs) };
  return { blocked: true, fallback, estimate };
}

// A blocked switch lands on the strongest plan tier when that is above the incumbent, else stays.
function gatedResult(gated, incumbent, state) {
  const tier = gated.fallback && rank(gated.fallback) > rank(incumbent) ? gated.fallback : incumbent;
  return result(tier, 'cash-gate', state, gated.estimate);
}

function cacheOf(config, tier, facts, now, costs) {
  return costs.cacheState(facts.models[costs.routeCacheKey(config, tier, facts.effort)], now, config.cache);
}

function trailing(votes, predicate) {
  let count = 0;
  for (let i = votes.length - 1; i >= 0 && predicate(votes[i]); i -= 1) count += 1;
  return count;
}

function result(tier, reason, state, estimate = null) {
  return { tier, reason, state, estimate };
}

// Probability mass strictly above a tier; `uncertain` supports neither direction.
export function massAbove(probabilities, tier) {
  return TIERS.filter((t) => rank(t) > rank(tier)).reduce((sum, t) => sum + probabilities[t], 0);
}

export function massAtOrBelow(probabilities, tier) {
  return TIERS.filter((t) => rank(t) <= rank(tier)).reduce((sum, t) => sum + probabilities[t], 0);
}

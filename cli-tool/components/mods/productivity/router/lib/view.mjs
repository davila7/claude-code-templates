// The view the band and pane draw from: its initial shape and the patches built from pure inputs. Pure: the hook
// writes the view to $.state.

// Replies kept for the pane's trend and tier strip.
const HISTORY = 30;

export function initialView(model) {
  return {
    phase: 'ready',
    activeTurnId: null,
    mode: 'auto',
    nativeModel: model,
    selectedModel: null,
    actualModel: null,
    tier: null,
    effort: null,
    reason: 'ready',
    error: null,
    pendingPin: null,
    credentials: null,
    contextTokens: null,
    contextKnown: false,
    cacheRead: null,
    cacheWrite: null,
    health: { failures: 0, pausedUntil: 0 },
    inputTokens: null,
    outputTokens: null,
    adviceMs: null,
    adviceChoice: null,
    estimate: null,
    comparison: null,
    probabilities: null,
    history: [],
    tiers: [],
    configPath: null,
    tuning: null,
    tuningBase: null,
    routeDraft: null,
    lastWrite: null,
    tab: 'now',
    help: false,
    notice: null,
  };
}

// Failures and a pause belong to the classifier that earned them.
export const healthOf = (client, id) => ({ ...client.snapshot(), classifier: id });
// The last classification's readings, cleared when another classifier takes over so no label claims them.
export const CLEARED_READINGS = { adviceMs: null, adviceChoice: null, probabilities: null, estimate: null };

// The view patch for a main reply's usage. `tier` is the routed tier that served it, else null.
export function responseMetrics(view, response, tier) {
  const usage = response.usage;
  const counters = usage ? [usage.input_tokens, usage.cache_read_input_tokens, usage.cache_creation_input_tokens] : [];
  const inputTokens =
    counters.length && counters.every(Number.isFinite) ? counters.reduce((sum, n) => sum + n, 0) : null;
  return {
    actualModel: usage?.model ?? null,
    cacheRead: usage?.cache_read_input_tokens ?? null,
    cacheWrite: usage?.cache_creation_input_tokens ?? null,
    inputTokens,
    outputTokens: usage?.output_tokens ?? null,
    // Appended together so the Usage trend can color each reading by its tier.
    ...(Number.isFinite(inputTokens)
      ? {
          history: [...(view?.history ?? []), inputTokens].slice(-HISTORY),
          tiers: [...(view?.tiers ?? []), tier ?? null].slice(-HISTORY),
        }
      : {}),
  };
}

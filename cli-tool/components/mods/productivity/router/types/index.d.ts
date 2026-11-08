declare module 'claude-code' {
  type RouterTier = 'micro' | 'low' | 'medium' | 'high';
  type RouterCacheState = 'fresh' | 'unknown';
  interface RouterComparison {
    candidate: RouterTier;
    incumbent: RouterTier;
    minUsd: number;
    maxUsd: number;
    paybackTurns: number | null;
    outputTokens: number;
  }
  interface RouterEstimate {
    taxUsd?: number;
    threshold?: number;
    upgradeMass?: number;
    downgradeMass?: number;
    streak?: number;
    coldUsd?: number;
    cap?: number;
    cache?: RouterCacheState | { candidate: RouterCacheState; incumbent: RouterCacheState };
  }
  interface RouterTuning {
    downgradeVotes: number;
    horizon: number;
    cashCapUsd: number;
  }
  interface RouterRoutes {
    routes: Record<RouterTier, { model: string; effort?: string | null }>;
    baselineTier: RouterTier;
  }
  interface RouterView {
    phase: 'ready' | 'choosing' | 'routed' | 'manual' | 'unavailable';
    mode: 'auto' | 'manual';
    nativeModel: string;
    activeTurnId?: string | null;
    selectedModel?: string | null;
    actualModel?: string | null;
    tier?: RouterTier | null;
    effort?: string | number | null;
    reason?: string;
    error?: string | null;
    pendingPin?: RouterTier | null;
    // Per classifier id: what its credentials lack, or null when complete.
    credentials?: Record<string, 'missing-key' | 'missing-account' | null> | null;
    contextTokens?: number | null;
    contextKnown?: boolean;
    cacheRead?: number | null;
    cacheWrite?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    health?: { failures: number; pausedUntil: number; classifier?: string };
    adviceMs?: number | null;
    adviceChoice?: RouterTier | 'uncertain' | null;
    estimate?: RouterEstimate | null;
    comparison?: RouterComparison | null;
    probabilities?: Partial<Record<RouterTier | 'uncertain', number>> | null;
    history?: number[];
    tiers?: (RouterTier | null)[];
    configPath?: string | null;
    tuning?: Partial<RouterTuning> | null;
    tuningBase?: RouterTuning | null;
    routeDraft?: (RouterRoutes & { base: RouterRoutes }) | null;
    // The last pane write to router.json: each leaf it changed with the value the file had before, none if absent.
    lastWrite?: { label: string; leaves: { path: string[]; value?: unknown }[] } | null;
    tab?: 'now' | 'routing' | 'classifier' | 'usage';
    help?: boolean;
    bandDetail?: boolean;
    notice?: string | null;
  }
  interface RouterPolicyState {
    turn: number;
    votes: { tier: RouterTier; turn: number }[];
    holdUntilTurn: number;
    escalatedSignature: string | null;
  }
  interface RouterLoop {
    lastRoute: RouterTier;
    state: RouterPolicyState;
    models: Record<string, { lastAt: number; prefixTokens: number }>;
    resolutions: Record<string, string>;
    lastRequest: {
      model: string;
      tokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      at: number;
    } | null;
    lastMessageCount: number | null;
    historyMeasured?: boolean;
    generation: number;
    turnId: string | null;
    decision: {
      tier: RouterTier | null;
      reason: string;
      state: RouterPolicyState;
      model: string;
      effort: string | number | null;
      estimate?: RouterEstimate | null;
      comparison?: RouterComparison | null;
      pinned: boolean;
      requestedPin: RouterTier | null;
    } | null;
    ineligible: string[];
    engineModel?: string;
    suspended?: boolean;
  }
  interface PluginState {
    router: {
      view: RouterView;
      loops: StateFamily<RouterLoop>;
    };
  }
}

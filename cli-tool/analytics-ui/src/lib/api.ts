// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenUsage {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  total: number;
}

export interface Conversation {
  id: string;
  projectName?: string;
  lastModified: string;
  tokens: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  model?: string;
  status?: 'active' | 'idle' | 'completed';
  toolUsage?: Record<string, number>;
  messageCount?: number;
  fileSize?: number;
}

export interface Summary {
  totalConversations: number;
  totalTokens: number;
  activeConversations: number;
  avgTokensPerConversation: number;
  lastActivity: string | null;
  totalSessions?: number;
  thisMonthConversations?: number;
  thisWeekConversations?: number;
  thisMonthTokens?: number;
}

export interface DetailedTokenUsage {
  byModel?: Record<string, number>;
  totalInput: number;
  totalOutput: number;
  totalCacheCreation: number;
  totalCacheRead: number;
}

export interface AgentData {
  agentTypes?: Record<string, number>;
  topAgents?: Array<{ name: string; count: number }>;
  totalAgentUses?: number;
  byConversation?: Record<string, number>;
  summary?: any;
}

export interface ActivityData {
  heatmapData?: Array<{ date: string; value: number }>;
  dateRange?: { start: string; end: string };
}

export interface ApiResponse {
  conversations: Conversation[];
  summary: Summary;
  realtimeStats?: {
    totalConversations: number;
    totalTokens: number;
    activeProjects: number;
    lastActivity: string | null;
  };
  detailedTokenUsage: DetailedTokenUsage | null;
  sessionData?: {
    sessions: any[];
    totalSessions: number;
    avgSessionLength?: number;
    currentSession?: any;
  };
  activeProjects?: any[];
  timestamp: string;
  lastUpdate: string;
}

// ── Cache entry ───────────────────────────────────────────────────────────────
interface CacheEntry {
  data: unknown;
  ts: number;
}

// ── ApiClient ─────────────────────────────────────────────────────────────────

class ApiClient {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 30_000; // 30 seconds

  private async request<T>(url: string, ttl = this.DEFAULT_TTL): Promise<T> {
    const now = performance.now();
    const entry = this.cache.get(url);
    if (entry && now - entry.ts < ttl) {
      return entry.data as T;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${url} returned ${res.status}`);
    const data = await res.json() as T;
    this.cache.set(url, { data, ts: now });
    return data;
  }

  async getData(): Promise<ApiResponse> {
    const raw = await this.request<any>('/api/data');
    // Normalize detailedTokenUsage field names (backend uses inputTokens, frontend expects totalInput)
    if (raw.detailedTokenUsage) {
      const dtu = raw.detailedTokenUsage;
      raw.detailedTokenUsage = {
        ...dtu,
        totalInput: dtu.totalInput ?? dtu.inputTokens ?? 0,
        totalOutput: dtu.totalOutput ?? dtu.outputTokens ?? 0,
        totalCacheCreation: dtu.totalCacheCreation ?? dtu.cacheCreationTokens ?? 0,
        totalCacheRead: dtu.totalCacheRead ?? dtu.cacheReadTokens ?? 0,
      };
    }
    // Flatten tokenUsage nested object onto conversation
    if (raw.conversations) {
      raw.conversations = raw.conversations.map((c: any) => ({
        ...c,
        inputTokens: c.inputTokens ?? c.tokenUsage?.inputTokens ?? 0,
        outputTokens: c.outputTokens ?? c.tokenUsage?.outputTokens ?? 0,
        cacheCreationTokens: c.cacheCreationTokens ?? c.tokenUsage?.cacheCreationTokens ?? 0,
        cacheReadTokens: c.cacheReadTokens ?? c.tokenUsage?.cacheReadTokens ?? 0,
      }));
    }
    return raw as ApiResponse;
  }

  async getConversations(page = 0, limit = 20) {
    const url = `/api/conversations?page=${page}&limit=${limit}`;
    return this.request<{ conversations: Conversation[]; pagination: any }>(url, 10_000);
  }

  async getAgents(startDate?: string, endDate?: string): Promise<AgentData> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();
    const raw = await this.request<any>(`/api/agents${qs ? '?' + qs : ''}`, 60_000);
    // Normalize backend agentStats → topAgents, totalAgentInvocations → totalAgentUses
    return {
      totalAgentUses: raw.totalAgentUses ?? raw.totalAgentInvocations ?? 0,
      totalAgentTypes: raw.totalAgentTypes ?? 0,
      topAgents: (raw.topAgents ?? raw.agentStats ?? []).map((a: any) => ({
        name: a.name ?? a.type ?? 'Unknown',
        count: a.count ?? a.totalInvocations ?? 0,
      })),
      agentTypes: raw.agentTypes ?? Object.fromEntries(
        (raw.agentStats ?? []).map((a: any) => [a.type ?? a.name, a.totalInvocations ?? a.count ?? 0])
      ),
    };
  }

  async getActivity(): Promise<ActivityData> {
    const raw = await this.request<any>('/api/activity', 300_000);
    // Normalize dailyActivity → heatmapData
    return {
      heatmapData: (raw.heatmapData ?? raw.dailyActivity ?? []).map((d: any) => ({
        date: d.date,
        value: d.value ?? d.conversations ?? 0,
      })),
      dateRange: raw.dateRange ?? (raw.startDate ? { start: raw.startDate, end: raw.endDate } : undefined),
    };
  }

  async getHealth() {
    return this.request('/api/system/health', 10_000);
  }

  async forceRefresh(): Promise<void> {
    this.cache.clear();
    await fetch('/api/refresh').catch(() => null);
  }

  invalidate(endpoint?: string): void {
    if (endpoint) {
      this.cache.delete(endpoint);
    } else {
      this.cache.clear();
    }
  }
}

export const api = new ApiClient();

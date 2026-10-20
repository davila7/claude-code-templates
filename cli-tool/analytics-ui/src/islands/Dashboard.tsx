import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, type ApiResponse, type AgentData, type ActivityData } from '../lib/api';
import { wsClient, type WsStatus } from '../lib/ws';
import { KPICard } from '../components/KPICard';
import { BarList } from '../components/BarList';
import { ChartCard } from '../components/ChartCard';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { SessionTimer } from '../components/SessionTimer';
import { ThemeToggle } from '../components/ThemeToggle';
import { TimeRangePicker, type TimeRange } from '../components/TimeRangePicker';

// ── Sidebar ───────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'agents',    icon: '🤖', label: 'Agents' },
];

function Sidebar({ view, onNavigate }: { view: string; onNavigate: (v: string) => void }) {
  return (
    <aside
      style={{
        width: 192,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '16px 16px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 22 }}>🔮</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
            Claude Code
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-muted)' }}>Analytics</div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ padding: '8px 0' }}>
        {NAV_ITEMS.map(item => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                background: active ? 'var(--bg-card)' : 'transparent',
                border: 'none',
                borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                cursor: 'pointer',
                color: active ? 'var(--ink)' : 'var(--ink-muted)',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                transition: 'all 0.12s ease',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({
  lastUpdate,
  wsStatus,
  onRefresh,
}: {
  lastUpdate?: string;
  wsStatus: WsStatus;
  onRefresh: () => void;
}) {
  const connected = wsStatus === 'connected';
  const dotColor = connected ? 'var(--green)' : wsStatus === 'connecting' ? 'var(--accent)' : 'var(--ink-subtle)';

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        minHeight: 48,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: connected ? `0 0 6px ${dotColor}` : 'none',
            transition: 'background 0.3s, box-shadow 0.3s',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
          {connected ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Polling'}
        </span>
        {lastUpdate && (
          <span style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>
            · {new Date(lastUpdate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onRefresh}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 12px',
            cursor: 'pointer',
            color: 'var(--ink-muted)',
            fontSize: 12,
            transition: 'border-color 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          ↻ Refresh
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}

// ── Dashboard view ────────────────────────────────────────────────────────────

function DashboardView({
  data,
  agents,
  activity,
  loading,
  timeRange,
  onTimeRangeChange,
}: {
  data: ApiResponse | null;
  agents: AgentData | null;
  activity: Array<{ date: string; value: number }>;
  loading: boolean;
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
}) {
  const summary = data?.summary;
  const tokens  = data?.detailedTokenUsage;

  // Filter conversations by time range
  const filteredConversations = useMemo(() => {
    const convs = data?.conversations ?? [];
    if (timeRange === 'all') return convs;
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return convs.filter(c => c.lastModified && new Date(c.lastModified) >= cutoff);
  }, [data?.conversations, timeRange]);

  // Build daily token data for timeline chart
  const tokenTimelineGetOption = useCallback(() => {
    if (!filteredConversations.length) return {};
    const byDay: Record<string, { input: number; output: number; cache: number }> = {};
    filteredConversations.forEach(c => {
      if (!c.lastModified) return;
      const date = c.lastModified.substring(0, 10);
      if (!byDay[date]) byDay[date] = { input: 0, output: 0, cache: 0 };
      byDay[date].input  += c.inputTokens  ?? 0;
      byDay[date].output += c.outputTokens ?? 0;
      byDay[date].cache  += (c.cacheCreationTokens ?? 0) + (c.cacheReadTokens ?? 0);
    });
    const series = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
    return import('../lib/charts').then(({ tokenTimelineOption, getThemeColors }) =>
      tokenTimelineOption(series, getThemeColors())
    );
  }, [filteredConversations]);

  // Token distribution donut
  const tokenDistGetOption = useCallback(() => {
    if (!tokens) return {};
    return import('../lib/charts').then(({ tokenDistributionOption, getThemeColors }) =>
      tokenDistributionOption(
        {
          input: tokens.totalInput ?? 0,
          output: tokens.totalOutput ?? 0,
          cacheCreation: tokens.totalCacheCreation ?? 0,
          cacheRead: tokens.totalCacheRead ?? 0,
        },
        getThemeColors(),
      )
    );
  }, [tokens]);

  // Agent bar list
  const agentItems = useMemo(() =>
    (agents?.topAgents ?? []).map(a => ({ name: a.name, value: a.count })),
    [agents],
  );

  // Project bar list
  const projectItems = useMemo(() =>
    (data?.activeProjects ?? []).slice(0, 10).map((p: any) => ({
      name: (p.name ?? p.path?.split('/').pop()) || 'Unknown',
      value: p.conversations ?? p.fileCount ?? 1,
    })),
    [data?.activeProjects],
  );

  const fmt = (n: number | null | undefined) =>
    n != null ? n.toLocaleString() : '—';

  // Compute total tokens from filtered conversations (fallback to summary)
  const filteredTokens = useMemo(() =>
    filteredConversations.reduce((s, c) => s + (c.tokens ?? 0), 0),
    [filteredConversations],
  );

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Dashboard</h1>
        <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} />
      </div>

      {/* Bento grid */}
      <div className="bento-grid">
        {/* ── KPI row ── */}
        <div className="col-span-3">
          <KPICard
            label="Total Tokens"
            icon="⚡"
            value={fmt(filteredTokens || summary?.totalTokens)}
            sub={`Conversations: ${fmt(filteredConversations.length)}`}
            loading={loading}
          />
        </div>
        <div className="col-span-3">
          <KPICard
            label="Conversations"
            icon="💬"
            value={fmt(filteredConversations.length || summary?.totalConversations)}
            sub={`Active: ${fmt(summary?.activeConversations)}`}
            loading={loading}
          />
        </div>
        <div className="col-span-3">
          <KPICard
            label="Sessions"
            icon="🕐"
            value={fmt(data?.sessionData?.totalSessions)}
            sub={`Projects: ${fmt(data?.activeProjects?.length)}`}
            loading={loading}
          />
        </div>
        <div className="col-span-3">
          <KPICard
            label="Agent Uses"
            icon="🤖"
            value={fmt(agents?.totalAgentUses)}
            sub={`Types: ${Object.keys(agents?.agentTypes ?? {}).length}`}
            loading={loading}
          />
        </div>

        {/* ── Token timeline + Session timer ── */}
        <div className="col-span-8">
          <ChartCard
            title="Token Usage Over Time"
            subtitle="Input · Output · Cache — stacked"
            height={220}
            loading={loading}
            getOption={tokenTimelineGetOption}
          />
        </div>
        <div className="col-span-4">
          <SessionTimer sessionData={data?.sessionData} loading={loading} />
        </div>

        {/* ── Activity heatmap ── */}
        <div className="col-span-12">
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>
              Activity Heatmap
            </div>
            <ActivityHeatmap
              data={activity}
              loading={loading}
            />
          </div>
        </div>

        {/* ── Agent distribution + Projects ── */}
        <div className="col-span-6">
          <ChartCard title="Agent Usage" subtitle="By invocations" loading={loading}>
            <BarList items={agentItems} maxItems={8} valueLabel="Uses" loading={loading} />
          </ChartCard>
        </div>
        <div className="col-span-6">
          <ChartCard title="Projects" subtitle="By conversations" loading={loading}>
            <BarList items={projectItems} maxItems={8} valueLabel="Convs" loading={loading} />
          </ChartCard>
        </div>

        {/* ── Token distribution donut + Recent conversations ── */}
        <div className="col-span-4">
          <ChartCard
            title="Token Distribution"
            subtitle="Input · Output · Cache"
            height={200}
            loading={loading}
            getOption={tokenDistGetOption}
          />
        </div>
        <div className="col-span-8">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Recent Conversations</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 32 }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {(data?.conversations ?? []).slice(0, 7).map((c, i, arr) => (
                  <div
                    key={c.id ?? i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '7px 0',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: c.status === 'active' ? 'var(--green)' : 'var(--ink-subtle)',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.projectName ?? (c.id?.substring(0, 20) + '…') ?? 'Unknown'}
                    </span>
                    <span
                      className="font-mono"
                      style={{ fontSize: 11, color: 'var(--ink-muted)', flexShrink: 0 }}
                    >
                      {(c.tokens ?? 0).toLocaleString()} tok
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-subtle)', flexShrink: 0 }}>
                      {c.lastModified
                        ? new Date(c.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : ''}
                    </span>
                  </div>
                ))}
                {!data?.conversations?.length && (
                  <div style={{ color: 'var(--ink-subtle)', fontSize: 12, padding: '8px 0' }}>
                    No conversations found in ~/.claude
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Agents view ───────────────────────────────────────────────────────────────

function AgentsView({ agents, loading }: { agents: AgentData | null; loading: boolean }) {
  const agentItems = useMemo(() =>
    (agents?.topAgents ?? []).map(a => ({ name: a.name, value: a.count })),
    [agents],
  );

  const typeItems = useMemo(() =>
    Object.entries(agents?.agentTypes ?? {})
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value),
    [agents],
  );

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Agent Analytics</h1>
      <div className="bento-grid">
        <div className="col-span-4">
          <KPICard
            label="Total Agent Uses"
            icon="🤖"
            value={(agents?.totalAgentUses ?? 0).toLocaleString()}
            loading={loading}
          />
        </div>
        <div className="col-span-4">
          <KPICard
            label="Agent Types"
            icon="🧩"
            value={Object.keys(agents?.agentTypes ?? {}).length}
            sub="distinct types used"
            loading={loading}
          />
        </div>
        <div className="col-span-4">
          <KPICard
            label="Top Agent"
            icon="⭐"
            value={agents?.topAgents?.[0]?.name ?? '—'}
            sub={agents?.topAgents?.[0] ? `${agents.topAgents[0].count} uses` : ''}
            loading={loading}
          />
        </div>
        <div className="col-span-6">
          <ChartCard title="Top Agents" subtitle="By total invocations" loading={loading}>
            <BarList items={agentItems} maxItems={12} valueLabel="Uses" loading={loading} />
          </ChartCard>
        </div>
        <div className="col-span-6">
          <ChartCard title="By Agent Type" subtitle="Distribution across types" loading={loading}>
            <BarList items={typeItems} maxItems={12} valueLabel="Uses" loading={loading} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

// ── Root Dashboard island ─────────────────────────────────────────────────────

export default function Dashboard() {
  const [view, setView] = useState<string>(() =>
    typeof window !== 'undefined'
      ? (window.location.hash.replace('#', '') || 'dashboard')
      : 'dashboard',
  );
  const [data,     setData]     = useState<ApiResponse | null>(null);
  const [agents,   setAgents]   = useState<AgentData | null>(null);
  const [activity, setActivity] = useState<Array<{ date: string; value: number }>>([]);
  const [loading,  setLoading]  = useState(true);
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const navigate = useCallback((v: string) => {
    setView(v);
    if (typeof window !== 'undefined') window.location.hash = '#' + v;
  }, []);

  // Hash routing
  useEffect(() => {
    function onHash() {
      setView(window.location.hash.replace('#', '') || 'dashboard');
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [mainData, agentData, activityData] = await Promise.all([
        api.getData().catch(() => null),
        api.getAgents().catch(() => null),
        api.getActivity().catch(() => null),
      ]);
      if (mainData)    setData(mainData);
      if (agentData)   setAgents(agentData);
      if (activityData) setActivity((activityData as any).heatmapData ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // WebSocket + polling fallback
  useEffect(() => {
    wsClient.connect();
    const unsubStatus = wsClient.onStatus(setWsStatus);
    const unsubData   = wsClient.on('data_updates',         () => { api.invalidate(); loadData(); });
    const unsubConv   = wsClient.on('conversation_updates', () => { api.invalidate('/api/data'); loadData(); });

    // Polling fallback: 30s if WS connected, 10s if not
    const poll = setInterval(() => {
      api.invalidate();
      loadData();
    }, wsStatus === 'connected' ? 30_000 : 10_000);

    return () => {
      unsubStatus();
      unsubData();
      unsubConv();
      clearInterval(poll);
      wsClient.disconnect();
    };
  }, [loadData, wsStatus]);

  const handleRefresh = useCallback(() => {
    api.invalidate();
    loadData();
  }, [loadData]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar view={view} onNavigate={navigate} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header
          lastUpdate={data?.timestamp}
          wsStatus={wsStatus}
          onRefresh={handleRefresh}
        />

        {view === 'dashboard' && (
          <DashboardView
            data={data}
            agents={agents}
            activity={activity}
            loading={loading}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        )}

        {view === 'agents' && (
          <AgentsView agents={agents} loading={loading} />
        )}

        {view !== 'dashboard' && view !== 'agents' && (
          <div style={{ padding: 24 }}>
            <div style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
              View &quot;{view}&quot; not found.{' '}
              <button
                onClick={() => navigate('dashboard')}
                style={{
                  color: 'var(--accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  textDecoration: 'underline',
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

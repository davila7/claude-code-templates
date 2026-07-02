import React, { useEffect, useState } from 'react';

interface Session {
  startTime: string;
  endTime?: string;
  duration: number;
  messageCount: number;
  conversationCount: number;
}

interface SessionTimerProps {
  sessionData?: {
    sessions?: Session[];
    totalSessions?: number;
    currentSession?: Session;
    avgSessionLength?: number;
  };
  loading?: boolean;
}

function fmtDuration(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function SessionTimer({ sessionData, loading }: SessionTimerProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ minHeight: 110 }}>
        <div className="skeleton" style={{ height: 11, width: '40%', marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 36, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 11, width: '55%' }} />
      </div>
    );
  }

  const total = sessionData?.totalSessions ?? 0;
  const avg = sessionData?.avgSessionLength;
  const recentSessions = (sessionData?.sessions ?? []).slice(0, 3);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="text-label">⏱ Sessions</span>
        <span
          className="font-mono"
          style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}
        >
          {total.toLocaleString()}
        </span>
      </div>

      {/* Avg duration */}
      {avg != null && (
        <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
          Avg duration: <span className="font-mono" style={{ color: 'var(--ink)' }}>{fmtDuration(avg)}</span>
        </div>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            borderTop: '1px solid var(--border)',
            paddingTop: 10,
            marginTop: 2,
          }}
        >
          <span className="text-label" style={{ marginBottom: 2 }}>Recent</span>
          {recentSessions.map((s, i) => (
            <div
              key={i}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, gap: 8 }}
            >
              <span style={{ color: 'var(--ink-muted)' }}>
                {new Date(s.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="font-mono" style={{ color: 'var(--ink)' }}>
                {s.messageCount} msgs · {fmtDuration(s.duration)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>No session data yet</div>
      )}
    </div>
  );
}

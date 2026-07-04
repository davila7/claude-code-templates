import React, { useEffect, useRef } from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;          // % change vs prev period (positive = up, negative = down)
  icon?: string;           // emoji prefix
  sparklineData?: number[];
  loading?: boolean;
}

export function KPICard({ label, value, sub, delta, icon, sparklineData, loading }: KPICardProps) {
  const sparkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sparklineData?.length || !sparkRef.current) return;
    let chart: any;
    import('../lib/charts').then(({ createChart, sparklineOption, getThemeColors }) => {
      if (!sparkRef.current) return;
      chart = createChart(sparkRef.current, sparklineOption(sparklineData!, getThemeColors()));
    });
    return () => chart?.dispose();
  }, [sparklineData]);

  if (loading) {
    return (
      <div className="card" style={{ minHeight: 110 }}>
        <div className="skeleton" style={{ height: 11, width: '55%', marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 44, width: '70%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 11, width: '40%' }} />
      </div>
    );
  }

  const deltaColor = delta == null
    ? 'var(--ink-muted)'
    : delta > 0 ? 'var(--green)' : 'var(--red)';
  const deltaSign = delta != null && delta > 0 ? '+' : '';
  const formattedValue =
    typeof value === 'number' ? value.toLocaleString() : (value ?? '—');

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="text-label">
          {icon && <span style={{ marginRight: 5 }}>{icon}</span>}
          {label}
        </span>
        {delta != null && (
          <span
            className="font-mono"
            style={{ fontSize: 11, color: deltaColor, background: deltaColor + '18', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}
          >
            {deltaSign}{delta.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div className="text-kpi">{formattedValue}</div>

      {/* Sub-label */}
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{sub}</div>
      )}

      {/* Sparkline */}
      {sparklineData?.length ? (
        <div ref={sparkRef} style={{ height: 40, marginTop: 4 }} />
      ) : null}
    </div>
  );
}

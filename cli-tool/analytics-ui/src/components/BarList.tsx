import React from 'react';

export interface BarListItem {
  name: string;
  value: number;
  label?: string;   // pre-formatted string (e.g. "1.2M")
  color?: string;   // CSS color; defaults to --accent
}

interface BarListProps {
  items: BarListItem[];
  maxItems?: number;
  valueLabel?: string;
  loading?: boolean;
}

export function BarList({ items, maxItems = 8, valueLabel = 'Count', loading }: BarListProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[80, 65, 55, 40, 30].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="skeleton" style={{ height: 11, width: `${w * 0.4}%` }} />
            <div className="skeleton" style={{ height: 6, flex: 1 }} />
            <div className="skeleton" style={{ height: 11, width: 36 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div style={{ color: 'var(--ink-subtle)', fontSize: 13, padding: '12px 0' }}>
        No data available
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, maxItems);
  const rest = sorted.slice(maxItems);

  if (rest.length > 0) {
    shown.push({
      name: `Other (${rest.length})`,
      value: rest.reduce((s, r) => s + r.value, 0),
      color: 'var(--ink-subtle)',
    });
  }

  const max = Math.max(...shown.map(i => i.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Column headers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="text-label">Name</span>
        <span className="text-label">{valueLabel}</span>
      </div>

      {shown.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '5px 0',
            borderBottom: idx < shown.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          }}
        >
          {/* Name */}
          <span
            style={{
              fontSize: 12,
              color: 'var(--ink)',
              minWidth: 90,
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={item.name}
          >
            {item.name}
          </span>

          {/* Bar track */}
          <div
            style={{
              flex: 1,
              background: 'var(--bg-secondary)',
              borderRadius: 2,
              height: 5,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(item.value / max) * 100}%`,
                height: '100%',
                background: item.color || 'var(--accent)',
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* Value */}
          <span
            className="font-mono"
            style={{ fontSize: 11, color: 'var(--ink-muted)', minWidth: 44, textAlign: 'right' }}
          >
            {item.label ?? item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

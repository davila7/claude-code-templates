import React from 'react';

export type TimeRange = '7d' | '30d' | '90d' | 'all';

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d',  label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

export function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-sm)',
        padding: 2,
        border: '1px solid var(--border)',
      }}
    >
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '3px 10px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: value === opt.value ? 600 : 400,
            background: value === opt.value ? 'var(--bg-card)' : 'transparent',
            color: value === opt.value ? 'var(--ink)' : 'var(--ink-muted)',
            boxShadow: value === opt.value ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.12s ease',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

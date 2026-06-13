import React, { useEffect, useRef } from 'react';

interface ActivityHeatmapProps {
  data: Array<{ date: string; value: number }>;
  loading?: boolean;
  year?: number;
}

export function ActivityHeatmap({ data, loading, year }: ActivityHeatmapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const targetYear = year ?? new Date().getFullYear();

  useEffect(() => {
    if (loading || !ref.current) return;

    let mounted = true;
    import('../lib/charts').then(({ createChart, activityHeatmapOption, getThemeColors }) => {
      if (!mounted || !ref.current) return;
      chartRef.current?.dispose();
      const yearData = (data || []).filter(d => d.date.startsWith(String(targetYear)));
      const colors = getThemeColors();
      chartRef.current = createChart(ref.current, activityHeatmapOption(yearData, colors, targetYear));
    });

    return () => {
      mounted = false;
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [data, loading, targetYear]);

  if (loading) {
    return <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-sm)' }} />;
  }

  return (
    <div>
      <div ref={ref} style={{ height: 160, width: '100%' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>Less</span>
        {[0.1, 0.3, 0.5, 0.75, 1].map((op, i) => (
          <div
            key={i}
            style={{
              width: 10, height: 10, borderRadius: 2,
              background: `rgba(249, 115, 22, ${op})`,
            }}
          />
        ))}
        <span style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>More</span>
      </div>
    </div>
  );
}

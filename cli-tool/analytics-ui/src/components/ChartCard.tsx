import React, { useEffect, useRef, useCallback } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  height?: number | string;
  loading?: boolean;
  children?: React.ReactNode;       // for non-ECharts content (BarList etc.)
  getOption?: () => any;            // ECharts option factory (sync or returns Promise)
  className?: string;
  style?: React.CSSProperties;
}

export function ChartCard({
  title,
  subtitle,
  height = 220,
  loading,
  children,
  getOption,
  className = '',
  style,
}: ChartCardProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  const initChart = useCallback(async () => {
    if (!canvasRef.current || !getOption) return;
    const { createChart } = await import('../lib/charts');
    const optionOrPromise = getOption();
    const option = optionOrPromise && typeof optionOrPromise.then === 'function'
      ? await optionOrPromise
      : optionOrPromise;
    if (!option || Object.keys(option).length === 0) return;
    if (chartRef.current) {
      chartRef.current.setOption(option, { notMerge: true });
    } else if (canvasRef.current) {
      chartRef.current = createChart(canvasRef.current, option);
    }
  }, [getOption]);

  useEffect(() => {
    if (!getOption || !canvasRef.current) return;

    // Lazy-init via IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        initChart();
      },
      { threshold: 0.1 },
    );
    observer.observe(canvasRef.current);

    return () => {
      observer.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []); // only on mount/unmount

  // Re-draw when getOption changes (data refresh)
  useEffect(() => {
    if (chartRef.current && getOption) {
      initChart();
    }
  }, [initChart]);

  return (
    <div className={`card ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: 14, ...style }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>

      {/* Content */}
      {loading ? (
        <div className="skeleton" style={{ height: height === 'auto' ? 160 : height, borderRadius: 'var(--radius-sm)' }} />
      ) : getOption ? (
        <div ref={canvasRef} style={{ height }} />
      ) : (
        children
      )}
    </div>
  );
}

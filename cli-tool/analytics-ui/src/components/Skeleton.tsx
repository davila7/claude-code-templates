import React from 'react';

interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ height = 16, width = '100%', className = '', style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height, width, ...style }}
    />
  );
}

export function KPICardSkeleton() {
  return (
    <div className="card" style={{ minHeight: 110 }}>
      <Skeleton height={11} width="55%" style={{ marginBottom: 14 }} />
      <Skeleton height={44} width="70%" style={{ marginBottom: 10 }} />
      <Skeleton height={11} width="40%" />
    </div>
  );
}

export function ChartCardSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="card">
      <Skeleton height={12} width="40%" style={{ marginBottom: 16 }} />
      <Skeleton height={height} />
    </div>
  );
}

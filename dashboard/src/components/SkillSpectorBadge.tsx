import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SkillSpectorResult } from '../lib/types';

// Traffic light for the NVIDIA SkillSpector static scan of a component.
// Display-only: the catalog never sorts or filters on it.

const LIGHTS = [
  { key: 'LOW', color: '#22c55e' },
  { key: 'MEDIUM', color: '#f59e0b' },
  { key: 'HIGH', color: '#ef4444' },
] as const;

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#dc2626',
};

const RECOMMENDATION_LABEL: Record<string, string> = {
  SAFE: 'Safe',
  CAUTION: 'Review before installing',
  DO_NOT_INSTALL: 'Do not install without review',
};

function lightIndex(severity: string): number {
  if (severity === 'LOW') return 0;
  if (severity === 'MEDIUM') return 1;
  return 2;
}

interface Props {
  result?: SkillSpectorResult | null;
  size?: 'sm' | 'md';
}

export default function SkillSpectorBadge({ result, size = 'sm' }: Props) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    const width = 340;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    // Open upwards when the detail would not fit below the badge.
    if (window.innerHeight - r.bottom > 480 || r.top < window.innerHeight - r.bottom) {
      setPos({ top: r.bottom + 6, left });
    } else {
      setPos({ bottom: window.innerHeight - r.top + 6, left });
    }
  }, [open]);

  if (!result) return null;

  const severity = (result.severity || 'LOW').toUpperCase();
  const lit = lightIndex(severity);
  const color = SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.LOW;
  const md = size === 'md';

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <>
      <span
        ref={anchor}
        role="button"
        tabIndex={0}
        aria-label={`NVIDIA SkillSpector Scanner: ${severity} risk, score ${result.score} of 100`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          // Cards navigate on click; the badge only toggles its detail.
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center gap-1.5 font-mono font-semibold border cursor-help select-none whitespace-nowrap ${
          md ? 'text-xs px-3 py-1.5 rounded-full shadow-sm' : 'text-[10px] px-2 py-0.5 rounded'
        }`}
        style={{
          color,
          borderColor: `${color}55`,
          backgroundColor: `${color}14`,
        }}
      >
        <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
          {LIGHTS.map((l, i) => (
            <span
              key={l.key}
              className={`${md ? 'w-2 h-2' : 'w-1.5 h-1.5'} rounded-full`}
              style={
                i === lit
                  ? { backgroundColor: l.color, boxShadow: `0 0 6px ${l.color}` }
                  : { backgroundColor: 'var(--color-text-tertiary)', opacity: 0.25 }
              }
            />
          ))}
        </span>
        NVIDIA SkillSpector Scanner
      </span>

      {open && pos && typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[1000] w-[340px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-2xl text-left"
            style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}
          >
            <div className="px-4 pt-3 pb-2 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  NVIDIA SkillSpector Scanner
                </span>
                <span
                  className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color, backgroundColor: `${color}1f` }}
                >
                  {severity}
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold" style={{ color }}>{result.score}</span>
                <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">/ 100 risk score</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, result.score)}%`, backgroundColor: color }} />
              </div>
              <p className="mt-2 text-[12px] text-[var(--color-text-primary)]">
                {RECOMMENDATION_LABEL[result.recommendation] ?? result.recommendation}
                {result.analysis === 'partial' && (
                  <span className="text-[var(--color-text-tertiary)]"> (partial analysis)</span>
                )}
                <span className="text-[var(--color-text-tertiary)]">
                  {' · '}{result.issueCount} {result.issueCount === 1 ? 'finding' : 'findings'}
                </span>
              </p>
            </div>

            {result.findings.length > 0 && (
              <ul className="px-4 py-2.5 space-y-2 max-h-[180px] overflow-y-auto">
                {result.findings.map((f, i) => (
                  <li key={i} className="flex gap-2 text-[11px] leading-snug">
                    <span
                      className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: SEVERITY_COLOR[f.severity] ?? SEVERITY_COLOR.LOW }}
                    />
                    <span className="min-w-0">
                      <span className="text-[var(--color-text-primary)]">{f.title}</span>
                      {f.count > 1 && (
                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]"> ×{f.count}</span>
                      )}
                      <span className="block font-mono text-[10px] text-[var(--color-text-tertiary)] truncate">
                        {f.category} · {f.file}{f.line ? `:${f.line}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
              Static analysis (no LLM) by{' '}
              <a
                href="https://github.com/NVIDIA/skillspector"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--color-text-primary)]"
              >
                NVIDIA SkillSpector
              </a>
              {result.version ? ` v${result.version}` : ''}
              {result.scannedAt ? ` · ${result.scannedAt.slice(0, 10)}` : ''}. Bands: 0-20 low, 21-50 medium, 51+ high.
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

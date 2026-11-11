import type { SkillSpectorResult } from '../lib/types';

// "Scanned by NVIDIA SkillSpector" seal. Neutral on purpose: it says the
// component went through the scan, not how risky it is; the report on the
// component page carries the detail. Display-only: the catalog never sorts
// or filters on it.

interface Props {
  result?: SkillSpectorResult | null;
  size?: 'sm' | 'md';
  // Anchor of the report section on the component page.
  href?: string;
}

export function ShieldCheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default function SkillSpectorBadge({ result, size = 'sm', href }: Props) {
  if (!result) return null;
  const md = size === 'md';
  const className = `inline-flex items-center gap-1.5 font-mono font-semibold border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] ${
    // md sits beside the component icon: on a phone the label may not fit on one line, so it wraps instead of being clipped
    md ? 'max-w-full text-xs leading-snug px-3 py-1.5 rounded-2xl sm:whitespace-nowrap sm:rounded-full shadow-sm hover:text-[var(--color-text-primary)] transition-colors' : 'whitespace-nowrap text-[10px] px-2 py-0.5 rounded'
  }`;
  const body = (
    <>
      <ShieldCheckIcon className={`${md ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-[var(--color-accent)] shrink-0`} />
      Scanned by NVIDIA SkillSpector
    </>
  );
  const title = `Scanned by NVIDIA SkillSpector${result.version ? ` v${result.version}` : ''}${
    result.scannedAt ? ` on ${result.scannedAt.slice(0, 10)}` : ''
  }`;
  return href ? (
    <a href={href} className={className} title={title}>{body}</a>
  ) : (
    <span className={className} title={title}>{body}</span>
  );
}

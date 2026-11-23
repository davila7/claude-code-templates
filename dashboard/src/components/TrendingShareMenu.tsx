import { useEffect, useRef, useState } from 'react';
import { track } from '../lib/analytics';
import { badgeMarkdown, linkedInShareUrl, xShareUrl } from '../lib/trending-share';

interface Props {
  /** Absolute URL to share. */
  url: string;
  text: string;
  /** Set for a component: adds "Copy README badge". */
  component?: { type: string; path: string };
  source: 'trending' | 'share_page';
  label?: string;
  compact?: boolean;
}

async function copy(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function TrendingShareMenu({ url, text, component, source, label = 'Share', compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'link' | 'badge' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const componentRef = component ? { component_type: component.type, component_path: component.path } : {};
  const send = (method: 'x' | 'linkedin' | 'copy_link' | 'copy_badge') =>
    track('share_trending', { target: component ? 'component' : 'page', method, source, ...componentRef });

  const onCopy = async (kind: 'link' | 'badge') => {
    const origin = new URL(url).origin;
    const ok = await copy(kind === 'link' ? url : badgeMarkdown(origin, component!.type, component!.path));
    if (!ok) return;
    send(kind === 'link' ? 'copy_link' : 'copy_badge');
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  };

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] rounded-md';

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `${label}: ${text}` : undefined}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/40 transition-colors ${compact ? 'p-1.5' : 'px-3 py-1.5 text-[12px] font-medium'}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" />
        </svg>
        {!compact && label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-1 shadow-lg">
          <a role="menuitem" className={item} href={xShareUrl(text, url)} target="_blank" rel="noopener noreferrer" onClick={() => send('x')}>Post on X</a>
          <a role="menuitem" className={item} href={linkedInShareUrl(url)} target="_blank" rel="noopener noreferrer" onClick={() => send('linkedin')}>Share on LinkedIn</a>
          <button role="menuitem" type="button" className={item} onClick={() => onCopy('link')}>{copied === 'link' ? 'Link copied' : 'Copy link'}</button>
          {component && (
            <button role="menuitem" type="button" className={item} onClick={() => onCopy('badge')}>{copied === 'badge' ? 'Badge copied' : 'Copy README badge'}</button>
          )}
        </div>
      )}
    </div>
  );
}

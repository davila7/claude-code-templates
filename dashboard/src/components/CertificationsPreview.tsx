import { useEffect, useState } from 'react';
import { formatPrice, isHttpUrl, sortItems, type CertificationsData } from '../lib/certifications';
import { useGlobalAuth } from '../lib/use-global-auth';

// Home right sidebar, bottom half: same look and sign-in gate as the jobs list above it.
export default function CertificationsPreview() {
  const [data, setData] = useState<CertificationsData | null>(null);
  const { isSignedIn, isLoaded } = useGlobalAuth();

  useEffect(() => {
    fetch('/claude-certifications.json')
      .then((r) => r.json())
      .then((d: CertificationsData) => setData({ ...d, items: sortItems(d.items.filter((i) => isHttpUrl(i.url))) }))
      .catch(() => {});
  }, []);

  if (!data || data.items.length === 0) return null;

  const open = isLoaded && isSignedIn;
  const showAuthGate = isLoaded && !isSignedIn;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-0)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Certifications</span>
            <span className="font-mono text-[9px] font-medium bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20">
              {data.items.length}
            </span>
          </div>
          <a href="/certifications" className="font-mono text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors">
            view all →
          </a>
        </div>
        <p className="font-mono text-[9px] text-[var(--color-text-tertiary)] mt-0.5">Certifications &amp; courses</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {data.items.slice(0, 12).map((item) => (
          <a
            key={item.id}
            href={open ? item.url : '#'}
            target={open ? '_blank' : undefined}
            rel={open ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              if (open) return;
              e.preventDefault();
              if (isLoaded) (window as any).Clerk?.openSignIn?.();
            }}
            className="block p-2.5 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-card-bg)] hover:bg-[var(--color-card-hover)] transition-all group relative overflow-hidden"
          >
            {showAuthGate && (
              <div className="absolute inset-0 bg-[var(--color-surface-0)]/80 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="font-mono text-[9px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] px-2 py-1 rounded border border-[var(--color-border)]">
                  Sign in to view
                </span>
              </div>
            )}
            <p className="font-mono text-[10px] font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-2 leading-tight mb-1">
              {item.title}
            </p>
            <p className="font-mono text-[9px] text-[var(--color-text-tertiary)] truncate mb-1.5">{item.provider}</p>
            <div className="flex items-center gap-1 flex-wrap">
              {item.level && (
                <span className="text-[8px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] px-1 py-0.5 rounded border border-[var(--color-border)]">{item.level}</span>
              )}
              <span className="text-[8px] font-medium bg-[var(--color-accent-light)] text-[var(--color-accent)] px-1 py-0.5 rounded border border-[var(--color-border)]">
                {formatPrice(item.price)}
              </span>
              {item.eligibility === 'partners' && (
                <span className="text-[8px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] px-1 py-0.5 rounded border border-[var(--color-border)]">Partners</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

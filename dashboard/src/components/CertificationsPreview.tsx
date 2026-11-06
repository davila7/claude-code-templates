import { useCallback, useEffect, useState } from 'react';
import CertificationModal from './CertificationModal';
import CompanyLogo from './CompanyLogo';
import { fetchCertifications, formatPrice, type CertificationsData, type LearningItem } from '../lib/certifications';
import { useGlobalAuth } from '../lib/use-global-auth';

// Home right sidebar, bottom half: same look as the jobs list above it. A click
// opens the details; the sign-in gate is on the provider links inside them.
export default function CertificationsPreview() {
  const [data, setData] = useState<CertificationsData | null>(null);
  const [selected, setSelected] = useState<LearningItem | null>(null);
  const { isSignedIn, isLoaded } = useGlobalAuth();
  const close = useCallback(() => setSelected(null), []);

  useEffect(() => {
    fetchCertifications().then(setData).catch(() => {});
  }, []);

  if (!data || data.items.length === 0) return null;

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
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="w-full text-left flex items-start gap-2.5 p-2.5 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-card-bg)] hover:bg-[var(--color-card-hover)] transition-all group"
          >
            <div className="w-6 h-6 rounded shrink-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden mt-0.5">
              <CompanyLogo company={item.provider} icon={data.providers[item.provider]?.icon} imgClassName="w-3.5 h-3.5 object-contain" initialClassName="text-[9px] font-bold text-[var(--color-text-tertiary)]" />
            </div>
            <div className="min-w-0 flex-1">
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
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <CertificationModal item={selected} provider={data.providers[selected.provider]} signedIn={isSignedIn} loaded={isLoaded} onClose={close} />
      )}
    </div>
  );
}

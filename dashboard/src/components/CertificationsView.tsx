import { useCallback, useEffect, useMemo, useState } from 'react';
import CertificationModal, { LockIcon } from './CertificationModal';
import CompanyLogo from './CompanyLogo';
import { useGlobalAuth } from '../lib/use-global-auth';
import {
  fetchCertifications,
  formatPrice,
  type CertificationsData,
  type LearningItem,
  type ProviderInfo,
} from '../lib/certifications';

const KIND_LABEL: Record<string, string> = { certification: 'Certifications', course: 'Courses' };

function unique(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function CertificationCard({ item, provider, onOpen }: { item: LearningItem; provider?: ProviderInfo; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-3 hover:border-[var(--color-accent)] hover:bg-[var(--color-card-hover)] transition-all group"
    >
      <div className="w-8 h-8 rounded shrink-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
        <CompanyLogo company={item.provider} icon={provider?.icon} imgClassName="w-4 h-4 object-contain" initialClassName="text-[11px] font-bold text-[var(--color-text-tertiary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-semibold leading-snug text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">{item.title}</h2>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)] truncate">{item.provider}</p>
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {item.category && (
            <span className="text-[10px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{item.category}</span>
          )}
          {item.level && (
            <span className="text-[10px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{item.level}</span>
          )}
          <span className="text-[10px] font-medium bg-[var(--color-accent-light)] text-[var(--color-accent)] px-1.5 py-0.5 rounded border border-[var(--color-border)] tabular-nums">
            {formatPrice(item.price)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function CertificationsView() {
  const [data, setData] = useState<CertificationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [level, setLevel] = useState<string>('all');
  const [selected, setSelected] = useState<LearningItem | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const { isSignedIn, isLoaded } = useGlobalAuth();

  useEffect(() => {
    fetchCertifications()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = data?.items ?? [];
  const providers = useMemo(() => unique(items.map((i) => i.provider)), [items]);
  const kinds = useMemo(() => unique(items.map((i) => i.kind)), [items]);
  const categories = useMemo(() => unique(items.map((i) => i.category)), [items]);
  const levels = useMemo(() => unique(items.map((i) => i.level)), [items]);
  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (provider === 'all' || i.provider === provider) &&
          (kind === 'all' || i.kind === kind) &&
          (category === 'all' || i.category === category) &&
          (level === 'all' || i.level === level),
      ),
    [items, provider, kind, category, level],
  );

  if (loading) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[var(--color-text-tertiary)]">Loading certifications...</span>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="px-6 py-24 text-center">
        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-2">No certifications listed yet</h2>
        <p className="text-[13px] text-[var(--color-text-secondary)]">Check back soon.</p>
      </div>
    );
  }

  const showGate = isLoaded && !isSignedIn;
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
      active
        ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] shadow-sm'
        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
    }`;
  const group = (options: string[], value: string, onChange: (v: string) => void, allLabel: string, label: (o: string) => string = (o) => o) => (
    <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5">
      {['all', ...options].map((o) => (
        <button key={o} onClick={() => onChange(o)} className={chip(value === o)}>
          {o === 'all' ? allLabel : label(o)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl">
      <div className="px-6 pt-5 pb-2">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Certifications & Courses</h1>
        <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1 max-w-3xl">
          Certifications and courses for AI developer tools, in one place.
          We list them; registration and payment happen on the provider's site.
        </p>
      </div>

      {showGate && (
        <div className="mx-6 mt-2 mb-1 border border-[var(--color-border)] bg-[var(--color-accent-light)] rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-[var(--color-accent)] shrink-0"><LockIcon className="w-5 h-5" /></span>
          <p className="flex-1 text-[13px] text-[var(--color-text-primary)]">
            <span className="font-medium">Sign in</span>
            <span className="text-[var(--color-text-secondary)]"> to open registration, prep courses and exam guides</span>
          </p>
          <button
            onClick={() => (window as any).Clerk?.openSignIn?.()}
            className="px-3 py-1.5 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-4)] text-[12px] font-medium text-[var(--color-text-primary)] rounded-md transition-colors"
          >
            Sign In
          </button>
        </div>
      )}

      <div className="px-6 py-4 flex flex-wrap items-center gap-2">
        {group(providers, provider, setProvider, 'All providers')}
        {kinds.length > 1 && group(kinds, kind, setKind, 'All types', (k) => KIND_LABEL[k] ?? k)}
        {group(categories, category, setCategory, 'All categories')}
        {group(levels, level, setLevel, 'All levels')}
        <span className="ml-auto text-[12px] text-[var(--color-text-tertiary)]">
          {visible.length} of {data.items.length}
        </span>
      </div>

      {visible.length > 0 ? (
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {visible.map((item) => (
            <CertificationCard key={item.id} item={item} provider={data.providers[item.provider]} onOpen={() => setSelected(item)} />
          ))}
        </div>
      ) : (
        <p className="px-6 pb-10 pt-6 text-center text-[13px] text-[var(--color-text-tertiary)]">Nothing matches these filters.</p>
      )}

      {selected && (
        <CertificationModal item={selected} provider={data.providers[selected.provider]} signedIn={isSignedIn} loaded={isLoaded} onClose={close} />
      )}

      <p className="px-6 pb-8 text-center text-[11px] text-[var(--color-text-tertiary)]">
        Last updated:{' '}
        {new Date(data.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        {' | '}Sources: {data.sources.join(', ')}. Prices and terms are set by each provider.
      </p>
    </div>
  );
}

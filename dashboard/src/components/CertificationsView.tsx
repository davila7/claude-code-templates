import { useCallback, useEffect, useMemo, useState } from 'react';
import CertificationModal, { LockIcon } from './CertificationModal';
import CompanyLogo from './CompanyLogo';
import FacetFilter from './FacetFilter';
import { useGlobalAuth } from '../lib/use-global-auth';
import {
  EMPTY_SELECTION,
  facetOptions,
  fetchCertifications,
  formatPrice,
  isUsefulFacet,
  matchesQuery,
  matchesSelection,
  type CertificationsData,
  type FacetKey,
  type FacetSelection,
  type LearningItem,
  type ProviderInfo,
} from '../lib/certifications';

const KIND_LABEL: Record<string, string> = { certification: 'Certification', course: 'Course' };
const FACETS: { key: FacetKey; label: string }[] = [
  { key: 'categories', label: 'Category' },
  { key: 'provider', label: 'Provider' },
  { key: 'level', label: 'Level' },
  { key: 'kind', label: 'Type' },
];
const MAX_CARD_CATEGORIES = 2;

const tagClass = 'text-[10px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]';

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
          {item.categories.slice(0, MAX_CARD_CATEGORIES).map((c) => (
            <span key={c} className={tagClass}>{c}</span>
          ))}
          {item.categories.length > MAX_CARD_CATEGORIES && (
            <span className={tagClass}>+{item.categories.length - MAX_CARD_CATEGORIES}</span>
          )}
          {item.level && <span className={tagClass}>{item.level}</span>}
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
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<FacetSelection>(EMPTY_SELECTION);
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
  const facets = useMemo(() => FACETS.filter((f) => isUsefulFacet(items, f.key)), [items]);
  const visible = useMemo(
    () => items.filter((i) => matchesQuery(i, query) && matchesSelection(i, selection)),
    [items, query, selection],
  );
  const hasFilters = query.trim() !== '' || FACETS.some((f) => selection[f.key].length > 0);
  const clearAll = () => {
    setQuery('');
    setSelection(EMPTY_SELECTION);
  };
  const toggle = (key: FacetKey, value: string) =>
    setSelection((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value],
    }));
  const optionLabel = (key: FacetKey, value: string) => (key === 'kind' ? KIND_LABEL[value] ?? value : value);

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

      <div className="px-6 pt-4 pb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search certifications..."
              aria-label="Search certifications and courses"
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] pl-8 pr-3 py-1.5 focus:outline-none focus:border-[var(--color-border-hover)]"
            />
          </div>
          {facets.map((f) => (
            <FacetFilter
              key={f.key}
              label={f.label}
              options={facetOptions(items, f.key, selection, query)}
              selected={selection[f.key]}
              onToggle={(value) => toggle(f.key, value)}
              onClear={() => setSelection((prev) => ({ ...prev, [f.key]: [] }))}
              optionLabel={(value) => optionLabel(f.key, value)}
              optionIcon={f.key === 'provider' ? (value) => (
                <CompanyLogo company={value} icon={data.providers[value]?.icon} imgClassName="w-3.5 h-3.5 object-contain" initialClassName="text-[9px] font-bold text-[var(--color-text-tertiary)]" />
              ) : undefined}
            />
          ))}
          <span className="ml-auto text-[12px] text-[var(--color-text-tertiary)] tabular-nums">
            {visible.length} {visible.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {FACETS.flatMap((f) =>
              selection[f.key].map((value) => (
                <button
                  key={`${f.key}:${value}`}
                  onClick={() => toggle(f.key, value)}
                  aria-label={`Remove filter ${optionLabel(f.key, value)}`}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-colors"
                >
                  {optionLabel(f.key, value)}
                  <span aria-hidden="true">×</span>
                </button>
              )),
            )}
            <button onClick={clearAll} className="px-1 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
              Clear all
            </button>
          </div>
        )}
      </div>

      {visible.length > 0 ? (
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {visible.map((item) => (
            <CertificationCard key={item.id} item={item} provider={data.providers[item.provider]} onOpen={() => setSelected(item)} />
          ))}
        </div>
      ) : (
        <p className="px-6 pb-10 pt-6 text-center text-[13px] text-[var(--color-text-tertiary)]">Nothing matches your search and filters.</p>
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

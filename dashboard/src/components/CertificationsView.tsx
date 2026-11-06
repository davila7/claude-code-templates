import { useEffect, useMemo, useState } from 'react';
import { useGlobalAuth } from '../lib/use-global-auth';
import {
  formatPrice,
  isHttpUrl,
  sortItems,
  type CertificationsData,
  type LearningItem,
} from '../lib/certifications';

// Same sign-in gate as /jobs (JobsView.tsx): the list is public, opening a
// certification or course needs an aitmpl.com account.

const KIND_LABEL: Record<string, string> = { certification: 'Certifications', course: 'Courses' };

function LockIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

interface GatedLinkProps {
  href?: string;
  signedIn: boolean;
  loaded: boolean;
  primary?: boolean;
  children: React.ReactNode;
}

function GatedLink({ href, signedIn, loaded, primary, children }: GatedLinkProps) {
  if (!isHttpUrl(href)) return null;
  const open = loaded && signedIn;
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors';
  const look = primary
    ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
    : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]';
  return (
    <a
      href={open ? href : '#'}
      target={open ? '_blank' : undefined}
      rel={open ? 'noopener noreferrer' : undefined}
      onClick={(e) => {
        if (open) return;
        e.preventDefault();
        if (loaded) (window as any).Clerk?.openSignIn?.();
      }}
      className={`${base} ${look}`}
    >
      {children}
      {open ? <ExternalIcon /> : <LockIcon />}
    </a>
  );
}

function CertificationCard({ item, signedIn, loaded }: { item: LearningItem; signedIn: boolean; loaded: boolean }) {
  return (
    <article className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 hover:border-[var(--color-border-hover)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="font-ui-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
          {[item.provider, item.track, item.level].filter(Boolean).join(' · ')}
        </p>
        <span className="font-ui-mono text-[13px] font-semibold text-[var(--color-text-primary)] tabular-nums shrink-0">
          {formatPrice(item.price)}
        </span>
      </div>

      <h2 className="mt-2 text-[15px] font-semibold leading-snug text-[var(--color-text-primary)]">{item.title}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{item.description}</p>
      {item.audience && (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-tertiary)]">
          <span className="text-[var(--color-text-secondary)]">For: </span>
          {item.audience}
        </p>
      )}

      {item.topics.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {item.topics.map((t) => (
            <li key={t} className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
              {t}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-3 text-[12px]">
        {item.format && (
          <div>
            <dt className="text-[var(--color-text-tertiary)]">Format</dt>
            <dd className="text-[var(--color-text-secondary)]">{item.format}</dd>
          </div>
        )}
        {item.credential && (
          <div>
            <dt className="text-[var(--color-text-tertiary)]">Credential</dt>
            <dd className="text-[var(--color-text-secondary)]">{item.credential}</dd>
          </div>
        )}
        <div>
          <dt className="text-[var(--color-text-tertiary)]">Who can take it</dt>
          <dd className="text-[var(--color-text-secondary)]">
            {item.eligibility === 'partners' ? 'Claude Partner Network members' : 'Anyone'}
          </dd>
        </div>
        {item.platform && (
          <div>
            <dt className="text-[var(--color-text-tertiary)]">Hosted on</dt>
            <dd className="text-[var(--color-text-secondary)]">{item.platform}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <GatedLink href={item.url} signedIn={signedIn} loaded={loaded} primary>
          {item.kind === 'certification' ? 'Register' : 'Start course'}
        </GatedLink>
        <GatedLink href={item.prepUrl} signedIn={signedIn} loaded={loaded}>
          Prep courses{item.prepCourses ? ` (${item.prepCourses})` : ''}
        </GatedLink>
        <GatedLink href={item.examGuideUrl} signedIn={signedIn} loaded={loaded}>
          Exam guide
        </GatedLink>
      </div>
    </article>
  );
}

export default function CertificationsView() {
  const [data, setData] = useState<CertificationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<string>('all');
  const [track, setTrack] = useState<string>('all');
  const { isSignedIn, isLoaded } = useGlobalAuth();

  useEffect(() => {
    fetch('/claude-certifications.json')
      .then((r) => r.json())
      .then((d: CertificationsData) => {
        setData({ ...d, items: sortItems(d.items.filter((i) => isHttpUrl(i.url))) });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const kinds = useMemo(() => Array.from(new Set(data?.items.map((i) => i.kind) ?? [])), [data]);
  const tracks = useMemo(
    () => Array.from(new Set(data?.items.filter((i) => kind === 'all' || i.kind === kind).map((i) => i.track).filter(Boolean) as string[])),
    [data, kind],
  );
  const visible = useMemo(
    () => (data?.items ?? []).filter((i) => (kind === 'all' || i.kind === kind) && (track === 'all' || i.track === track)),
    [data, kind, track],
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

  return (
    <div className="max-w-6xl">
      <div className="px-6 pt-5 pb-2">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Certifications & Courses</h1>
        <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1 max-w-3xl">
          Official certifications and courses for Claude, Claude Code, the Claude API and MCP, in one place.
          We list them; registration and payment happen on the provider's site.
        </p>
      </div>

      {showGate && (
        <div className="mx-6 mt-2 mb-1 border border-[var(--color-border)] bg-[var(--color-accent-light)] rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-[var(--color-accent)] shrink-0"><LockIcon className="w-5 h-5" /></span>
          <p className="flex-1 text-[13px] text-[var(--color-text-primary)]">
            <span className="font-medium">Sign in</span>
            <span className="text-[var(--color-text-secondary)]"> to open certifications, prep courses and exam guides</span>
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
        {kinds.length > 1 && (
          <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5">
            {['all', ...kinds].map((k) => (
              <button key={k} onClick={() => { setKind(k); setTrack('all'); }} className={chip(kind === k)}>
                {k === 'all' ? 'All' : KIND_LABEL[k] ?? k}
              </button>
            ))}
          </div>
        )}
        {tracks.length > 1 && (
          <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5">
            {['all', ...tracks].map((t) => (
              <button key={t} onClick={() => setTrack(t)} className={chip(track === t)}>
                {t === 'all' ? 'All roles' : t}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-[12px] text-[var(--color-text-tertiary)]">
          {visible.length} of {data.items.length}
        </span>
      </div>

      <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.map((item) => (
          <CertificationCard key={item.id} item={item} signedIn={isSignedIn} loaded={isLoaded} />
        ))}
      </div>

      {data.items.some((i) => i.provider === 'Anthropic' && i.kind === 'certification') && (
        <section className="mx-6 mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">How Claude certification works</h2>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)] list-disc pl-5">
            <li>Exams are proctored by Pearson VUE, online or at a test center. You need to be 18 or older with a government-issued ID.</li>
            <li>Scores run from 100 to 1,000 and 720 passes. Passing earns a Credly badge, valid for 12 months.</li>
            <li>
              Registration is open to members of the{' '}
              <a href="https://claude.com/partners" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-primary)] underline decoration-[var(--color-border-hover)] hover:text-[var(--color-accent)]">Claude Partner Network</a>
              , signing in with a company email. Not a partner?{' '}
              <a href="https://academy.claude.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-primary)] underline decoration-[var(--color-border-hover)] hover:text-[var(--color-accent)]">Claude Academy</a>
              {' '}is free and ends each course with a certificate of completion.
            </li>
          </ul>
        </section>
      )}

      <p className="px-6 pb-8 text-center text-[11px] text-[var(--color-text-tertiary)]">
        Last updated:{' '}
        {new Date(data.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        {' | '}Sources: {data.sources.join(', ')}. Prices and terms are set by each provider.
      </p>
    </div>
  );
}

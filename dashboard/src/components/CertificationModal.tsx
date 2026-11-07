import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CompanyLogo from './CompanyLogo';
import { formatPrice, isHttpUrl, type LearningItem, type ProviderInfo } from '../lib/certifications';

// Same sign-in gate as /jobs (JobsView.tsx): the details are public, following
// a link to the provider needs an aitmpl.com account.

export function LockIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
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

interface Props {
  item: LearningItem;
  provider?: ProviderInfo;
  signedIn: boolean;
  loaded: boolean;
  onClose: () => void;
}

export default function CertificationModal({ item, provider, signedIn, loaded, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="certification-modal-title"
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded shrink-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
            <CompanyLogo company={item.provider} icon={provider?.icon} invertOnDark={provider?.invertOnDark} imgClassName="w-5 h-5 object-contain" initialClassName="text-[12px] font-bold text-[var(--color-text-tertiary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="certification-modal-title" className="text-[15px] font-semibold leading-snug text-[var(--color-text-primary)]">{item.title}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
              {[item.provider, ...item.categories, item.level, item.role].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{item.description}</p>
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
          <div>
            <dt className="text-[var(--color-text-tertiary)]">Price</dt>
            <dd className="text-[var(--color-text-secondary)] tabular-nums">{formatPrice(item.price)}</dd>
          </div>
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
              {item.eligibility === 'partners' ? item.eligibilityNote ?? 'Partners only' : 'Anyone'}
            </dd>
          </div>
          {item.platform && (
            <div>
              <dt className="text-[var(--color-text-tertiary)]">Hosted on</dt>
              <dd className="text-[var(--color-text-secondary)]">{item.platform}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
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
      </div>
    </div>,
    document.body,
  );
}

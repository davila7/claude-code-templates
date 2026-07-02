import { useState, useEffect } from 'react';

interface Job {
  id: string;
  company: string;
  position: string;
  location: string;
  remote: boolean;
  salary: string;
  applyUrl: string;
  source: string;
  tags: string[];
  companyIcon: string;
}

interface JobsData {
  totalJobs: number;
  jobs: Job[];
}

const SOURCE_COLORS: Record<string, string> = {
  HackerNews: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  RemoteOK: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  WeWorkRemotely: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Anthropic: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

function useGlobalAuth() {
  const [state, setState] = useState<{ isSignedIn: boolean; isLoaded: boolean }>({
    isSignedIn: false, isLoaded: false,
  });

  useEffect(() => {
    function check() {
      const clerk = (window as any).Clerk;
      if (clerk?.loaded) {
        const signedIn = !!clerk.user;
        setState((prev) => {
          if (prev.isLoaded && prev.isSignedIn === signedIn) return prev;
          return { isSignedIn: signedIn, isLoaded: true };
        });
      }
    }
    check();
    const interval = setInterval(check, 500);
    const handleChange = () => check();
    window.addEventListener('clerk:session', handleChange);
    return () => { clearInterval(interval); window.removeEventListener('clerk:session', handleChange); };
  }, []);

  return state;
}

function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

function getCompanyLogoUrl(companyName: string, existingIcon?: string): string {
  // If icon exists in data, use it
  if (existingIcon) return existingIcon;
  
  // Otherwise, try to fetch from Clearbit Logo API
  const domain = companyName.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
  return `https://logo.clearbit.com/${domain}.com`;
}

interface Props {
  variant?: 'preview' | 'sidebar';
}

export default function JobsPreview({ variant = 'preview' }: Props) {
  const [data, setData] = useState<JobsData | null>(null);
  const { isSignedIn, isLoaded } = useGlobalAuth();

  useEffect(() => {
    fetch('/claude-jobs.json')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  if (!data || data.jobs.length === 0) return null;

  const jobs = variant === 'sidebar' ? data.jobs.slice(0, 12) : data.jobs.slice(0, 5);
  const showAuthGate = isLoaded && !isSignedIn;

  function handleJobClick(e: React.MouseEvent) {
    if (!isLoaded) { e.preventDefault(); return; }
    if (!isSignedIn) {
      e.preventDefault();
      (window as any).Clerk?.openSignIn?.();
    }
  }

  if (variant === 'sidebar') {
    return (
      <div className="flex flex-col h-full">
        {/* Sticky header */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-0)] sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Jobs</span>
              <span className="font-mono text-[9px] font-medium bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20">
                {data.totalJobs}
              </span>
            </div>
            <a
              href="/jobs"
              className="font-mono text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors"
            >
              view all →
            </a>
          </div>
          <p className="font-mono text-[9px] text-[var(--color-text-tertiary)] mt-0.5">Using Claude Code</p>
        </div>

        {/* Vertical job list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {jobs.map((job) => (
            <a
              key={job.id}
              href={isSignedIn ? safeUrl(job.applyUrl) : '#'}
              target={isSignedIn ? '_blank' : undefined}
              rel={isSignedIn ? 'noopener noreferrer' : undefined}
              onClick={showAuthGate ? handleJobClick : undefined}
              className="flex items-start gap-2.5 p-2.5 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-card-bg)] hover:bg-[var(--color-card-hover)] transition-all group relative overflow-hidden block"
            >
              {showAuthGate && (
                <div className="absolute inset-0 bg-[var(--color-surface-0)]/80 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="font-mono text-[9px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] px-2 py-1 rounded border border-[var(--color-border)]">
                    Sign in to view
                  </span>
                </div>
              )}

              {/* Logo */}
              <div className="w-6 h-6 rounded shrink-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden mt-0.5">
                <img
                  src={getCompanyLogoUrl(job.company, job.companyIcon)}
                  alt={job.company}
                  className="w-3.5 h-3.5 object-contain"
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = 'none';
                    const fb = t.nextElementSibling as HTMLElement;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
                <span className="text-[9px] font-bold text-[var(--color-text-tertiary)]" style={{ display: 'none' }}>
                  {job.company.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-2 leading-tight mb-1">
                  {job.position}
                </p>
                <p className="font-mono text-[9px] text-[var(--color-text-tertiary)] truncate mb-1.5">{job.company}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {job.remote && (
                    <span className="text-[8px] font-medium bg-blue-500/15 text-blue-400 px-1 py-0.5 rounded border border-blue-500/20">Remote</span>
                  )}
                  {job.salary && (
                    <span className="text-[8px] font-medium bg-emerald-500/15 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/20">{job.salary}</span>
                  )}
                  <span className={`text-[8px] font-medium px-1 py-0.5 rounded border ${SOURCE_COLORS[job.source] || 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}>
                    {job.source}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Jobs Using Claude Code</h2>
          <span className="text-[10px] font-medium bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded">
            {data.totalJobs} jobs
          </span>
        </div>
        <a
          href="/jobs"
          className="text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          View all &rarr;
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {jobs.map((job) => (
          <a
            key={job.id}
            href={isSignedIn ? safeUrl(job.applyUrl) : '#'}
            target={isSignedIn ? '_blank' : undefined}
            rel={isSignedIn ? 'noopener noreferrer' : undefined}
            onClick={showAuthGate ? handleJobClick : undefined}
            className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3.5 hover:border-[var(--color-border-hover)] hover:shadow-md transition-all group relative overflow-hidden"
          >
            {showAuthGate && (
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-0)]/80 to-transparent backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-2)] px-3 py-1.5 rounded-full border border-[var(--color-border)]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Sign in to view
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={getCompanyLogoUrl(job.company, job.companyIcon)}
                  alt={job.company}
                  className="w-4 h-4 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)]" style={{ display: 'none' }}>
                  {job.company.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] truncate">{job.company}</span>
            </div>

            <h3 className="text-[12px] font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors line-clamp-2 leading-tight mb-2.5 min-h-[2.5rem]">
              {job.position}
            </h3>

            <div className="flex items-center gap-1.5 flex-wrap">
              {job.remote && (
                <span className="text-[9px] font-medium bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                  Remote
                </span>
              )}
              {job.salary && (
                <span className="text-[9px] font-medium bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {job.salary}
                </span>
              )}
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${SOURCE_COLORS[job.source] || 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}>
                {job.source}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

import { useState, useEffect, useMemo } from 'react';

interface Job {
  id: string;
  company: string;
  position: string;
  location: string;
  remote: boolean;
  salary: string;
  description: string;
  applyUrl: string;
  source: string;
  sourceUrl: string;
  postedAt: string;
  tags: string[];
  companyIcon: string;
}

interface JobsData {
  lastUpdated: string;
  totalJobs: number;
  sources: string[];
  jobs: Job[];
}

type LocationFilter = 'all' | 'remote' | 'onsite';
type SortOption = 'recent' | 'company' | 'salary';

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

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (days < 0 || isNaN(days)) return '';
    if (days === 0) return 'Today';
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    if (days < 60) return '1mo ago';
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return '';
  }
}

function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

export default function JobsView() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const { isSignedIn, isLoaded } = useGlobalAuth();

  useEffect(() => {
    fetch('/claude-jobs.json')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.company-dropdown')) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredJobs = useMemo(() => {
    if (!data) return [];
    let filtered = data.jobs.filter((job) => {
      if (locationFilter === 'remote' && !job.remote) return false;
      if (locationFilter === 'onsite' && job.remote) return false;
      if (sourceFilter !== 'all' && job.source !== sourceFilter) return false;
      if (companyFilter !== 'all' && job.company !== companyFilter) return false;
      if (selectedTag !== 'all' && !job.tags.includes(selectedTag)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const text = `${job.company} ${job.position} ${job.location} ${job.tags.join(' ')}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    // Sort jobs
    filtered.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
      } else if (sortBy === 'company') {
        return a.company.localeCompare(b.company);
      } else if (sortBy === 'salary') {
        // Sort by salary (jobs with salary first)
        if (a.salary && !b.salary) return -1;
        if (!a.salary && b.salary) return 1;
        return 0;
      }
      return 0;
    });

    return filtered;
  }, [data, locationFilter, sourceFilter, companyFilter, selectedTag, sortBy, searchQuery]);

  // Get unique companies and tags for filters
  const companies = useMemo(() => {
    if (!data) return [];
    const uniqueCompanies = Array.from(new Set(data.jobs.map(j => j.company))).sort();
    return uniqueCompanies;
  }, [data]);

  // Get company logo for a given company name
  const getCompanyLogo = (companyName: string): string => {
    if (!data) return '';
    const job = data.jobs.find(j => j.company === companyName);
    // If companyIcon exists in data, use it
    if (job?.companyIcon) return job.companyIcon;
    
    // Otherwise, try to fetch from Clearbit Logo API
    // Format: https://logo.clearbit.com/{domain}
    const domain = companyName.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
    return `https://logo.clearbit.com/${domain}.com`;
  };

  const allTags = useMemo(() => {
    if (!data) return [];
    const tagSet = new Set<string>();
    data.jobs.forEach(job => job.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [data]);

  // Custom dropdown state
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  function handleJobClick(e: React.MouseEvent, job: Job) {
    if (!isLoaded) {
      e.preventDefault();
      return;
    }
    if (!isSignedIn) {
      e.preventDefault();
      (window as any).Clerk?.openSignIn?.();
    }
    // If signed in, let the <a> navigate normally
  }

  if (loading) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[var(--color-text-tertiary)]">Loading jobs...</span>
      </div>
    );
  }

  if (!data || data.jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
            <line x1="12" y1="12" x2="12" y2="12.01" />
          </svg>
        </div>
        {/* Message */}
        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-2">No jobs available yet</h3>
        <p className="text-[13px] text-[var(--color-text-secondary)] text-center max-w-md leading-relaxed">
          We're currently curating exciting opportunities for AI developers. Check back soon for new job postings!
        </p>
      </div>
    );
  }

  const remoteCount = data.jobs.filter((j) => j.remote).length;
  const onsiteCount = data.jobs.length - remoteCount;
  const showAuthGate = isLoaded && !isSignedIn;

  return (
    <div>
      {/* Header */}
      <div className="px-6 pt-5 pb-2">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          Jobs Requiring Claude Code
          <img src="/claude-code-logo.png" alt="Claude Code" className="w-6 h-6 inline-block" />
        </h1>
        <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
          Companies actively hiring developers who use Claude Code in their workflow.
          Updated daily from HackerNews "Who is Hiring", RemoteOK, and more.
        </p>
      </div>

      {/* Auth banner for non-signed-in users */}
      {showAuthGate && (
        <div className="mx-6 mt-2 mb-1 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-emerald-500/10 border border-[var(--color-border)] rounded-lg px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <div className="flex-1">
            <p className="text-[13px] text-[var(--color-text-primary)]">
              <span className="font-medium">Sign in</span>
              <span className="text-[var(--color-text-secondary)]"> to view job details and apply to positions</span>
            </p>
          </div>
          <button
            onClick={() => (window as any).Clerk?.openSignIn?.()}
            className="px-3 py-1.5 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-4)] text-[12px] font-medium text-[var(--color-text-primary)] rounded-md transition-colors"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-4">
        {[
          { label: 'Total Jobs', value: String(data.totalJobs) },
          { label: 'Remote', value: String(remoteCount) },
          { label: 'On-site', value: String(onsiteCount) },
          { label: 'Sources', value: String(data.sources.length) },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg px-4 py-3">
            <div className="text-[18px] font-semibold text-[var(--color-text-primary)] tabular-nums">{s.value}</div>
            <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--color-border)]" />

      {/* Filter bar - Enhanced */}
      <div className="px-6 py-4 space-y-3">
        {/* Top row: Location, Source, Company, Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Location filter */}
          <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5">
            {(['all', 'remote', 'onsite'] as LocationFilter[]).map((loc) => (
              <button
                key={loc}
                onClick={() => setLocationFilter(loc)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  locationFilter === loc
                    ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {loc === 'all' ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    All Locations
                  </>
                ) : loc === 'remote' ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                    Remote
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    On-site
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Source filter dropdown */}
          <div className="relative">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="appearance-none bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-3 py-1.5 pr-8 outline-none cursor-pointer transition-colors"
            >
              <option value="all">All Sources</option>
              {data.sources.map((src) => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Company filter dropdown - Custom with logos */}
          <div className="relative company-dropdown">
            <button
              onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
              className="flex items-center gap-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] pl-3 pr-8 py-1.5 outline-none cursor-pointer transition-colors min-w-[180px]"
            >
              {companyFilter === 'all' ? (
                <>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>All Companies ({companies.length})</span>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded bg-[var(--color-surface-3)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={getCompanyLogo(companyFilter)}
                      alt=""
                      className="w-3 h-3 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <span className="text-[8px] font-bold text-[var(--color-text-tertiary)]" style={{ display: 'none' }}>
                      {companyFilter.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="truncate">{companyFilter}</span>
                </>
              )}
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown menu */}
            {isCompanyDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 max-h-80 overflow-y-auto bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
                <button
                  onClick={() => {
                    setCompanyFilter('all');
                    setIsCompanyDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors ${
                    companyFilter === 'all'
                      ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>All Companies ({companies.length})</span>
                </button>
                <div className="border-t border-[var(--color-border)] my-1" />
                {companies.map((company) => (
                  <button
                    key={company}
                    onClick={() => {
                      setCompanyFilter(company);
                      setIsCompanyDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors ${
                      companyFilter === company
                        ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <div className="w-5 h-5 rounded bg-[var(--color-surface-3)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={getCompanyLogo(company)}
                        alt=""
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <span className="text-[9px] font-bold text-[var(--color-text-tertiary)]" style={{ display: 'none' }}>
                        {company.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate">{company}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] pl-9 pr-8 py-1.5 outline-none cursor-pointer transition-colors"
            >
              <option value="recent">Most Recent</option>
              <option value="company">Company A-Z</option>
              <option value="salary">With Salary</option>
            </select>
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {sortBy === 'recent' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : sortBy === 'company' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Search */}
          <div className="ml-auto relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] pl-9 pr-3 py-1.5 w-56 outline-none focus:border-[var(--color-border-hover)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bottom row: Tags filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">Tags:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedTag === 'all'
                    ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]'
                }`}
              >
                All
              </button>
              {allTags.slice(0, 12).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    selectedTag === tag
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {allTags.length > 12 && (
                <span className="text-[11px] text-[var(--color-text-tertiary)] px-2">
                  +{allTags.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Active filters indicator */}
        {(locationFilter !== 'all' || sourceFilter !== 'all' || companyFilter !== 'all' || selectedTag !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-[var(--color-text-tertiary)]">Active filters:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {locationFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">
                  {locationFilter}
                  <button onClick={() => setLocationFilter('all')} className="hover:text-blue-300">×</button>
                </span>
              )}
              {sourceFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-full">
                  {sourceFilter}
                  <button onClick={() => setSourceFilter('all')} className="hover:text-orange-300">×</button>
                </span>
              )}
              {companyFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full">
                  {companyFilter}
                  <button onClick={() => setCompanyFilter('all')} className="hover:text-purple-300">×</button>
                </span>
              )}
              {selectedTag !== 'all' && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">
                  {selectedTag}
                  <button onClick={() => setSelectedTag('all')} className="hover:text-emerald-300">×</button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-pink-500/15 text-pink-400 px-2 py-0.5 rounded-full">
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-pink-300">×</button>
                </span>
              )}
              <button
                onClick={() => {
                  setLocationFilter('all');
                  setSourceFilter('all');
                  setCompanyFilter('all');
                  setSelectedTag('all');
                  setSearchQuery('');
                }}
                className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] underline"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="px-6 pb-3 flex items-center justify-between">
        <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
          Showing {filteredJobs.length} of {data.totalJobs} job{filteredJobs.length !== 1 ? 's' : ''}
        </span>
        {filteredJobs.length === 0 && (
          <button
            onClick={() => {
              setLocationFilter('all');
              setSourceFilter('all');
              setCompanyFilter('all');
              setSelectedTag('all');
              setSearchQuery('');
            }}
            className="text-[12px] text-blue-400 hover:text-blue-300 underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Job cards */}
      {filteredJobs.length === 0 ? (
        <div className="px-6 pb-8 flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">No jobs found</h3>
          <p className="text-[12px] text-[var(--color-text-tertiary)] text-center max-w-sm">
            Try adjusting your filters or search query to find more opportunities.
          </p>
        </div>
      ) : (
        <div className="px-6 pb-8 grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredJobs.map((job) => (
            <a
              key={job.id}
              href={isSignedIn ? safeUrl(job.applyUrl) : '#'}
              target={isSignedIn ? '_blank' : undefined}
              rel={isSignedIn ? 'noopener noreferrer' : undefined}
              onClick={(e) => handleJobClick(e, job)}
              className="block bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-border-hover)] hover:bg-[var(--color-card-hover)] hover:shadow-lg transition-all group relative"
            >
              <div className="flex items-start gap-3">
                {/* Company icon - Enhanced with internet fallback */}
                <div className="w-12 h-12 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden group-hover:border-[var(--color-border-hover)] transition-colors">
                  <img
                    src={job.companyIcon || getCompanyLogo(job.company)}
                    alt={job.company}
                    className="w-7 h-7 object-contain"
                    style={{ display: 'block' }}
                    onError={(e) => { 
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <span 
                    className="text-[16px] font-bold text-[var(--color-text-tertiary)]"
                    style={{ display: 'none' }}
                  >
                    {job.company.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors flex-1">
                      {job.position}
                    </h3>
                    {job.salary && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {job.salary}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">{job.company}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">•</span>
                    <span className="text-[12px] text-[var(--color-text-tertiary)]">{job.location}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {job.remote && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold bg-blue-500/15 text-blue-400 px-2 py-1 rounded border border-blue-500/20">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                        </svg>
                        Remote
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded border ${SOURCE_COLORS[job.source] || 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]'}`}>
                      {job.source}
                    </span>
                    {job.postedAt && (
                      <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)] ml-auto">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {timeAgo(job.postedAt)}
                      </span>
                    )}
                  </div>

                  {job.description && (
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-2.5 line-clamp-2 leading-relaxed">{job.description}</p>
                  )}

                  {job.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {job.tags.slice(0, 6).map((tag) => (
                        <span 
                          key={tag} 
                          className="text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedTag(tag);
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {job.tags.length > 6 && (
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                          +{job.tags.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side: apply arrow or lock icon */}
                {showAuthGate ? (
                  <svg
                    className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0 mt-1"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0 mt-1 transition-all"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-6 pb-6 text-center">
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          Last updated: {new Date(data.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {' | '}Data sourced from HackerNews "Who is Hiring", RemoteOK, WeWorkRemotely, and Anthropic Careers
        </p>
      </div>
    </div>
  );
}

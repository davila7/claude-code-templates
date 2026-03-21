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

const SOURCE_COLORS: Record<string, string> = {
  HackerNews: 'bg-orange-500/15 text-orange-400',
  RemoteOK: 'bg-blue-500/15 text-blue-400',
  WeWorkRemotely: 'bg-emerald-500/15 text-emerald-400',
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    if (days < 60) return '1mo ago';
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return '';
  }
}

export default function JobsView() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/claude-jobs.json')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredJobs = useMemo(() => {
    if (!data) return [];
    return data.jobs.filter((job) => {
      if (locationFilter === 'remote' && !job.remote) return false;
      if (locationFilter === 'onsite' && job.remote) return false;
      if (sourceFilter !== 'all' && job.source !== sourceFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const text = `${job.company} ${job.position} ${job.location} ${job.tags.join(' ')}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [data, locationFilter, sourceFilter, searchQuery]);

  if (loading) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#666] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[#666]">Loading jobs...</span>
      </div>
    );
  }

  if (!data || data.jobs.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-[13px] text-[#666]">No jobs found yet. Check back soon!</p>
      </div>
    );
  }

  const remoteCount = data.jobs.filter((j) => j.remote).length;
  const onsiteCount = data.jobs.length - remoteCount;

  return (
    <div>
      {/* Header */}
      <div className="px-6 pt-5 pb-2">
        <h1 className="text-lg font-semibold text-[#ededed] flex items-center gap-2">
          Jobs Requiring Claude Code
          <img src="/claude-code-logo.png" alt="Claude Code" className="w-6 h-6 inline-block" />
        </h1>
        <p className="text-[13px] text-[#666] mt-1">
          Companies actively hiring developers who use Claude Code in their workflow.
          Updated daily from HackerNews "Who is Hiring", RemoteOK, and more.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-4">
        {[
          { label: 'Total Jobs', value: String(data.totalJobs) },
          { label: 'Remote', value: String(remoteCount) },
          { label: 'On-site', value: String(onsiteCount) },
          { label: 'Sources', value: String(data.sources.length) },
        ].map((s) => (
          <div key={s.label} className="bg-[#111] border border-[#1f1f1f] rounded-lg px-4 py-3">
            <div className="text-[18px] font-semibold text-[#ededed] tabular-nums">{s.value}</div>
            <div className="text-[11px] text-[#666] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-[#1f1f1f]" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        {/* Location filter */}
        <div className="flex items-center gap-1">
          {(['all', 'remote', 'onsite'] as LocationFilter[]).map((loc) => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                locationFilter === loc
                  ? 'bg-white/10 text-white'
                  : 'text-[#666] hover:text-[#a1a1a1] hover:bg-white/[0.04]'
              }`}
            >
              {loc === 'all' ? 'All' : loc === 'remote' ? 'Remote' : 'On-site'}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="bg-white/[0.04] border-none rounded-lg text-[12px] text-[#a1a1a1] px-2.5 py-1.5 outline-none cursor-pointer"
        >
          <option value="all">All Sources</option>
          {data.sources.map((src) => (
            <option key={src} value={src}>{src}</option>
          ))}
        </select>

        {/* Search */}
        <div className="ml-auto relative">
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/[0.04] border border-[#1f1f1f] rounded-lg text-[12px] text-[#ededed] placeholder-[#555] px-3 py-1.5 w-48 outline-none focus:border-[#333]"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="px-6 pb-2">
        <span className="text-[11px] text-[#666]">
          {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
          {locationFilter !== 'all' ? ` (${locationFilter})` : ''}
        </span>
      </div>

      {/* Job cards */}
      <div className="px-6 pb-8 space-y-3">
        {filteredJobs.map((job) => (
          <a
            key={job.id}
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[#111] border border-[#1f1f1f] rounded-lg p-4 hover:border-[#333] transition-colors group"
          >
            <div className="flex items-start gap-3">
              {/* Company icon */}
              <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#222] flex items-center justify-center shrink-0 overflow-hidden">
                {job.companyIcon ? (
                  <img
                    src={job.companyIcon}
                    alt=""
                    className="w-6 h-6 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-[14px] font-bold text-[#444]">
                    {job.company.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[14px] font-medium text-[#ededed] group-hover:text-white transition-colors">
                    {job.position}
                  </h3>
                  {job.salary && (
                    <span className="text-[11px] font-medium bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">
                      {job.salary}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[12px] text-[#a1a1a1]">{job.company}</span>
                  <span className="text-[10px] text-[#333]">|</span>
                  <span className="text-[12px] text-[#666]">{job.location}</span>
                  {job.remote && (
                    <span className="text-[10px] font-medium bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">
                      Remote
                    </span>
                  )}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${SOURCE_COLORS[job.source] || 'bg-white/10 text-[#888]'}`}>
                    {job.source}
                  </span>
                  {job.postedAt && (
                    <span className="text-[11px] text-[#444]">{timeAgo(job.postedAt)}</span>
                  )}
                </div>

                {job.description && (
                  <p className="text-[12px] text-[#555] mt-2 line-clamp-2">{job.description}</p>
                )}

                {job.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {job.tags.slice(0, 6).map((tag) => (
                      <span key={tag} className="text-[10px] text-[#555] bg-white/[0.04] px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Apply arrow */}
              <svg
                className="w-4 h-4 text-[#333] group-hover:text-[#666] shrink-0 mt-1 transition-colors"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
          </a>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 text-center">
        <p className="text-[11px] text-[#444]">
          Last updated: {new Date(data.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {' | '}Data sourced from HackerNews "Who is Hiring", RemoteOK, and WeWorkRemotely
        </p>
      </div>
    </div>
  );
}

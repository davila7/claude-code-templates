import { useState, useEffect } from 'react';
import { getSavedJobs, subscribeSavedJobsChange, toggleSavedJob as toggleSavedJobStore } from '../lib/saved-jobs-store';

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
  tags: string[];
  companyIcon: string;
  postedAt: string;
}

interface SavedJob {
  id: string;
  job_id: string;
  saved_at: string;
  notes: string | null;
  status: string;
}

type StatusFilter = 'all' | 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  saved: 'bg-blue-500/15 text-blue-400',
  applied: 'bg-purple-500/15 text-purple-400',
  interview: 'bg-orange-500/15 text-orange-400',
  offer: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
};

export default function SavedJobsView() {
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved jobs from shared store
    setSavedJobs(getSavedJobs());

    // Subscribe to changes
    const unsubscribe = subscribeSavedJobsChange((jobs) => {
      setSavedJobs(new Set(jobs));
    });

    // Load all jobs
    fetch('/claude-jobs.json')
      .then((r) => r.json())
      .then((d) => {
        setAllJobs(d.jobs);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return unsubscribe;
  }, []);

  const filteredJobs = allJobs.filter(job => savedJobs.has(job.id));

  function removeSavedJob(jobId: string) {
    toggleSavedJobStore(jobId);
    // State will be updated via subscription
  }

  function exportToCSV() {
    const jobs = filteredJobs;
    const headers = ['Company', 'Position', 'Location', 'Remote', 'Salary', 'Source', 'Apply URL', 'Posted At'];
    const rows = jobs.map(job => [
      job.company,
      job.position,
      job.location,
      job.remote ? 'Yes' : 'No',
      job.salary || 'N/A',
      job.source,
      job.applyUrl,
      job.postedAt,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saved-jobs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#666] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[#666]">Loading saved jobs...</span>
      </div>
    );
  }

  if (filteredJobs.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <svg className="w-12 h-12 text-[#333] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <p className="text-[14px] text-[#666] mb-1">No saved jobs yet</p>
        <p className="text-[12px] text-[#555]">Click the bookmark icon on any job to save it for later</p>
        <a
          href="/jobs"
          className="inline-block mt-4 px-4 py-2 bg-white/10 hover:bg-white/15 text-[13px] text-white rounded-lg transition-colors"
        >
          Browse Jobs
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#ededed]">Saved Jobs</h1>
            <p className="text-[13px] text-[#666] mt-1">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 text-[12px] text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Job cards */}
      <div className="px-6 pb-8 space-y-3">
        {filteredJobs.map((job) => (
          <div
            key={job.id}
            className="bg-[#111] border border-[#1f1f1f] rounded-lg p-4 hover:border-[#333] transition-colors group"
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
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] font-medium text-[#ededed] hover:text-white transition-colors"
                  >
                    {job.position}
                  </a>
                  {job.salary && (
                    <span className="text-[11px] font-medium bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">
                      {job.salary}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1 flex-wrap text-[12px]">
                  <span className="text-[#a1a1a1]">{job.company}</span>
                  <span className="text-[#333]">•</span>
                  <span className="text-[#666]">{job.location}</span>
                  {job.remote && (
                    <>
                      <span className="text-[#333]">•</span>
                      <span className="text-blue-400">Remote</span>
                    </>
                  )}
                </div>

                {job.description && (
                  <p className="text-[12px] text-[#999] mt-2 line-clamp-2">{job.description}</p>
                )}

                {job.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {job.tags.slice(0, 6).map((tag) => (
                      <span key={tag} className="text-[10px] text-[#aaa] bg-white/[0.07] px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <button
                  onClick={() => removeSavedJob(job.id)}
                  className="p-1.5 rounded-md text-yellow-400 hover:text-yellow-300 transition-colors"
                  title="Remove from saved"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md text-[#333] hover:text-[#666] transition-colors"
                  title="Apply"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

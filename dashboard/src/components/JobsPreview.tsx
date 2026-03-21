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
  HackerNews: 'bg-orange-500/15 text-orange-400',
  RemoteOK: 'bg-blue-500/15 text-blue-400',
  WeWorkRemotely: 'bg-emerald-500/15 text-emerald-400',
};

export default function JobsPreview() {
  const [data, setData] = useState<JobsData | null>(null);

  useEffect(() => {
    fetch('/claude-jobs.json')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  if (!data || data.jobs.length === 0) return null;

  const jobs = data.jobs.slice(0, 5);

  return (
    <section className="px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Jobs Using Claude Code</h2>
          <span className="text-[10px] font-medium bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded">
            {data.totalJobs} jobs
          </span>
        </div>
        <a
          href="/jobs"
          className="text-[12px] text-[#666] hover:text-[#a1a1a1] transition-colors"
        >
          View all &rarr;
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        {jobs.map((job) => (
          <a
            key={job.id}
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#111] border border-[#1f1f1f] rounded-lg p-3 hover:border-[#333] transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-[#1a1a1a] border border-[#222] flex items-center justify-center shrink-0 overflow-hidden">
                {job.companyIcon ? (
                  <img
                    src={job.companyIcon}
                    alt=""
                    className="w-4 h-4 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-[10px] font-bold text-[#444]">
                    {job.company.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#a1a1a1] truncate">{job.company}</span>
            </div>

            <h3 className="text-[12px] font-medium text-[#ededed] group-hover:text-white transition-colors line-clamp-2 leading-tight mb-2">
              {job.position}
            </h3>

            <div className="flex items-center gap-1.5 flex-wrap">
              {job.remote && (
                <span className="text-[9px] font-medium bg-blue-500/15 text-blue-400 px-1 py-0.5 rounded">
                  Remote
                </span>
              )}
              {job.salary && (
                <span className="text-[9px] font-medium bg-emerald-500/15 text-emerald-400 px-1 py-0.5 rounded">
                  {job.salary}
                </span>
              )}
              <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${SOURCE_COLORS[job.source] || 'bg-white/10 text-[#888]'}`}>
                {job.source}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

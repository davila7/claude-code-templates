import { getCompanyLogoUrl, getCompanyInitials } from '../lib/company-logos';

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
  postedAt: string;
}

interface JobCardCompactProps {
  job: Job;
  isSaved: boolean;
  onSave: () => void;
  freshness: { label: string; color: string; icon: string } | null;
  isSignedIn: boolean;
  onJobClick: (e: React.MouseEvent) => void;
}

export default function JobCardCompact({
  job,
  isSaved,
  onSave,
  freshness,
  isSignedIn,
  onJobClick,
}: JobCardCompactProps) {
  const logoUrl = getCompanyLogoUrl(job.company, job.companyIcon);
  const initials = getCompanyInitials(job.company);

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-lg p-3 hover:border-[#333] transition-colors group">
      <div className="flex items-center gap-3">
        {/* Company icon */}
        <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#222] flex items-center justify-center shrink-0 overflow-hidden">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={job.company}
              className="w-5 h-5 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const span = document.createElement('span');
                  span.className = 'text-[12px] font-bold text-[#444]';
                  span.textContent = initials;
                  parent.appendChild(span);
                }
              }}
            />
          ) : (
            <span className="text-[12px] font-bold text-[#444]">
              {initials}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={isSignedIn ? job.applyUrl : '#'}
              target={isSignedIn ? '_blank' : undefined}
              rel={isSignedIn ? 'noopener noreferrer' : undefined}
              onClick={onJobClick}
              className="text-[13px] font-medium text-[#ededed] hover:text-white transition-colors"
            >
              {job.position}
            </a>
            {freshness && (
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${freshness.color}`}>
                {freshness.icon}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px]">
            <span className="text-[#a1a1a1]">{job.company}</span>
            <span className="text-[#333]">•</span>
            <span className="text-[#666]">{job.location}</span>
            {job.salary && (
              <>
                <span className="text-[#333]">•</span>
                <span className="text-emerald-400 font-medium">{job.salary}</span>
              </>
            )}
            {job.postedAt && (
              <>
                <span className="text-[#333]">•</span>
                <span className="text-[#444]">
                  {(() => {
                    const date = new Date(job.postedAt);
                    const now = new Date();
                    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
                    if (days === 0) return 'Today';
                    if (days === 1) return '1d';
                    if (days < 30) return `${days}d`;
                    return `${Math.floor(days / 30)}mo`;
                  })()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={onSave}
          className={`p-1.5 rounded-md transition-colors shrink-0 ${
            isSaved ? 'text-yellow-400 hover:text-yellow-300' : 'text-[#444] hover:text-[#666]'
          }`}
          title={isSaved ? 'Unsave job' : 'Save job'}
        >
          <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

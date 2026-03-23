import { getCompanyLogoUrl, getCompanyInitials } from '../lib/company-logos';

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

interface JobCardProps {
  job: Job;
  isSaved: boolean;
  onSave: () => void;
  onTagClick: (tag: string) => void;
  selectedTags: string[];
  freshness: { label: string; color: string; icon: string } | null;
  sourceColor: string;
  isSignedIn: boolean;
  showAuthGate: boolean;
  onJobClick: (e: React.MouseEvent) => void;
}

export default function JobCard({
  job,
  isSaved,
  onSave,
  onTagClick,
  selectedTags,
  freshness,
  sourceColor,
  isSignedIn,
  showAuthGate,
  onJobClick,
}: JobCardProps) {
  const logoUrl = getCompanyLogoUrl(job.company, job.companyIcon);
  const initials = getCompanyInitials(job.company);

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-lg p-4 hover:border-[#333] transition-all duration-200 group relative hover:shadow-lg hover:shadow-black/20">
      <div className="flex items-start gap-3">
        {/* Company icon with gradient background */}
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#222] flex items-center justify-center shrink-0 overflow-hidden group-hover:border-[#333] transition-colors">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={job.company}
              className="w-7 h-7 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const span = document.createElement('span');
                  span.className = 'text-[14px] font-bold text-[#555] group-hover:text-[#666] transition-colors';
                  span.textContent = initials;
                  parent.appendChild(span);
                }
              }}
            />
          ) : (
            <span className="text-[14px] font-bold text-[#555] group-hover:text-[#666] transition-colors">
              {initials}
            </span>
          )}
          
          {/* Verified badge for known companies */}
          {['Anthropic', 'Google', 'Meta', 'Amazon', 'Microsoft', 'Apple'].includes(job.company) && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#111]">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1">
            <a
              href={isSignedIn ? job.applyUrl : '#'}
              target={isSignedIn ? '_blank' : undefined}
              rel={isSignedIn ? 'noopener noreferrer' : undefined}
              onClick={onJobClick}
              className="text-[15px] font-semibold text-[#ededed] group-hover:text-white transition-colors leading-tight"
            >
              {job.position}
            </a>
            {job.salary && (
              <span className="text-[11px] font-semibold bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20">
                💰 {job.salary}
              </span>
            )}
            {freshness && (
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-md ${freshness.color} border ${freshness.color.replace('text-', 'border-').replace('400', '500/30')}`}>
                {freshness.icon} {freshness.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[12px]">
            <span className="text-[#a1a1a1] font-medium">{job.company}</span>
            <span className="text-[#333]">•</span>
            <span className="text-[#666] flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </span>
            {job.remote && (
              <>
                <span className="text-[#333]">•</span>
                <span className="text-[10px] font-semibold bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20">
                  🌍 Remote
                </span>
              </>
            )}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${sourceColor} border ${sourceColor.replace('text-', 'border-').replace('400', '500/30')}`}>
              {job.source}
            </span>
            {job.postedAt && (
              <>
                <span className="text-[#333]">•</span>
                <span className="text-[11px] text-[#555]">
                  {(() => {
                    const date = new Date(job.postedAt);
                    const now = new Date();
                    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
                    if (days === 0) return 'Today';
                    if (days === 1) return '1d ago';
                    if (days < 30) return `${days}d ago`;
                    return `${Math.floor(days / 30)}mo ago`;
                  })()}
                </span>
              </>
            )}
          </div>

          {job.description && (
            <p className="text-[12px] text-[#999] mt-2.5 line-clamp-2 leading-relaxed">
              {job.description}
            </p>
          )}

          {job.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {job.tags.slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className={`text-[10px] px-2 py-1 rounded-md transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium'
                      : 'text-[#aaa] bg-white/[0.05] hover:bg-white/[0.10] border border-transparent hover:border-[#333]'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {job.tags.length > 8 && (
                <span className="text-[10px] text-[#555]">+{job.tags.length - 8} more</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <button
            onClick={onSave}
            className={`p-2 rounded-lg transition-all ${
              isSaved 
                ? 'text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30' 
                : 'text-[#444] hover:text-[#666] hover:bg-white/[0.04] border border-transparent'
            }`}
            title={isSaved ? 'Unsave job' : 'Save job'}
          >
            <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          
          {showAuthGate ? (
            <div className="p-2 rounded-lg bg-[#1a1a1a] border border-[#222]">
              <svg
                className="w-4 h-4 text-[#444]"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          ) : (
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg text-[#333] hover:text-[#666] hover:bg-white/[0.04] transition-all border border-transparent hover:border-[#333]"
              title="Apply now"
            >
              <svg
                className="w-4 h-4"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

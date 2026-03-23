import { formatDate, formatEngagementMetrics, getCategoryIcon, getDifficultyColor } from '../../lib/showcase';
import type { Showcase } from '../../types/showcase';

interface ShowcaseCardProps {
  showcase: Showcase;
  featured?: boolean;
  compact?: boolean;
}

export default function ShowcaseCard({ showcase, featured = false, compact = false }: ShowcaseCardProps) {
  const difficultyColor = getDifficultyColor(showcase.difficultyLevel);
  const categoryIcon = getCategoryIcon(showcase.category);

  return (
    <a
      href={`/showcase/${showcase.id}`}
      className="block group bg-surface-2 hover:bg-surface-3 rounded-lg border border-border-primary transition-all duration-200 hover:border-border-secondary overflow-hidden"
    >
      {/* Thumbnail */}
      {showcase.thumbnailUrl && !compact && (
        <div className="aspect-video w-full overflow-hidden bg-surface-3">
          <img
            src={showcase.thumbnailUrl}
            alt={showcase.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        </div>
      )}

      <div className={compact ? 'p-3' : 'p-4'}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-text-primary group-hover:text-accent-primary transition-colors ${compact ? 'text-sm' : 'text-base'} line-clamp-2`}>
              {showcase.title}
            </h3>
          </div>
          {featured && (
            <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-accent-primary/15 text-accent-primary rounded">
              Featured
            </span>
          )}
        </div>

        {/* Description */}
        {!compact && (
          <p className="text-sm text-text-secondary line-clamp-2 mb-3">
            {showcase.description}
          </p>
        )}

        {/* Tags */}
        {!compact && showcase.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {showcase.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs text-text-tertiary bg-surface-3 rounded"
              >
                {tag}
              </span>
            ))}
            {showcase.tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-text-tertiary">
                +{showcase.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 text-xs">
          {/* Author */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img
              src={showcase.authorAvatar}
              alt={showcase.authorName}
              className="w-5 h-5 rounded-full flex-shrink-0"
            />
            <span className="text-text-tertiary truncate">{showcase.authorName}</span>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Category */}
            <span className="text-text-tertiary" title={showcase.category}>
              {categoryIcon}
            </span>

            {/* Difficulty */}
            <span
              className={`w-2 h-2 rounded-full ${
                difficultyColor === 'green'
                  ? 'bg-green-500'
                  : difficultyColor === 'yellow'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              title={showcase.difficultyLevel}
            />

            {/* Time */}
            <span className="text-text-tertiary">
              {formatDate(showcase.createdAt)}
            </span>
          </div>
        </div>

        {/* Engagement */}
        {!compact && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border-primary text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {showcase.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {showcase.likeCount}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {showcase.tryCount}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}

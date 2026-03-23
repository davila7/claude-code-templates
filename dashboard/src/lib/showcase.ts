// Community Showcase Utility Functions

import type { Showcase, SubmissionData, ValidationResult } from '../types/showcase';

export const VALIDATION_RULES = {
  title: { min: 5, max: 100 },
  description: { min: 20, max: 500 },
  content: { min: 100, max: 50000 },
  tags: { min: 1, max: 10 },
  commentContent: { min: 1, max: 1000 },
};

export const CATEGORIES = [
  { id: 'automation', name: 'Automation', icon: '🤖' },
  { id: 'testing', name: 'Testing', icon: '🧪' },
  { id: 'deployment', name: 'Deployment', icon: '🚀' },
  { id: 'ai-agents', name: 'AI Agents', icon: '🤖' },
  { id: 'performance', name: 'Performance', icon: '⚡' },
  { id: 'security', name: 'Security', icon: '🔒' },
  { id: 'best-practices', name: 'Best Practices', icon: '✨' },
];

export const SUBMISSION_TYPES = [
  { id: 'workflow', name: 'Workflow', description: 'Automation and process workflows' },
  { id: 'success_story', name: 'Success Story', description: 'Real-world implementation stories' },
  { id: 'before_after', name: 'Before/After', description: 'Code improvement examples' },
  { id: 'configuration', name: 'Configuration', description: 'Setup and configuration guides' },
];

export const DIFFICULTY_LEVELS = [
  { id: 'beginner', name: 'Beginner', color: 'green' },
  { id: 'intermediate', name: 'Intermediate', color: 'yellow' },
  { id: 'advanced', name: 'Advanced', color: 'red' },
];

export function validateSubmission(data: SubmissionData): ValidationResult {
  // Title validation
  if (data.title.length < VALIDATION_RULES.title.min || data.title.length > VALIDATION_RULES.title.max) {
    return {
      valid: false,
      error: `Title must be between ${VALIDATION_RULES.title.min} and ${VALIDATION_RULES.title.max} characters`,
    };
  }

  // Description validation
  if (data.description.length < VALIDATION_RULES.description.min || data.description.length > VALIDATION_RULES.description.max) {
    return {
      valid: false,
      error: `Description must be between ${VALIDATION_RULES.description.min} and ${VALIDATION_RULES.description.max} characters`,
    };
  }

  // Content validation
  if (data.content.length < VALIDATION_RULES.content.min || data.content.length > VALIDATION_RULES.content.max) {
    return {
      valid: false,
      error: `Content must be between ${VALIDATION_RULES.content.min} and ${VALIDATION_RULES.content.max} characters`,
    };
  }

  // Tags validation
  if (data.tags.length < VALIDATION_RULES.tags.min || data.tags.length > VALIDATION_RULES.tags.max) {
    return {
      valid: false,
      error: `Must have between ${VALIDATION_RULES.tags.min} and ${VALIDATION_RULES.tags.max} tags`,
    };
  }

  // Category validation
  if (!CATEGORIES.find(c => c.id === data.category)) {
    return {
      valid: false,
      error: 'Invalid category',
    };
  }

  // Submission type validation
  if (!SUBMISSION_TYPES.find(t => t.id === data.submissionType)) {
    return {
      valid: false,
      error: 'Invalid submission type',
    };
  }

  return { valid: true };
}

export function calculateTrendingScore(showcase: Showcase): number {
  const now = Date.now();
  const createdAt = new Date(showcase.createdAt).getTime();
  const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);

  // Engagement score with weighted values
  const engagementScore =
    showcase.viewCount * 1 +
    showcase.likeCount * 3 +
    showcase.tryCount * 5 +
    showcase.bookmarkCount * 2;

  // Time decay (newer content gets higher score)
  const timeDecay = 1 / Math.max(1, ageInDays);

  return engagementScore * timeDecay;
}

export function formatEngagementMetrics(showcase: Showcase): string {
  const parts: string[] = [];

  if (showcase.viewCount > 0) {
    parts.push(`${formatNumber(showcase.viewCount)} views`);
  }
  if (showcase.likeCount > 0) {
    parts.push(`${formatNumber(showcase.likeCount)} likes`);
  }
  if (showcase.tryCount > 0) {
    parts.push(`${formatNumber(showcase.tryCount)} tries`);
  }

  return parts.join(' • ');
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function getDifficultyColor(level: string): string {
  const difficulty = DIFFICULTY_LEVELS.find(d => d.id === level);
  return difficulty?.color || 'gray';
}

export function getCategoryIcon(categoryId: string): string {
  const category = CATEGORIES.find(c => c.id === categoryId);
  return category?.icon || '📄';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

export function buildShowcaseUrl(id: string): string {
  return `/showcase/${id}`;
}

export function buildSubmitUrl(): string {
  return '/showcase/submit';
}

export function buildCOTWUrl(): string {
  return '/showcase/component-of-week';
}

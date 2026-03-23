// Community Showcase Types

export type SubmissionType = 'workflow' | 'success_story' | 'before_after' | 'configuration';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type Status = 'pending' | 'approved' | 'featured' | 'rejected';
export type ReactionType = 'like' | 'bookmark' | 'try';

export interface Showcase {
  id: string;
  clerkUserId: string;
  title: string;
  description: string;
  content: string;
  submissionType: SubmissionType;
  codeBefore?: string;
  codeAfter?: string;
  codeLanguage?: string;
  thumbnailUrl?: string;
  demoUrl?: string;
  githubUrl?: string;
  videoUrl?: string;
  tags: string[];
  category: string;
  difficultyLevel: DifficultyLevel;
  status: Status;
  isFeatured: boolean;
  featuredAt?: Date;
  rejectionReason?: string;
  viewCount: number;
  likeCount: number;
  bookmarkCount: number;
  tryCount: number;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  authorName: string;
  authorAvatar: string;
  authorGithub?: string;
}

export interface ComponentOfWeek {
  id: string;
  componentType: string;
  componentPath: string;
  componentName: string;
  weekStartDate: Date;
  weekEndDate: Date;
  spotlightTitle: string;
  spotlightDescription: string;
  spotlightContent: string;
  featuredShowcaseIds: string[];
  usageStats: {
    downloads?: number;
    installations?: number;
    stars?: number;
  };
  interviewContent?: string;
  interviewVideoUrl?: string;
  createdAt: Date;
  publishedAt?: Date;
}

export interface ShowcaseComment {
  id: string;
  showcaseId: string;
  clerkUserId: string;
  content: string;
  parentCommentId?: string;
  likeCount: number;
  isEdited: boolean;
  isDeleted: boolean;
  isFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorName: string;
  authorAvatar: string;
  replies?: ShowcaseComment[];
}

export interface ShowcaseReaction {
  id: string;
  showcaseId: string;
  clerkUserId: string;
  reactionType: ReactionType;
  createdAt: Date;
}

export interface ShowcaseView {
  id: string;
  showcaseId: string;
  viewerId?: string;
  ipAddress?: string;
  userAgent?: string;
  viewedAt: Date;
}

export interface ShowcaseCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface SubmissionData {
  title: string;
  description: string;
  content: string;
  submissionType: SubmissionType;
  codeBefore?: string;
  codeAfter?: string;
  codeLanguage?: string;
  tags: string[];
  category: string;
  difficultyLevel?: DifficultyLevel;
  thumbnailUrl?: string;
  demoUrl?: string;
  githubUrl?: string;
  videoUrl?: string;
}

export interface ShowcaseFilters {
  type?: SubmissionType;
  category?: string;
  status?: Status;
  featured?: boolean;
  difficulty?: DifficultyLevel;
  tags?: string[];
  sort?: 'recent' | 'views' | 'likes' | 'trending';
  limit?: number;
  offset?: number;
}

export interface ShowcaseListResponse {
  showcases: Showcase[];
  total: number;
  hasMore: boolean;
}

export interface ShowcaseDetailResponse {
  showcase: Showcase;
  author: {
    id: string;
    name: string;
    avatar: string;
    github?: string;
  };
  reactions: {
    likes: number;
    bookmarks: number;
    tries: number;
    userReactions: ReactionType[];
  };
  comments: ShowcaseComment[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Tutorial Types

export type TutorialType = 'agent' | 'command' | 'hook' | 'mcp' | 'skill';
export type TutorialDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface TutorialMetadata {
  component: string;
  type: TutorialType;
  difficulty: TutorialDifficulty;
  duration: string;
  tags: string[];
  popular?: boolean;
}

export interface Tutorial extends TutorialMetadata {
  title: string;
  description: string;
  content: string;
  steps: TutorialStep[];
}

export interface TutorialStep {
  number: number;
  title: string;
  content: string;
}

export interface TutorialProgress {
  component: string;
  stepsCompleted: number[];
  completedAt?: Date;
  timeSpent: number; // in seconds
  lastAccessedAt: Date;
}

export interface TutorialCardData extends TutorialMetadata {
  title: string;
  description: string;
  completionRate?: number;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  tutorials: string[]; // component names
  icon: string;
}

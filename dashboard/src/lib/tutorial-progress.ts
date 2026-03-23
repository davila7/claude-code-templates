// Tutorial Progress Tracking (localStorage)

import type { TutorialProgress } from '../types/tutorial';

const STORAGE_PREFIX = 'tutorial_';

export function saveProgress(component: string, step: number): void {
  if (typeof window === 'undefined') return;
  
  const key = `${STORAGE_PREFIX}${component}`;
  const existing = getProgress(component);
  
  const progress: TutorialProgress = {
    component,
    stepsCompleted: [...new Set([...(existing?.stepsCompleted || []), step])].sort(),
    timeSpent: (existing?.timeSpent || 0) + 1,
    lastAccessedAt: new Date(),
  };
  
  // Check if all 4 steps are completed
  if (progress.stepsCompleted.length === 4) {
    progress.completedAt = new Date();
  }
  
  localStorage.setItem(key, JSON.stringify(progress));
}

export function getProgress(component: string): TutorialProgress | null {
  if (typeof window === 'undefined') return null;
  
  const key = `${STORAGE_PREFIX}${component}`;
  const data = localStorage.getItem(key);
  
  if (!data) return null;
  
  try {
    const progress = JSON.parse(data);
    return {
      ...progress,
      lastAccessedAt: new Date(progress.lastAccessedAt),
      completedAt: progress.completedAt ? new Date(progress.completedAt) : undefined,
    };
  } catch {
    return null;
  }
}

export function getAllProgress(): TutorialProgress[] {
  if (typeof window === 'undefined') return [];
  
  const allProgress: TutorialProgress[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      const component = key.replace(STORAGE_PREFIX, '');
      const progress = getProgress(component);
      if (progress) {
        allProgress.push(progress);
      }
    }
  }
  
  return allProgress;
}

export function isStepCompleted(component: string, step: number): boolean {
  const progress = getProgress(component);
  return progress?.stepsCompleted.includes(step) || false;
}

export function isCompleted(component: string): boolean {
  const progress = getProgress(component);
  return progress?.completedAt !== undefined;
}

export function getCompletionRate(component: string): number {
  const progress = getProgress(component);
  if (!progress) return 0;
  return (progress.stepsCompleted.length / 4) * 100;
}

export function clearProgress(component: string): void {
  if (typeof window === 'undefined') return;
  const key = `${STORAGE_PREFIX}${component}`;
  localStorage.removeItem(key);
}

export function clearAllProgress(): void {
  if (typeof window === 'undefined') return;
  
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  
  keys.forEach(key => localStorage.removeItem(key));
}

export function getStats() {
  const allProgress = getAllProgress();
  const completed = allProgress.filter(p => p.completedAt).length;
  const inProgress = allProgress.filter(p => !p.completedAt && p.stepsCompleted.length > 0).length;
  const totalTime = allProgress.reduce((sum, p) => sum + p.timeSpent, 0);
  
  return {
    completed,
    inProgress,
    total: allProgress.length,
    totalTimeMinutes: Math.round(totalTime / 60),
  };
}

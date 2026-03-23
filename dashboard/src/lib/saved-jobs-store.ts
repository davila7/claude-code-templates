// Shared store for saved jobs using localStorage and custom events

const STORAGE_KEY = 'savedJobs';
const EVENT_NAME = 'savedJobsChanged';

export function getSavedJobs(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

export function setSavedJobs(jobs: Set<string>): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(jobs)));
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: jobs }));
  } catch (error) {
    console.error('Error saving jobs:', error);
  }
}

export function toggleSavedJob(jobId: string): boolean {
  const saved = getSavedJobs();
  const wasSaved = saved.has(jobId);
  
  if (wasSaved) {
    saved.delete(jobId);
  } else {
    saved.add(jobId);
  }
  
  setSavedJobs(saved);
  return !wasSaved; // Return new state
}

export function isSaved(jobId: string): boolean {
  return getSavedJobs().has(jobId);
}

export function subscribeSavedJobsChange(callback: (jobs: Set<string>) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<Set<string>>;
    callback(customEvent.detail);
  };
  
  window.addEventListener(EVENT_NAME, handler);
  
  // Return unsubscribe function
  return () => window.removeEventListener(EVENT_NAME, handler);
}

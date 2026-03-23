import { useEffect, useState } from 'react';
import { getProgress } from '../../lib/tutorial-progress';

interface TutorialProgressProps {
  component: string;
}

export default function TutorialProgress({ component }: TutorialProgressProps) {
  const [progress, setProgress] = useState(0);
  const steps = [
    { label: 'Installation', icon: '📦' },
    { label: 'First Task', icon: '🎯' },
    { label: 'Use Cases', icon: '💼' },
    { label: 'Pro Tips', icon: '⚡' }
  ];

  useEffect(() => {
    // Load progress from localStorage
    const saved = getProgress(component);
    if (saved) {
      setProgress((saved.stepsCompleted?.length || 0) * 25);
    }

    // Listen for progress updates
    const handleStorageChange = () => {
      const updated = getProgress(component);
      if (updated) {
        setProgress((updated.stepsCompleted?.length || 0) * 25);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [component]);

  return (
    <div className="px-6 py-4 border-b border-[#1f1f1f]">
      {/* Progress Bar */}
      <div className="relative h-1 bg-[#1f1f1f] rounded-full overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const isCompleted = progress > index * 25;
          const isCurrent = progress === index * 25;
          
          return (
            <div
              key={step.label}
              className={`flex flex-col items-center gap-1.5 transition-all ${
                isCompleted ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                isCompleted 
                  ? 'bg-emerald-500/10' 
                  : isCurrent 
                  ? 'bg-[#3b82f6]/10 ring-2 ring-[#3b82f6]/30' 
                  : 'bg-[#0a0a0a]'
              }`}>
                {isCompleted ? '✓' : step.icon}
              </div>
              <span className={`text-[10px] text-center transition-colors ${
                isCompleted || isCurrent ? 'text-[#999]' : 'text-[#666]'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Text */}
      <div className="text-center mt-3 text-[11px] text-[#666]">
        {progress === 100 ? (
          <span className="text-emerald-400">🎉 Tutorial completed!</span>
        ) : (
          <span>{progress}% complete</span>
        )}
      </div>
    </div>
  );
}

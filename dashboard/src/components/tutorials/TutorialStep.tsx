import { useState, useEffect } from 'react';
import { saveProgress, isStepCompleted } from '../../lib/tutorial-progress';

interface TutorialStepProps {
  component: string;
  number: number;
  title: string;
  children: React.ReactNode;
}

export default function TutorialStep({
  component,
  number,
  title,
  children
}: TutorialStepProps) {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setCompleted(isStepCompleted(component, number));
  }, [component, number]);

  const handleComplete = () => {
    saveProgress(component, number);
    setCompleted(true);
    
    // Trigger storage event for other components
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className={`mb-8 ${completed ? 'opacity-75' : ''}`}>
      {/* Step Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-semibold transition-all ${
          completed 
            ? 'bg-emerald-500/10 text-emerald-400' 
            : 'bg-[#3b82f6]/10 text-[#3b82f6]'
        }`}>
          {completed ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            number
          )}
        </div>
        <h2 className="text-[15px] font-semibold text-[#ededed]">
          {title}
        </h2>
      </div>

      {/* Step Content */}
      <div className="ml-11 space-y-4">
        {children}
        
        {/* Complete Button */}
        {!completed && (
          <button
            onClick={handleComplete}
            className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] rounded-lg text-[13px] font-medium text-[#999] hover:text-[#ededed] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark as Complete
          </button>
        )}
        
        {completed && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Completed
          </div>
        )}
      </div>
    </div>
  );
}

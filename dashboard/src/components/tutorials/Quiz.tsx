import { useState } from 'react';

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

interface QuizProps {
  questions: QuizQuestion[];
  onComplete?: (score: number) => void;
}

export default function Quiz({ questions, onComplete }: QuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return; // Already answered
    
    setSelectedAnswer(index);
    const isCorrect = index === questions[currentQuestion].correct;
    
    if (isCorrect) {
      setScore(score + 1);
    }
    
    setAnswers([...answers, index]);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
      if (onComplete) {
        onComplete(score);
      }
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setAnswers([]);
  };

  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    const passed = percentage >= 70;

    return (
      <div className="rounded-lg bg-[#0a0a0a] border border-[#1f1f1f] p-6">
        <div className="text-center">
          <div className={`text-5xl mb-4 ${passed ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {passed ? '🎉' : '📚'}
          </div>
          <h3 className="text-[15px] font-semibold text-[#ededed] mb-2">
            {passed ? 'Great Job!' : 'Keep Learning!'}
          </h3>
          <p className="text-[13px] text-[#999] mb-4">
            You scored {score} out of {questions.length} ({percentage}%)
          </p>
          
          {passed ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-4">
              <p className="text-[12px] text-emerald-400">
                ✓ You've mastered this tutorial! Ready for the next one?
              </p>
            </div>
          ) : (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
              <p className="text-[12px] text-yellow-400">
                Review the tutorial and try again to improve your score.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            <button
              onClick={handleRestart}
              className="px-4 py-2 bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] rounded-lg text-[13px] font-medium text-[#999] hover:text-[#ededed] transition-all"
            >
              Try Again
            </button>
            <a
              href="/tutorials"
              className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-[13px] font-medium transition-all"
            >
              Browse Tutorials
            </a>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="rounded-lg bg-[#0a0a0a] border border-[#1f1f1f] overflow-hidden">
      {/* Progress */}
      <div className="h-1 bg-[#1f1f1f]">
        <div
          className="h-full bg-[#3b82f6] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-6">
        {/* Question Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] text-[#666]">
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span className="text-[11px] text-[#666]">
            Score: {score}/{currentQuestion + (selectedAnswer !== null ? 1 : 0)}
          </span>
        </div>

        {/* Question */}
        <h3 className="text-[15px] font-semibold text-[#ededed] mb-4">
          {question.question}
        </h3>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === question.correct;
            const showCorrect = selectedAnswer !== null && isCorrect;
            const showIncorrect = selectedAnswer !== null && isSelected && !isCorrect;

            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={selectedAnswer !== null}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  showCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : showIncorrect
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : isSelected
                    ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]'
                    : 'bg-[#111] border-[#1f1f1f] text-[#999] hover:border-[#2a2a2a] hover:text-[#ededed]'
                } ${selectedAnswer !== null ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    showCorrect
                      ? 'border-emerald-400 bg-emerald-400'
                      : showIncorrect
                      ? 'border-red-400 bg-red-400'
                      : isSelected
                      ? 'border-[#3b82f6] bg-[#3b82f6]'
                      : 'border-[#2a2a2a]'
                  }`}>
                    {showCorrect && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {showIncorrect && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[13px]">{option}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {selectedAnswer !== null && question.explanation && (
          <div className="p-3 bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-lg mb-4">
            <div className="text-[11px] text-[#3b82f6] font-medium mb-1">Explanation:</div>
            <p className="text-[12px] text-[#999] leading-relaxed">
              {question.explanation}
            </p>
          </div>
        )}

        {/* Next Button */}
        {selectedAnswer !== null && (
          <button
            onClick={handleNext}
            className="w-full px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-[13px] font-medium transition-all"
          >
            {currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}
          </button>
        )}
      </div>
    </div>
  );
}

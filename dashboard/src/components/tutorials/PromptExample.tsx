import { useState } from 'react';

interface PromptExampleProps {
  prompt: string;
  description?: string;
  result?: string;
}

export default function PromptExample({
  prompt,
  description,
  result
}: PromptExampleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg bg-[#0a0a0a] border border-[#1f1f1f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#3b82f6]/5 border-b border-[#1f1f1f]">
        <span className="text-[11px] text-[#3b82f6] font-medium">
          💡 Try this prompt
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 rounded text-[11px] text-[#3b82f6] transition-all"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Prompt */}
      <div className="p-3">
        <p className="text-[13px] text-[#ededed] leading-relaxed font-mono">
          {prompt}
        </p>
      </div>

      {/* Description */}
      {description && (
        <div className="px-3 pb-3">
          <p className="text-[12px] text-[#666] leading-relaxed">
            {description}
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="border-t border-[#1f1f1f] bg-[#111] p-3">
          <div className="text-[11px] text-[#666] mb-2">What you'll get:</div>
          <p className="text-[12px] text-[#999] leading-relaxed">
            {result}
          </p>
        </div>
      )}
    </div>
  );
}

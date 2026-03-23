import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language: string;
  copyable?: boolean;
  runnable?: boolean;
}

export default function CodeBlock({
  code,
  language,
  copyable = true,
  runnable = false
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg bg-[#0a0a0a] border border-[#1f1f1f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f1f1f]">
        <span className="text-[11px] text-[#666] font-medium uppercase tracking-wider">
          {language}
        </span>
        <div className="flex items-center gap-2">
          {runnable && (
            <button className="flex items-center gap-1.5 px-2 py-1 bg-[#111] hover:bg-[#1a1a1a] rounded text-[11px] text-[#999] hover:text-[#ededed] transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run
            </button>
          )}
          {copyable && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2 py-1 bg-[#111] hover:bg-[#1a1a1a] rounded text-[11px] text-[#999] hover:text-[#ededed] transition-all"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400">Copied!</span>
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
          )}
        </div>
      </div>

      {/* Code */}
      <pre className="p-4 overflow-x-auto text-[12px] leading-relaxed text-[#ededed]">
        <code className={`language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}

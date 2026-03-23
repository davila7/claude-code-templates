import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function CopyButton({
  text,
  variant = 'primary',
  size = 'md',
  className = ''
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Variant styles
  const variantStyles = {
    primary: 'bg-[#3b82f6] hover:bg-[#2563eb] text-white',
    secondary: 'bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] text-[#999] hover:text-[#ededed]',
    icon: 'p-1.5 rounded hover:bg-[#111] text-[#666] hover:text-[#ededed]'
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-2 py-1 text-[11px]',
    md: 'px-3 py-2 text-[12px]',
    lg: 'px-4 py-2 text-[13px]'
  };

  // Icon size
  const iconSize = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4.5 h-4.5'
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleCopy}
        className={`${variantStyles.icon} ${className} transition-colors`}
        title={copied ? 'Copied!' : 'Copy command'}
      >
        {copied ? (
          <svg className={iconSize[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={iconSize[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-2 ${variantStyles[variant]} ${sizeStyles[size]} ${className} rounded-lg font-medium transition-colors`}
    >
      {copied ? (
        <>
          <svg className={iconSize[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg className={iconSize[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <span>Copy Command</span>
        </>
      )}
    </button>
  );
}
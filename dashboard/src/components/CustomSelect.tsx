import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({ value, onChange, options, placeholder, className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#111] border border-[#1f1f1f] hover:border-[#333] rounded-lg px-3 py-2 text-[12px] text-left transition-colors flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {selectedOption?.icon && (
            <img 
              src={selectedOption.icon} 
              alt="" 
              className="w-4 h-4 rounded object-contain shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <span className={`truncate ${selectedOption?.color || 'text-[#a1a1a1]'}`}>
            {selectedOption?.label || placeholder || 'Select...'}
          </span>
        </span>
        <svg 
          className={`w-4 h-4 text-[#666] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg shadow-2xl max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-[12px] text-left transition-colors flex items-center gap-2 ${
                value === option.value
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-[#a1a1a1] hover:bg-white/[0.04] hover:text-[#ededed]'
              }`}
            >
              {option.icon && (
                <img 
                  src={option.icon} 
                  alt="" 
                  className="w-4 h-4 rounded object-contain shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span className={option.color || ''}>{option.label}</span>
              {value === option.value && (
                <svg className="w-4 h-4 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

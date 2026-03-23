import { useState } from 'react';
import type { ComponentType, GenerateResponse } from '../lib/types';
import ComponentPreview from './ComponentPreview';

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (component: { name: string; content: string; type: ComponentType }) => void;
}

const COMPONENT_TYPES: { value: ComponentType; label: string }[] = [
  { value: 'agents', label: 'Agent' },
  { value: 'commands', label: 'Command' },
  { value: 'skills', label: 'Skill' },
  { value: 'hooks', label: 'Hook' },
  { value: 'settings', label: 'Setting' },
];

const EXAMPLES = {
  agents: 'Create an agent that reviews Python code for security vulnerabilities and suggests fixes',
  commands: 'Create a command that sets up Jest testing framework with TypeScript support',
  skills: 'Create a skill document with React best practices for performance optimization',
  hooks: 'Create a hook that runs ESLint automatically when TypeScript files are saved',
  settings: 'Create a strict TypeScript configuration for maximum type safety',
};

export default function GenerateModal({ open, onClose, onSave }: GenerateModalProps) {
  const [step, setStep] = useState<'input' | 'generating' | 'preview'>('input');
  const [type, setType] = useState<ComponentType>('agents');
  const [description, setDescription] = useState('');
  const [generated, setGenerated] = useState<string>('');
  const [componentName, setComponentName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (description.length < 20) {
      setError('Please provide a more detailed description (at least 20 characters)');
      return;
    }

    setLoading(true);
    setStep('generating');
    setError(null);

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer user_temp_id`, // TODO: Replace with actual Clerk token
        },
        body: JSON.stringify({ type, description }),
      });

      const data: GenerateResponse = await response.json();

      if (data.success && data.component) {
        setGenerated(data.component.content);
        setComponentName(data.component.name);
        setRateLimitRemaining(data.rateLimitRemaining ?? null);
        setStep('preview');
      } else {
        setError(data.error || 'Generation failed');
        setStep('input');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    setStep('input');
    setGenerated('');
    setError(null);
  };

  const handleSave = () => {
    if (onSave && generated) {
      onSave({ name: componentName, content: generated, type });
      handleClose();
    }
  };

  const handleClose = () => {
    setStep('input');
    setType('agents');
    setDescription('');
    setGenerated('');
    setComponentName('');
    setError(null);
    setRateLimitRemaining(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-surface-1 rounded-xl shadow-2xl border border-border max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {step === 'preview' ? 'Generated Component' : 'Generate Component'}
              </h2>
              {rateLimitRemaining !== null && (
                <p className="text-xs text-text-tertiary mt-0.5">
                  {rateLimitRemaining} generations remaining this month
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'input' && (
            <div className="space-y-6">
              {/* Component Type Selector */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-3">
                  Component Type
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {COMPONENT_TYPES.map((ct) => (
                    <button
                      key={ct.value}
                      onClick={() => setType(ct.value)}
                      className={`p-3 rounded-lg border transition-all ${
                        type === ct.value
                          ? 'bg-accent-500/20 border-accent-500 text-text-primary shadow-sm'
                          : 'bg-surface-2 border-border text-text-secondary hover:bg-surface-3 hover:border-border-hover'
                      }`}
                    >
                      <div className="text-xs font-medium">{ct.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Describe what you want
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={EXAMPLES[type]}
                  className="w-full h-32 p-4 bg-surface-2 text-text-primary rounded-lg border border-border focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 resize-none placeholder:text-text-tertiary"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-text-tertiary">
                    Be specific about what you want the component to do
                  </p>
                  <p className="text-xs text-text-tertiary">{description.length} characters</p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-6">
                <div className="w-20 h-20 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
              </div>
              <p className="text-lg text-text-primary font-medium">Generating your component...</p>
              <p className="text-sm text-text-tertiary mt-2">This usually takes 3-5 seconds</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <ComponentPreview
                content={generated}
                type={type}
                editable={true}
                onEdit={(newContent) => setGenerated(newContent)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-2">
          {step === 'input' && (
            <>
              <button
                onClick={handleClose}
                className="px-5 py-2.5 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || description.length < 20}
                className="px-6 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Generate</span>
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={handleRegenerate}
                className="px-5 py-2.5 text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Regenerate</span>
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 bg-surface-3 hover:bg-surface-4 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all shadow-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Component</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

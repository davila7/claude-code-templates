import { useState, useEffect } from 'react';

interface SaveCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CollectionData) => Promise<void>;
  componentCount?: number;
  hooksCount?: number;
}

interface CollectionData {
  name: string;
  description: string;
  isPublic: boolean;
}

export default function SaveCollectionModal({
  isOpen,
  onClose,
  onSave,
  componentCount = 1,
  hooksCount = 0,
}: SaveCollectionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setIsPublic(false);
      setError('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Collection name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), isPublic });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalItems = componentCount + hooksCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-surface-1 border border-border rounded-xl shadow-2xl animate-modal-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-text-primary">
            Save Stack as Collection
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors rounded-md hover:bg-surface-2"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Collection Name */}
          <div>
            <label htmlFor="collectionName" className="block text-[12px] font-medium text-text-primary mb-2">
              Collection Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="collectionName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Full-Stack Dev Setup"
              maxLength={100}
              className="w-full bg-surface-0 border border-border rounded-lg text-[13px] text-text-primary placeholder:text-text-tertiary px-3 py-2.5 outline-none focus:bg-surface-0 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="collectionDescription" className="block text-[12px] font-medium text-text-primary mb-2">
              Description <span className="text-[11px] text-text-tertiary font-normal">(optional)</span>
            </label>
            <textarea
              id="collectionDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this collection is for..."
              maxLength={500}
              rows={3}
              className="w-full bg-surface-0 border border-border rounded-lg text-[13px] text-text-primary placeholder:text-text-tertiary px-3 py-2.5 outline-none focus:bg-surface-0 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all resize-none"
            />
          </div>

          {/* Make Public Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className="w-full flex items-start gap-3 p-4 bg-surface-0 border border-border rounded-lg hover:border-border-hover transition-all group"
            >
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isPublic
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-surface-0 border-border group-hover:border-border-hover'
                  }`}
                >
                  {isPublic && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  Make Public
                </div>
                <div className="text-[12px] text-text-secondary">
                  Allow others to discover and use this collection
                </div>
              </div>
            </button>
          </div>

          {/* Stack Summary */}
          <div className="p-4 bg-surface-0 border border-border rounded-lg">
            <div className="text-[12px] font-medium text-text-secondary mb-2">
              Stack Contents
            </div>
            <div className="flex items-center gap-4 text-[13px]">
              {componentCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  <span className="text-text-primary font-medium">{componentCount}</span>
                  <span className="text-text-secondary">
                    {componentCount === 1 ? 'component' : 'components'}
                  </span>
                </div>
              )}
              {hooksCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-text-primary font-medium">{hooksCount}</span>
                  <span className="text-text-secondary">
                    {hooksCount === 1 ? 'hook' : 'hooks'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-[12px] text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-500"
            >
              {isSubmitting ? 'Saving...' : 'Save Collection'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-surface-0 hover:bg-surface-2 border border-border text-text-secondary hover:text-text-primary rounded-lg text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

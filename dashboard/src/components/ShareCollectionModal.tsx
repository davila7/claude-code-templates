import { useState } from 'react';
import { collectionsApi } from '../lib/collections-api';
import type { Collection } from '../lib/types';

interface Props {
  collection: Collection;
  onClose: () => void;
  onUpdate: (updated: Collection) => void;
}

export default function ShareCollectionModal({ collection, onClose, onUpdate }: Props) {
  const [isPublic, setIsPublic] = useState(collection.is_public);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = collection.slug 
    ? `${window.location.origin}/collection/${collection.slug}`
    : '';

  async function handleTogglePublic() {
    setSaving(true);
    try {
      const clerk = (window as any).Clerk;
      const token = await clerk?.session?.getToken();
      if (!token) return;

      const updated = await collectionsApi.update(token, collection.id, {
        isPublic: !isPublic
      });
      
      setIsPublic(updated.is_public);
      onUpdate(updated);
    } catch (err) {
      console.error('Failed to update visibility:', err);
      alert('Failed to update collection visibility');
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareToTwitter() {
    if (!shareUrl) return;
    const text = `"${collection.name}" collection on Claude Code Templates\n\n${shareUrl}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }

  function shareToLinkedIn() {
    if (!shareUrl) return;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-1 border border-border rounded-xl shadow-2xl z-[70] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Share Collection</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {/* Public Toggle */}
            <div className="flex items-start gap-3 p-4 bg-surface-2 rounded-lg border border-border hover:border-border-hover transition-colors">
              <button
                onClick={handleTogglePublic}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-all ${
                  isPublic ? 'bg-accent-500' : 'bg-surface-4'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    isPublic ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium text-text-primary mb-1">Make Public</div>
                <div className="text-xs text-text-tertiary leading-relaxed">
                  {isPublic 
                    ? 'Anyone with the link can view this collection'
                    : 'Only you can see this collection'
                  }
                </div>
              </div>
            </div>

            {isPublic && shareUrl && (
              <>
                {/* Share Link */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Share Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text-secondary focus:outline-none select-all"
                    />
                    <button
                      onClick={copyLink}
                      className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                      {copied ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </span>
                      ) : (
                        'Copy'
                      )}
                    </button>
                  </div>
                </div>

                {/* Social Share */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Share on Social Media
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={shareToTwitter}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Twitter
                    </button>
                    <button
                      onClick={shareToLinkedIn}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0A66C2] hover:bg-[#004182] text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="p-4 bg-surface-2 rounded-lg border border-border">
                  <div className="text-xs font-medium text-text-tertiary mb-3">
                    Collection Stats
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-text-primary">
                          {collection.view_count || 0}
                        </div>
                        <div className="text-xs text-text-tertiary">Views</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-text-primary">
                          {collection.like_count || 0}
                        </div>
                        <div className="text-xs text-text-tertiary">Likes</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-2">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-surface-3 hover:bg-surface-4 text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

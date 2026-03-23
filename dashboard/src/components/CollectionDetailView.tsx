import { useState, useEffect } from 'react';
import { collectionsApi } from '../lib/collections-api';
import { TYPE_CONFIG } from '../lib/icons';
import TypeIcon from './TypeIcon';
import FileViewer from './FileViewer';
import type { Collection, CollectionItem } from '../lib/types';

interface Props {
  slug: string;
}

function useGlobalAuth() {
  const [state, setState] = useState({ isSignedIn: false, isLoaded: false });

  useEffect(() => {
    function check() {
      const clerk = (window as any).Clerk;
      if (clerk?.loaded) {
        setState({ isSignedIn: !!clerk.user, isLoaded: true });
      }
    }
    check();
    const interval = setInterval(check, 500);
    const handleChange = () => check();
    window.addEventListener('clerk:session', handleChange);
    return () => { clearInterval(interval); window.removeEventListener('clerk:session', handleChange); };
  }, []);

  const getToken = async () => {
    const clerk = (window as any).Clerk;
    return clerk?.session?.getToken() ?? null;
  };

  return { ...state, getToken };
}

const TYPE_FLAGS: Record<string, string> = {
  agents: '--agent', commands: '--command', settings: '--setting',
  hooks: '--hook', mcps: '--mcp', skills: '--skill', templates: '--template',
};

function cleanPath(path: string): string {
  return path?.replace(/\.(md|json)$/, '') ?? '';
}

function formatName(name: string): string {
  if (!name) return '';
  return name.replace(/\.(md|json)$/, '').replace(/[-_]/g, ' ')
    .split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function pluralType(type: string): string {
  return type.endsWith('s') ? type : type + 's';
}

const TYPE_ORDER = ['skills', 'agents', 'commands', 'settings', 'hooks', 'mcps'] as const;

function groupByType(items: CollectionItem[]): { type: string; label: string; color: string; items: CollectionItem[] }[] {
  const map: Record<string, CollectionItem[]> = {};
  for (const item of items) {
    const t = pluralType(item.component_type);
    if (!map[t]) map[t] = [];
    map[t].push(item);
  }
  return TYPE_ORDER
    .filter((t) => map[t]?.length)
    .map((t) => ({
      type: t,
      label: TYPE_CONFIG[t]?.label ?? t,
      color: TYPE_CONFIG[t]?.color ?? '#888',
      items: map[t],
    }));
}

function generateCommand(items: CollectionItem[]): string {
  const grouped: Record<string, string[]> = {};
  for (const item of items) {
    const t = pluralType(item.component_type);
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(cleanPath(item.component_path));
  }
  let cmd = 'npx claude-code-templates@latest';
  for (const [type, paths] of Object.entries(grouped)) {
    const flag = TYPE_FLAGS[type];
    if (flag) cmd += ` ${flag} ${paths.join(',')}`;
  }
  return cmd;
}

export default function CollectionDetailView({ slug }: Props) {
  const { isSignedIn, isLoaded, getToken } = useGlobalAuth();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ name: string; path: string; type: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCollection();
  }, [slug]);

  async function loadCollection() {
    setLoading(true);
    setError(null);
    try {
      const token = isSignedIn ? await getToken() : undefined;
      const col = await collectionsApi.getBySlug(slug, token);
      setCollection(col);
    } catch (err: any) {
      console.error('Failed to load collection:', err);
      setError(err.message || 'Collection not found');
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate() {
    if (!isSignedIn) {
      alert('Please sign in to duplicate collections');
      return;
    }

    setDuplicating(true);
    try {
      const token = await getToken();
      if (!token) return;

      await collectionsApi.duplicate(token, collection!.id);
      alert('Collection duplicated to your collections');
      window.location.href = '/my-components';
    } catch (err) {
      console.error('Failed to duplicate:', err);
      alert('Failed to duplicate collection');
    } finally {
      setDuplicating(false);
    }
  }

  async function handleLike() {
    if (!isSignedIn) {
      alert('Please sign in to like collections');
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const result = await collectionsApi.toggleLike(token, collection!.id);
      setCollection(prev => prev ? {
        ...prev,
        is_liked: result.liked,
        like_count: (prev.like_count || 0) + (result.liked ? 1 : -1)
      } : null);
    } catch (err) {
      console.error('Failed to like:', err);
    }
  }

  function copyShareLink() {
    const url = `${window.location.origin}/collection/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCommand() {
    if (!collection) return;
    const text = generateCommand(collection.collection_items);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((err) => {
      console.error('Failed to copy:', err);
      // Fallback: try using the older execCommand method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        alert('Failed to copy to clipboard. Please copy manually.');
      }
      document.body.removeChild(textArea);
    });
  }

  function startEditingName() {
    if (!collection) return;
    setEditedName(collection.name);
    setIsEditingName(true);
  }

  async function saveName() {
    if (!collection || !editedName.trim() || editedName === collection.name) {
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      const token = await getToken();
      if (!token) return;

      const updated = await collectionsApi.update(token, collection.id, { name: editedName.trim() });
      setCollection(updated);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
      alert('Failed to update collection name');
    } finally {
      setSavingName(false);
    }
  }

  function cancelEditingName() {
    setIsEditingName(false);
    setEditedName('');
  }

  function openFileViewer(item: CollectionItem) {
    setViewingFile({
      name: item.component_name,
      path: item.component_path,
      type: item.component_type
    });
  }

  function closeFileViewer() {
    setViewingFile(null);
  }

  async function togglePublic() {
    if (!collection) return;

    try {
      const token = await getToken();
      if (!token) return;

      const updated = await collectionsApi.update(token, collection.id, { 
        isPublic: !collection.is_public 
      });
      setCollection(updated);
    } catch (err) {
      console.error('Failed to update visibility:', err);
      alert('Failed to update collection visibility');
    }
  }

  async function handleDelete() {
    if (!collection) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete "${collection.name}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;

      await collectionsApi.delete(token, collection.id);
      alert('Collection deleted successfully');
      window.location.href = '/my-components';
    } catch (err) {
      console.error('Failed to delete collection:', err);
      alert('Failed to delete collection');
    } finally {
      setDeleting(false);
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[--color-text-tertiary] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[--color-surface-3] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[--color-text-primary] mb-2">Collection Not Found</h2>
        <p className="text-sm text-[--color-text-tertiary] mb-6">
          {error || 'This collection does not exist or is not public.'}
        </p>
        <a
          href="/collections/public"
          className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Browse Collections
        </a>
      </div>
    );
  }

  const items = collection.collection_items || [];

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="max-w-5xl mx-auto p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-6">
          <a href="/collections/public" className="hover:text-text-secondary transition-colors">
            Public Collections
          </a>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-text-secondary font-medium">{collection.name}</span>
        </div>

        {/* Header */}
        <div className="mb-8 pb-6 border-b border-border">
          {/* Editable Name with smooth transition */}
          <div className="mb-3">
            {isEditingName ? (
              <div className="flex items-center gap-2 animate-in fade-in duration-200">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') cancelEditingName();
                  }}
                  onBlur={saveName}
                  className="flex-1 text-3xl font-bold text-text-primary bg-transparent border-0 border-b-2 border-accent-500 px-0 py-1 focus:outline-none focus:ring-0 transition-all"
                  style={{ caretColor: 'var(--color-accent-500)' }}
                  autoFocus
                  disabled={savingName}
                />
                {savingName && (
                  <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            ) : (
              <h1 
                className="text-3xl font-bold text-text-primary cursor-text hover:text-accent-500 transition-all duration-200 inline-flex items-center gap-2 group py-1"
                onClick={startEditingName}
                title="Click to edit collection name"
              >
                {collection.name}
                <svg className="w-5 h-5 opacity-0 group-hover:opacity-60 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </h1>
            )}
          </div>
          
          {collection.description && (
            <p className="text-base text-text-secondary mb-4 leading-relaxed">
              {collection.description}
            </p>
          )}

          {/* Settings Toggle Button */}
          <div className="mb-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-surface-1 hover:bg-surface-2 border border-border hover:border-border-hover rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-all duration-200"
            >
              <svg 
                className={`w-4 h-4 transition-transform duration-300 ${showSettings ? 'rotate-90' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Collection Settings
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Collapsible Settings Panel */}
          <div 
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showSettings ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-5 bg-surface-1 border border-border rounded-xl space-y-4">
              {/* Public Access Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      {collection.is_public ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary mb-1">
                      Public Access
                    </div>
                    <div className="text-xs text-text-tertiary leading-relaxed">
                      When enabled, anyone with the link can view these skills
                    </div>
                  </div>
                </div>
                <button
                  onClick={togglePublic}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 ${
                    collection.is_public ? 'bg-accent-500 shadow-lg shadow-accent-500/30' : 'bg-surface-3'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                      collection.is_public ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Share Link Section */}
              {collection.is_public && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Share Link
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={`${window.location.origin}/collection/${slug}`}
                      readOnly
                      className="flex-1 px-3 py-2 bg-surface-0 border border-border rounded-lg text-xs font-mono text-text-secondary focus:outline-none focus:border-accent-500 transition-colors"
                    />
                    <button
                      onClick={copyShareLink}
                      className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      {copied ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </span>
                      ) : (
                        'Copy Link'
                      )}
                    </button>
                  </div>
                  
                  {/* Invite Collaborators (Placeholder) */}
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-lg text-xs font-medium text-text-tertiary cursor-not-allowed opacity-50"
                    title="Coming soon"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Invite Collaborators (Coming Soon)
                  </button>
                </div>
              )}

              {/* Danger Zone */}
              <div className="pt-4 border-t border-red-500/20">
                <div className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Danger Zone
                </div>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Collection
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Tags */}
          {collection.tags && collection.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {collection.tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 text-xs bg-surface-2 text-text-secondary rounded-full border border-border">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-5 text-sm text-text-tertiary mb-6">
            <span className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <span className="font-medium text-text-primary">{items.length}</span>
              <span>components</span>
            </span>
            <span className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="font-medium text-text-primary">{collection.view_count || 0}</span>
              <span>views</span>
            </span>
            <span className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                <svg className="w-4 h-4" fill={collection.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="font-medium text-text-primary">{collection.like_count || 0}</span>
              <span>likes</span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
            >
              {duplicating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Duplicating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Duplicate to My Collections
                </>
              )}
            </button>
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                collection.is_liked
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border border-border'
              }`}
            >
              <svg className="w-4 h-4" fill={collection.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {collection.is_liked ? 'Liked' : 'Like'}
            </button>
            <button
              onClick={copyShareLink}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary rounded-lg text-sm font-medium transition-all border border-border"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Install Command */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Install All Components
          </h3>
          <div className="bg-surface-1 border border-border rounded-lg p-4 flex items-start gap-3 hover:border-border-hover transition-colors">
            <code className="flex-1 text-xs text-text-secondary font-mono break-all leading-relaxed">
              <span className="text-text-tertiary select-none">$ </span>
              {generateCommand(items)}
            </code>
            <button
              onClick={copyCommand}
              className="shrink-0 p-2 rounded-lg hover:bg-surface-2 text-text-tertiary hover:text-text-primary transition-colors"
              title="Copy command"
            >
              {copied ? (
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Components */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Components ({items.length})
          </h3>

          {groupByType(items).map((group) => (
            <div key={group.type} className="bg-surface-1 border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${group.color}18`, color: group.color }}
                >
                  <TypeIcon type={group.type} size={16} />
                </div>
                <h4 className="text-sm font-semibold" style={{ color: group.color }}>
                  {group.label}
                </h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-tertiary border border-border">
                  {group.items.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {group.items.map((item) => {
                  const config = TYPE_CONFIG[group.type];
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3.5 rounded-lg bg-surface-0 border border-border hover:border-border-hover transition-all duration-200 group"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: config ? `${config.color}12` : '#ffffff08', color: config?.color ?? '#888' }}
                      >
                        <TypeIcon type={group.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-text-primary group-hover:text-accent-500 transition-colors line-clamp-1">
                          {formatName(item.component_name)}
                        </div>
                        {item.component_category && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-text-tertiary border border-border">
                              {item.component_category}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            onClick={() => openFileViewer(item)}
                            className="flex items-center gap-1 px-2 py-1 bg-accent-500/10 hover:bg-accent-500/20 text-accent-500 rounded text-[10px] font-medium transition-all"
                            title="View file"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View File
                          </button>
                          <a
                            href={`/component/${item.component_type}/${cleanPath(item.component_path)}`}
                            className="flex items-center gap-1 px-2 py-1 bg-surface-2 hover:bg-surface-3 text-text-tertiary hover:text-text-primary rounded text-[10px] font-medium transition-all border border-border"
                            title="View details"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            Details
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* File Viewer Modal */}
      {viewingFile && (
        <FileViewer
          fileName={viewingFile.name}
          filePath={viewingFile.path}
          fileType={viewingFile.type}
          onClose={closeFileViewer}
        />
      )}
    </div>
  );
}

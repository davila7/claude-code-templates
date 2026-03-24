import { useState, useEffect, useRef } from 'react';
import { collectionsApi } from '../lib/collections-api';
import type { Collection } from '../lib/types';

// Hook that reads auth state from Clerk's global instance (window.Clerk)
// Works without needing a ClerkProvider in the same React tree
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
    // Re-check periodically until Clerk loads
    const interval = setInterval(check, 500);
    // Also listen for clerk state changes
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

interface Props {
  componentType: string;
  componentPath: string;
  componentName: string;
  componentCategory?: string;
}

function SaveButton({ componentType, componentPath, componentName, componentCategory }: Props) {
  const { isSignedIn, isLoaded, getToken } = useGlobalAuth();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [savedIn, setSavedIn] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function loadCollections() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const cols = await collectionsApi.list(token);
      setCollections(cols);

      // Track which collections already contain this component
      const saved = new Set<string>();
      for (const col of cols) {
        if (col.collection_items?.some((i) => i.component_path === componentPath && i.component_type === componentType)) {
          saved.add(col.id);
        }
      }
      setSavedIn(saved);
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open) {
      setOpen(true);
      await loadCollections();
    } else {
      setOpen(false);
    }
  }

  async function handleToggleCollection(collectionId: string) {
    const token = await getToken();
    if (!token) return;

    try {
      if (savedIn.has(collectionId)) {
        // Remove from collection
        const col = collections.find((c) => c.id === collectionId);
        const item = col?.collection_items?.find(
          (i) => i.component_path === componentPath && i.component_type === componentType
        );
        if (item) {
          await collectionsApi.removeItem(token, item.id, collectionId);
          setSavedIn((prev) => {
            const next = new Set(prev);
            next.delete(collectionId);
            return next;
          });
          // Update local state
          setCollections((prev) =>
            prev.map((c) =>
              c.id === collectionId
                ? { ...c, collection_items: c.collection_items.filter((i) => i.id !== item.id) }
                : c
            )
          );
        }
      } else {
        // Add to collection
        const newItem = await collectionsApi.addItem(token, collectionId, {
          type: componentType,
          path: componentPath,
          name: componentName,
          category: componentCategory,
        });
        setSavedIn((prev) => new Set(prev).add(collectionId));
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId
              ? { ...c, collection_items: [...(c.collection_items ?? []), newItem] }
              : c
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to toggle collection item:', err);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const token = await getToken();
    if (!token) return;

    setCreating(true);
    try {
      const col = await collectionsApi.create(token, newName.trim());
      // Add item to the new collection immediately
      const newItem = await collectionsApi.addItem(token, col.id, {
        type: componentType,
        path: componentPath,
        name: componentName,
        category: componentCategory,
      });
      col.collection_items = [newItem];
      setCollections((prev) => [...prev, col]);
      setSavedIn((prev) => new Set(prev).add(col.id));
      setNewName('');
    } catch (err: any) {
      console.error('Failed to create collection:', err);
    } finally {
      setCreating(false);
    }
  }

  if (!isLoaded) return null;

  const isSaved = savedIn.size > 0;

  // Not signed in - open Clerk modal via global instance
  if (!isSignedIn) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); (window as any).Clerk?.openSignIn?.(); }}
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[--color-text-tertiary] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all"
        title="Sign in to save"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all ${
          isSaved
            ? 'text-blue-400'
            : 'text-[--color-text-tertiary] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10'
        }`}
        title={isSaved ? 'Saved to collection' : 'Save to collection'}
      >
        <svg className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1">
          {loading ? (
            <div className="px-3 py-4 text-center">
              <div className="w-4 h-4 border-2 border-[--color-text-tertiary] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[11px] font-medium text-[--color-text-tertiary] uppercase tracking-wide">
                Save to collection
              </div>

              {collections.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-[--color-text-tertiary]">
                  No collections yet
                </div>
              )}

              <div className="max-h-40 overflow-y-auto">
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={(e) => { e.stopPropagation(); handleToggleCollection(col.id); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/[0.06] transition-colors"
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      savedIn.has(col.id) ? 'bg-blue-500 border-blue-500' : 'border-[#444]'
                    }`}>
                      {savedIn.has(col.id) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{col.name}</span>
                    <span className="ml-auto text-[10px] text-[--color-text-tertiary]">
                      {col.collection_items?.length ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-t border-[#2a2a2a] mt-1 pt-1 px-2 pb-1">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="New collection..."
                    className="flex-1 bg-transparent border-none text-[12px] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] px-1 py-1 outline-none"
                    maxLength={100}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCreate(); }}
                    disabled={!newName.trim() || creating}
                    className="text-[11px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
                  >
                    {creating ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SaveToCollectionButton(props: Props) {
  return <SaveButton {...props} />;
}

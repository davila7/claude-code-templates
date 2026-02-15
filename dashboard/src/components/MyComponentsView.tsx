import { useState, useEffect, useRef } from 'react';
import { SignInButton, useAuth } from '@clerk/clerk-react';
import ClerkProviderWrapper from '../lib/clerk-provider';
import { collectionsApi } from '../lib/collections-api';
import { TYPE_CONFIG } from '../lib/icons';
import type { Collection, CollectionItem } from '../lib/types';

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

function generateCommand(items: CollectionItem[]): string {
  const grouped: Record<string, string[]> = {};
  for (const item of items) {
    const typePlural = item.component_type.endsWith('s') ? item.component_type : item.component_type + 's';
    if (!grouped[typePlural]) grouped[typePlural] = [];
    grouped[typePlural].push(cleanPath(item.component_path));
  }

  let cmd = 'npx claude-code-templates@latest';
  for (const [type, paths] of Object.entries(grouped)) {
    const flag = TYPE_FLAGS[type];
    if (flag) cmd += ` ${flag} ${paths.join(',')}`;
  }
  return cmd;
}

// Context menu for collection actions
function CollectionContextMenu({
  collection,
  onRename,
  onDelete,
  onClose,
}: {
  collection: Collection;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-36 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1">
      <button
        onClick={onRename}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/[0.06]"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Rename
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-red-400 hover:text-red-300 hover:bg-white/[0.06]"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>
    </div>
  );
}

function MyComponentsContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [movingItem, setMovingItem] = useState<{ item: CollectionItem; fromId: string } | null>(null);

  useEffect(() => {
    if (isSignedIn) loadCollections();
  }, [isSignedIn]);

  async function loadCollections() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const cols = await collectionsApi.list(token);
      setCollections(cols);
      if (cols.length > 0 && !selectedId) setSelectedId(cols[0].id);
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const token = await getToken();
    if (!token) return;

    setCreating(true);
    try {
      const col = await collectionsApi.create(token, newName.trim());
      setCollections((prev) => [...prev, col]);
      setSelectedId(col.id);
      setNewName('');
    } catch (err: any) {
      console.error('Failed to create collection:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    const token = await getToken();
    if (!token) return;

    try {
      await collectionsApi.rename(token, id, renameValue.trim());
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: renameValue.trim() } : c))
      );
      setRenaming(null);
    } catch (err: any) {
      console.error('Failed to rename:', err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this collection and all its items?')) return;
    const token = await getToken();
    if (!token) return;

    try {
      await collectionsApi.delete(token, id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) {
        const remaining = collections.filter((c) => c.id !== id);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error('Failed to delete:', err);
    }
    setContextMenu(null);
  }

  async function handleRemoveItem(item: CollectionItem, collectionId: string) {
    const token = await getToken();
    if (!token) return;

    try {
      await collectionsApi.removeItem(token, item.id, collectionId);
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? { ...c, collection_items: c.collection_items.filter((i) => i.id !== item.id) }
            : c
        )
      );
    } catch (err: any) {
      console.error('Failed to remove item:', err);
    }
  }

  async function handleMoveItem(toCollectionId: string) {
    if (!movingItem) return;
    const token = await getToken();
    if (!token) return;

    try {
      const updated = await collectionsApi.moveItem(
        token, movingItem.item.id, movingItem.fromId, toCollectionId
      );
      setCollections((prev) =>
        prev.map((c) => {
          if (c.id === movingItem.fromId) {
            return { ...c, collection_items: c.collection_items.filter((i) => i.id !== movingItem.item.id) };
          }
          if (c.id === toCollectionId) {
            return { ...c, collection_items: [...c.collection_items, updated] };
          }
          return c;
        })
      );
    } catch (err: any) {
      console.error('Failed to move item:', err);
    }
    setMovingItem(null);
  }

  function addToCart(item: CollectionItem) {
    const typePlural = item.component_type.endsWith('s') ? item.component_type : item.component_type + 's';
    try {
      const saved = localStorage.getItem('claudeCodeCart');
      const cart = saved ? JSON.parse(saved) : {};
      if (!cart[typePlural]) cart[typePlural] = [];
      const exists = cart[typePlural].some((i: any) => i.path === item.component_path);
      if (!exists) {
        cart[typePlural].push({
          name: item.component_name,
          path: item.component_path,
          category: item.component_category ?? '',
          description: '',
          icon: typePlural,
        });
        localStorage.setItem('claudeCodeCart', JSON.stringify(cart));
        window.dispatchEvent(new CustomEvent('cart-updated', { detail: cart }));
      }
    } catch {}
  }

  // Not loaded yet
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[--color-text-tertiary] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[--color-surface-3] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[--color-text-primary] mb-2">Save your favorite components</h2>
        <p className="text-sm text-[--color-text-tertiary] mb-6 max-w-sm">
          Sign in to create collections and organize the components you use most.
        </p>
        <SignInButton mode="modal">
          <button className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
            Sign In
          </button>
        </SignInButton>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[--color-text-tertiary] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedCollection = collections.find((c) => c.id === selectedId);
  const selectedItems = selectedCollection?.collection_items ?? [];

  return (
    <div className="flex h-full">
      {/* Collection sidebar */}
      <div className="w-60 border-r border-[--color-border] flex flex-col">
        <div className="px-4 py-3 border-b border-[--color-border]">
          <h2 className="text-sm font-semibold text-[--color-text-primary]">My Components</h2>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {collections.map((col) => (
            <div key={col.id} className="relative">
              {renaming === col.id ? (
                <div className="px-2 py-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(col.id);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    onBlur={() => handleRename(col.id)}
                    className="w-full bg-[--color-surface-3] border-none rounded text-[12px] text-[--color-text-primary] px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                    maxLength={100}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setSelectedId(col.id)}
                  className={`flex items-center gap-2 w-full px-2.5 py-[6px] rounded-md text-[13px] transition-colors group ${
                    selectedId === col.id
                      ? 'bg-[--color-surface-3] text-[--color-text-primary] font-medium'
                      : 'text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
                  </svg>
                  <span className="truncate flex-1 text-left">{col.name}</span>
                  <span className="text-[10px] text-[--color-text-tertiary]">
                    {col.collection_items?.length ?? 0}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setContextMenu(contextMenu === col.id ? null : col.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                    </svg>
                  </button>
                </button>
              )}

              {contextMenu === col.id && (
                <CollectionContextMenu
                  collection={col}
                  onRename={() => { setRenaming(col.id); setRenameValue(col.name); setContextMenu(null); }}
                  onDelete={() => handleDelete(col.id)}
                  onClose={() => setContextMenu(null)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Create new */}
        <div className="px-2 py-2 border-t border-[--color-border]">
          <div className="flex items-center gap-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="New collection..."
              className="flex-1 bg-transparent border-none text-[12px] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] px-2 py-1.5 outline-none"
              maxLength={100}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="p-1.5 rounded hover:bg-[--color-surface-3] text-[--color-text-tertiary] hover:text-[--color-text-primary] disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCollection ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[--color-surface-3] flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm text-[--color-text-secondary]">Create your first collection</p>
            <p className="text-xs text-[--color-text-tertiary] mt-1">
              Use the input below to create a collection, then save components from the browse pages.
            </p>
          </div>
        ) : selectedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[--color-surface-3] flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <p className="text-sm text-[--color-text-secondary]">
              "{selectedCollection.name}" is empty
            </p>
            <p className="text-xs text-[--color-text-tertiary] mt-1">
              Browse components and click the bookmark icon to save them here.
            </p>
            <a
              href="/skills"
              className="mt-4 px-4 py-2 bg-[--color-surface-3] hover:bg-[--color-surface-4] rounded-lg text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
            >
              Browse Components
            </a>
          </div>
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[--color-text-primary]">{selectedCollection.name}</h3>
                <span className="text-[11px] text-[--color-text-tertiary]">
                  {selectedItems.length} component{selectedItems.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateCommand(selectedItems));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[--color-surface-3] hover:bg-[--color-surface-4] rounded-lg text-[12px] text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Install Command
                  </>
                )}
              </button>
            </div>

            {/* Move-to dropdown */}
            {movingItem && (
              <div className="mb-4 p-3 bg-[--color-surface-2] border border-[--color-border] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-[--color-text-secondary]">
                    Move "{formatName(movingItem.item.component_name)}" to:
                  </span>
                  <button onClick={() => setMovingItem(null)} className="text-[--color-text-tertiary] hover:text-[--color-text-primary]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {collections
                    .filter((c) => c.id !== movingItem.fromId)
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleMoveItem(c.id)}
                        className="px-2.5 py-1 rounded-md bg-[--color-surface-3] hover:bg-[--color-surface-4] text-[12px] text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Items grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedItems.map((item) => {
                const typePlural = item.component_type.endsWith('s') ? item.component_type : item.component_type + 's';
                const config = TYPE_CONFIG[typePlural];

                return (
                  <div
                    key={item.id}
                    className="group flex items-start gap-3 p-4 rounded-xl bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a] hover:bg-[#151515] transition-all duration-200"
                  >
                    {/* Icon */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm"
                      style={{ backgroundColor: `${config?.color ?? '#a1a1a1'}15`, color: config?.color ?? '#a1a1a1' }}
                    >
                      {config?.icon ?? '📦'}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/component/${item.component_type}/${cleanPath(item.component_path)}`}
                        className="text-[13px] font-medium text-[--color-text-primary] hover:text-white transition-colors"
                      >
                        {formatName(item.component_name)}
                      </a>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[--color-text-tertiary]">
                          {config?.label ?? typePlural}
                        </span>
                        {item.component_category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[--color-text-tertiary]">
                            {item.component_category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => addToCart(item)}
                        className="p-1.5 rounded hover:bg-white/10 text-[--color-text-tertiary] hover:text-white transition-colors"
                        title="Add to stack"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      {collections.length > 1 && (
                        <button
                          onClick={() => setMovingItem({ item, fromId: selectedCollection!.id })}
                          className="p-1.5 rounded hover:bg-white/10 text-[--color-text-tertiary] hover:text-white transition-colors"
                          title="Move to another collection"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveItem(item, selectedCollection!.id)}
                        className="p-1.5 rounded hover:bg-white/10 text-[--color-text-tertiary] hover:text-red-400 transition-colors"
                        title="Remove from collection"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Install command preview */}
            <div className="mt-6 bg-[--color-surface-2] rounded-lg p-3">
              <div className="text-[11px] font-medium text-[--color-text-tertiary] mb-1.5">Install Command</div>
              <code className="text-[12px] text-[--color-text-secondary] font-mono break-all">
                {generateCommand(selectedItems)}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyComponentsView() {
  return (
    <ClerkProviderWrapper
      fallback={
        <div className="flex items-center justify-center h-full text-center px-6">
          <p className="text-sm text-[--color-text-tertiary]">Authentication not configured</p>
        </div>
      }
    >
      <MyComponentsContent />
    </ClerkProviderWrapper>
  );
}

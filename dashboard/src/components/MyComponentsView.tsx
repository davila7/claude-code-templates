import { useState, useEffect, useRef } from 'react';
import { collectionsApi } from '../lib/collections-api';
import { TYPE_CONFIG } from '../lib/icons';
import TypeIcon from './TypeIcon';
import type { Collection, CollectionItem } from '../lib/types';

// ── Auth hook ────────────────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────
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

// ── Context menu ─────────────────────────────────────────────────────────
function CollectionContextMenu({
  onRename, onDelete, onClose,
}: {
  onRename: () => void; onDelete: () => void; onClose: () => void;
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
      <button onClick={onRename} className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/[0.06]">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        Rename
      </button>
      <button onClick={onDelete} className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-red-400 hover:text-red-300 hover:bg-white/[0.06]">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        Delete
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────
export default function MyComponentsView() {
  const { isSignedIn, isLoaded, getToken } = useGlobalAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [copied, setCopied] = useState(false);

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
      if (cols.length > 0 && !selectedId) {
        setSelectedId(cols[0].id);
        setExpandedIds(new Set([cols[0].id]));
      }
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  }

  function copyCommand(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Not loaded ──
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[--color-text-tertiary] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Not signed in ──
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
        <button
          onClick={() => (window as any).Clerk?.openSignIn?.()}
          className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  // ── Loading ──
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
      {/* ── Sidebar ── */}
      <div className="w-60 border-r border-[--color-border] flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-[--color-border]">
          <h2 className="text-sm font-semibold text-[--color-text-primary]">My Components</h2>
        </div>

        {/* Create new — top */}
        <div className="px-2 py-2 border-b border-[--color-border]">
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

        {/* Collections tree */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {collections.map((col) => {
            const isExpanded = expandedIds.has(col.id);
            const isSelected = selectedId === col.id;
            const items = col.collection_items ?? [];

            return (
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
                  <div
                    onClick={() => {
                      setSelectedId(col.id);
                      setExpandedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(col.id)) next.delete(col.id);
                        else next.add(col.id);
                        return next;
                      });
                    }}
                    role="button"
                    className={`flex items-center gap-1.5 w-full px-2 py-[6px] rounded-md text-[13px] transition-colors group cursor-pointer ${
                      isSelected
                        ? 'bg-[--color-surface-3] text-[--color-text-primary] font-medium'
                        : 'text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2]'
                    }`}
                  >
                    {/* Chevron */}
                    <svg
                      className={`w-3 h-3 shrink-0 text-[--color-text-tertiary] transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {/* Folder icon */}
                    <svg className="w-4 h-4 shrink-0 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
                    </svg>
                    <span className="truncate flex-1 text-left">{col.name}</span>
                    <span className="text-[10px] text-[--color-text-tertiary]">
                      {items.length}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setContextMenu(contextMenu === col.id ? null : col.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                      </svg>
                    </button>
                  </div>
                )}

                {contextMenu === col.id && (
                  <CollectionContextMenu
                    onRename={() => { setRenaming(col.id); setRenameValue(col.name); setContextMenu(null); }}
                    onDelete={() => handleDelete(col.id)}
                    onClose={() => setContextMenu(null)}
                  />
                )}

                {/* Expanded tree items */}
                {isExpanded && items.length > 0 && (
                  <div className="ml-3 pl-3 border-l border-[--color-border] mt-0.5 mb-1 space-y-px">
                    {items.map((item) => {
                      const type = pluralType(item.component_type);
                      const config = TYPE_CONFIG[type];
                      return (
                        <div
                          key={item.id}
                          className="group/item flex items-center gap-2 px-2 py-[5px] rounded-md text-[12px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2] transition-colors"
                        >
                          <TypeIcon type={type} size={14} className="w-3.5 h-3.5 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" />
                          <a
                            href={`/component/${item.component_type}/${cleanPath(item.component_path)}`}
                            className="truncate flex-1 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {formatName(item.component_name)}
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(item, col.id); }}
                            className="p-0.5 rounded hover:bg-white/10 text-[--color-text-tertiary] hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100 shrink-0"
                            title="Remove"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCollection ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-sm text-[--color-text-tertiary]">Select a collection</p>
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
              href="/agents"
              className="mt-4 px-4 py-2 bg-[--color-surface-3] hover:bg-[--color-surface-4] rounded-lg text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
            >
              Browse Components
            </a>
          </div>
        ) : (
          <div className="p-6">
            {/* Header + install command */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-[--color-text-primary]">{selectedCollection.name}</h3>
                <span className="text-[12px] text-[--color-text-tertiary]">
                  {selectedItems.length} component{selectedItems.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => copyCommand(generateCommand(selectedItems))}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-gray-100 transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                    Install All
                  </>
                )}
              </button>
            </div>

            {/* Install command */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 mb-6">
              <code className="text-[12px] text-[--color-text-secondary] font-mono break-all leading-relaxed">
                <span className="text-[--color-text-tertiary] select-none">$ </span>
                {generateCommand(selectedItems)}
              </code>
            </div>

            {/* Flat component list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {selectedItems.map((item) => {
                const type = pluralType(item.component_type);
                const config = TYPE_CONFIG[type];
                return (
                  <div
                    key={item.id}
                    className="group/card flex items-start gap-3 p-3.5 rounded-xl bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a] hover:bg-[#151515] transition-all duration-200"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: config ? `${config.color}12` : '#ffffff08', color: config?.color ?? '#888' }}
                    >
                      <TypeIcon type={type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/component/${item.component_type}/${cleanPath(item.component_path)}`}
                        className="text-[13px] font-medium text-[--color-text-primary] hover:text-white transition-colors line-clamp-1"
                      >
                        {formatName(item.component_name)}
                      </a>
                      <div className="flex items-center gap-1.5 mt-1">
                        {config && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${config.color}15`, color: config.color }}
                          >
                            {config.label}
                          </span>
                        )}
                        {item.component_category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[--color-text-tertiary]">
                            {item.component_category}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item, selectedCollection!.id)}
                      className="p-1.5 rounded hover:bg-white/10 text-[--color-text-tertiary] hover:text-red-400 transition-colors opacity-0 group-hover/card:opacity-100 shrink-0"
                      title="Remove"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

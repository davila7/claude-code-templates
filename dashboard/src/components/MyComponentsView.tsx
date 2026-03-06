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

// Type order for grouping
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

// ── Project structure tree ───────────────────────────────────────────────
// Maps component types to their real installation paths
interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  color?: string;
  componentType?: string;
  item?: CollectionItem;
  children?: TreeNode[];
}

function getFileName(item: CollectionItem): string {
  const t = pluralType(item.component_type);
  const name = item.component_name?.replace(/\.(md|json)$/, '') ?? '';
  if (t === 'agents') return `${name}.md`;
  if (t === 'commands') return `${name}.md`;
  if (t === 'skills') return name; // skills are folders
  if (t === 'hooks') return `${name}.json`;
  if (t === 'settings') return name; // merged into settings.json
  if (t === 'mcps') return name; // merged into .mcp.json
  return name;
}

function buildProjectTree(items: CollectionItem[]): TreeNode {
  const grouped: Record<string, CollectionItem[]> = {};
  for (const item of items) {
    const t = pluralType(item.component_type);
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(item);
  }

  const claudeChildren: TreeNode[] = [];

  // .claude/agents/
  if (grouped.agents?.length) {
    claudeChildren.push({
      name: 'agents',
      type: 'folder',
      color: TYPE_CONFIG.agents?.color,
      componentType: 'agents',
      children: grouped.agents.map((item) => ({
        name: getFileName(item),
        type: 'file' as const,
        color: TYPE_CONFIG.agents?.color,
        componentType: 'agents',
        item,
      })),
    });
  }

  // .claude/commands/
  if (grouped.commands?.length) {
    claudeChildren.push({
      name: 'commands',
      type: 'folder',
      color: TYPE_CONFIG.commands?.color,
      componentType: 'commands',
      children: grouped.commands.map((item) => ({
        name: getFileName(item),
        type: 'file' as const,
        color: TYPE_CONFIG.commands?.color,
        componentType: 'commands',
        item,
      })),
    });
  }

  // .claude/skills/
  if (grouped.skills?.length) {
    claudeChildren.push({
      name: 'skills',
      type: 'folder',
      color: TYPE_CONFIG.skills?.color,
      componentType: 'skills',
      children: grouped.skills.map((item) => ({
        name: getFileName(item),
        type: 'folder' as const,
        color: TYPE_CONFIG.skills?.color,
        componentType: 'skills',
        item,
      })),
    });
  }

  // .claude/hooks/ (script files)
  if (grouped.hooks?.length) {
    claudeChildren.push({
      name: 'hooks',
      type: 'folder',
      color: TYPE_CONFIG.hooks?.color,
      componentType: 'hooks',
      children: grouped.hooks.map((item) => ({
        name: getFileName(item),
        type: 'file' as const,
        color: TYPE_CONFIG.hooks?.color,
        componentType: 'hooks',
        item,
      })),
    });
  }

  // .claude/settings.json (settings + hooks config)
  if (grouped.settings?.length) {
    claudeChildren.push({
      name: 'settings.json',
      type: 'file',
      color: TYPE_CONFIG.settings?.color,
      componentType: 'settings',
      children: grouped.settings.map((item) => ({
        name: formatName(item.component_name),
        type: 'file' as const,
        color: TYPE_CONFIG.settings?.color,
        componentType: 'settings',
        item,
      })),
    });
  }

  const root: TreeNode = {
    name: 'project',
    type: 'folder',
    children: [
      {
        name: '.claude',
        type: 'folder',
        children: claudeChildren,
      },
    ],
  };

  // .mcp.json at project root
  if (grouped.mcps?.length) {
    root.children!.push({
      name: '.mcp.json',
      type: 'file',
      color: TYPE_CONFIG.mcps?.color,
      componentType: 'mcps',
      children: grouped.mcps.map((item) => ({
        name: formatName(item.component_name),
        type: 'file' as const,
        color: TYPE_CONFIG.mcps?.color,
        componentType: 'mcps',
        item,
      })),
    });
  }

  return root;
}

// ── Tree node component ──────────────────────────────────────────────────
function ProjectTreeNode({
  node,
  depth,
  expandedPaths,
  togglePath,
  currentPath,
  onRemoveItem,
  collectionId,
}: {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  currentPath: string;
  onRemoveItem: (item: CollectionItem, collectionId: string) => void;
  collectionId: string;
}) {
  const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
  const isExpanded = expandedPaths.has(fullPath);
  const hasChildren = node.children && node.children.length > 0;
  const isLeafFile = node.type === 'file' && node.item;
  const isContainerFile = node.type === 'file' && hasChildren && !node.item;
  const isClickable = hasChildren || isLeafFile;
  const pl = depth * 12 + 8;

  // File icon (document)
  const fileIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" style={{ color: node.color ?? '#666' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );

  // Folder icon
  const folderIcon = (color?: string) => (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" style={{ color: color ?? '#888' }}>
      {isExpanded ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 1.85L5 19z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
      )}
    </svg>
  );

  if (isLeafFile) {
    // Leaf file with link to component
    return (
      <div
        className="group/treeitem flex items-center gap-1.5 py-[4px] rounded-md text-[12px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2] transition-colors"
        style={{ paddingLeft: pl }}
      >
        {fileIcon}
        <a
          href={`/component/${node.item!.component_type}/${cleanPath(node.item!.component_path)}`}
          className="truncate flex-1 hover:underline"
          style={{ color: node.color }}
        >
          {node.name}
        </a>
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveItem(node.item!, collectionId); }}
          className="p-0.5 rounded hover:bg-white/10 text-[--color-text-tertiary] hover:text-red-400 transition-colors opacity-0 group-hover/treeitem:opacity-100 shrink-0 mr-1"
          title="Remove"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => { if (isClickable) togglePath(fullPath); }}
        role={isClickable ? 'button' : undefined}
        className={`flex items-center gap-1.5 py-[4px] rounded-md text-[12px] transition-colors ${
          isClickable ? 'cursor-pointer hover:bg-[--color-surface-2]' : ''
        } ${node.name === '.claude' ? 'text-[--color-text-primary] font-medium' : 'text-[--color-text-secondary]'}`}
        style={{ paddingLeft: pl }}
      >
        {/* Chevron for expandable nodes */}
        {hasChildren ? (
          <svg
            className={`w-3 h-3 shrink-0 text-[--color-text-tertiary] transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {/* Icon */}
        {node.type === 'folder' ? folderIcon(node.color) : isContainerFile ? fileIcon : folderIcon(node.color)}
        {/* Name */}
        <span className="truncate" style={{ color: node.name === '.claude' || node.name === 'project' ? undefined : node.color }}>
          {node.name}{node.type === 'folder' && node.name !== 'project' ? '/' : ''}
        </span>
        {/* Count badge for type folders */}
        {node.componentType && hasChildren && (
          <span className="text-[10px] text-[--color-text-tertiary] ml-auto mr-1">
            {node.children!.length}
          </span>
        )}
      </div>
      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child, i) => (
            <ProjectTreeNode
              key={`${child.name}-${i}`}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              togglePath={togglePath}
              currentPath={fullPath}
              onRemoveItem={onRemoveItem}
              collectionId={collectionId}
            />
          ))}
        </div>
      )}
    </div>
  );
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

// ── Main content tree (ASCII-style) ──────────────────────────────────────
function MainContentTree({
  node,
  depth,
  isLast,
  prefix,
  onRemoveItem,
  collectionId,
}: {
  node: TreeNode;
  depth: number;
  isLast: boolean;
  prefix: string;
  onRemoveItem: (item: CollectionItem, collectionId: string) => void;
  collectionId: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const connector = depth === 0 ? '' : isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ';
  const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '\u2502   ');
  const isFolder = node.type === 'folder' || (node.type === 'file' && hasChildren && !node.item);
  const displayName = isFolder ? `${node.name}/` : node.name;

  return (
    <div>
      {depth > 0 && (
        <div className="group/treeline flex items-center whitespace-pre leading-6">
          <span className="text-[--color-text-tertiary] select-none">{prefix}{connector}</span>
          {node.item ? (
            <a
              href={`/component/${node.item.component_type}/${cleanPath(node.item.component_path)}`}
              className="hover:underline"
              style={{ color: node.color ?? '#ccc' }}
            >
              {displayName}
            </a>
          ) : (
            <span style={{ color: node.color ?? (node.name === '.claude' ? '#e5e5e5' : '#999') }} className={node.name === '.claude' ? 'font-semibold' : ''}>
              {displayName}
            </span>
          )}
          {node.item && (
            <button
              onClick={() => onRemoveItem(node.item!, collectionId)}
              className="ml-2 p-0.5 rounded hover:bg-white/10 text-[--color-text-tertiary] hover:text-red-400 transition-colors opacity-0 group-hover/treeline:opacity-100 shrink-0"
              title="Remove"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
      {hasChildren && node.children!.map((child, i) => (
        <MainContentTree
          key={`${child.name}-${i}`}
          node={child}
          depth={depth + 1}
          isLast={i === node.children!.length - 1}
          prefix={childPrefix}
          onRemoveItem={onRemoveItem}
          collectionId={collectionId}
        />
      ))}
    </div>
  );
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
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['project', 'project/.claude']));
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

  function toggleTreePath(path: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
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

                {/* Expanded tree items — project structure */}
                {isExpanded && items.length > 0 && (() => {
                  const tree = buildProjectTree(items);
                  return (
                    <div className="ml-1 mt-0.5 mb-1">
                      {tree.children!.map((child, i) => (
                        <ProjectTreeNode
                          key={`${child.name}-${i}`}
                          node={child}
                          depth={1}
                          expandedPaths={expandedPaths}
                          togglePath={toggleTreePath}
                          currentPath="project"
                          onRemoveItem={handleRemoveItem}
                          collectionId={col.id}
                        />
                      ))}
                    </div>
                  );
                })()}
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

            {/* Project structure view */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
                </svg>
                <h4 className="text-[13px] font-medium text-[--color-text-secondary]">Project Structure</h4>
                <span className="text-[10px] text-[--color-text-tertiary]">How components will be installed</span>
              </div>
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 font-mono text-[12px]">
                {(() => {
                  const tree = buildProjectTree(selectedItems);
                  return (
                    <MainContentTree
                      node={tree}
                      depth={0}
                      isLast={true}
                      prefix=""
                      onRemoveItem={handleRemoveItem}
                      collectionId={selectedCollection!.id}
                    />
                  );
                })()}
              </div>
            </div>

            {/* Component cards grouped by type */}
            <div className="space-y-6">
              {groupByType(selectedItems).map((group) => (
                <div key={group.type}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${group.color}18`, color: group.color }}
                    >
                      <TypeIcon type={group.type} size={14} />
                    </div>
                    <h4 className="text-[13px] font-semibold" style={{ color: group.color }}>
                      {group.label}
                    </h4>
                    <span className="text-[11px] text-[--color-text-tertiary]">
                      ({group.items.length})
                    </span>
                  </div>
                  {/* Cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {group.items.map((item) => {
                      const config = TYPE_CONFIG[group.type];
                      return (
                        <div
                          key={item.id}
                          className="group/card flex items-start gap-3 p-3.5 rounded-xl bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a] hover:bg-[#151515] transition-all duration-200"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: config ? `${config.color}12` : '#ffffff08', color: config?.color ?? '#888' }}
                          >
                            <TypeIcon type={group.type} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <a
                              href={`/component/${item.component_type}/${cleanPath(item.component_path)}`}
                              className="text-[13px] font-medium text-[--color-text-primary] hover:text-white transition-colors line-clamp-1"
                            >
                              {formatName(item.component_name)}
                            </a>
                            {item.component_category && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[--color-text-tertiary]">
                                  {item.component_category}
                                </span>
                              </div>
                            )}
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Local-only My Components (no auth required)
import { useState, useEffect } from 'react';
import { localCollections } from '../lib/local-collections';
import type { LocalCollection, LocalCollectionItem, LocalComponentFile } from '../lib/local-collections';
import { TYPE_CONFIG } from '../lib/icons';
import TypeIcon from './TypeIcon';

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

// Recursive component for rendering file trees
function FileTreeNode({
  file,
  depth,
  itemId,
  expandedItemIds,
  toggleItemExpanded,
  onFileClick,
}: {
  file: LocalComponentFile;
  depth: number;
  itemId: string;
  expandedItemIds: Set<string>;
  toggleItemExpanded: (id: string) => void;
  onFileClick: (file: LocalComponentFile) => void;
}) {
  const nodeId = `${itemId}-${file.path}`;
  const isExpanded = expandedItemIds.has(nodeId);
  const hasChildren = file.children && file.children.length > 0;
  const pl = depth * 16 + 40; // Base padding + depth offset

  return (
    <div>
      <div
        onClick={() => {
          if (hasChildren) {
            toggleItemExpanded(nodeId);
          } else if (file.type === 'file') {
            onFileClick(file);
          }
        }}
        className={`flex items-center gap-1.5 py-[3px] rounded-md text-[11px] text-text-tertiary hover:text-text-secondary transition-colors ${
          hasChildren || file.type === 'file' ? 'cursor-pointer hover:bg-surface-2' : ''
        }`}
        style={{ paddingLeft: pl }}
      >
        {hasChildren ? (
          <svg
            className={`w-2.5 h-2.5 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <span className="w-2.5 shrink-0" />
        )}
        {file.type === 'folder' ? (
          <svg className="w-3 h-3 shrink-0 text-yellow-500/70" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        ) : (
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        <span className="truncate">{file.name}</span>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {file.children!.map((child, i) => (
            <FileTreeNode
              key={`${child.path}-${i}`}
              file={child}
              depth={depth + 1}
              itemId={itemId}
              expandedItemIds={expandedItemIds}
              toggleItemExpanded={toggleItemExpanded}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const TYPE_ORDER = ['skills', 'agents', 'commands', 'settings', 'hooks', 'mcps', 'templates'] as const;

function groupByType(items: LocalCollectionItem[]): { type: string; label: string; color: string; items: LocalCollectionItem[] }[] {
  const map: Record<string, LocalCollectionItem[]> = {};
  for (const item of items) {
    const t = pluralType(item.type);
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

function generateCommand(items: LocalCollectionItem[]): string {
  const grouped: Record<string, string[]> = {};
  for (const item of items) {
    const t = pluralType(item.type);
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(cleanPath(item.path));
  }
  let cmd = 'npx claude-code-templates@latest';
  for (const [type, paths] of Object.entries(grouped)) {
    const flag = TYPE_FLAGS[type];
    if (flag) cmd += ` ${flag} ${paths.join(',')}`;
  }
  return cmd;
}

export default function MyComponentsViewLocal() {
  const [collections, setCollections] = useState<LocalCollection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set()); // For expanding component files
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'folder'>('tree');
  const [selectedComponent, setSelectedComponent] = useState<LocalCollectionItem | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<LocalComponentFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    try {
      loadCollections();
      // Initialize all groups as expanded
      setExpandedGroups(new Set(TYPE_ORDER));
    } catch (error) {
      console.error('Failed to load collections:', error);
      setCollections([]);
    }
  }, []);

  function loadCollections() {
    try {
      const cols = localCollections.getAll();
      
      // Add mock file structure to skills for demonstration
      const colsWithFiles = cols.map(col => ({
        ...col,
        items: col.items.map(item => {
          // Add file structure for skills
          if (item.type === 'skill' || item.type === 'skills') {
            return {
              ...item,
              files: [
                { name: 'SKILL.md', path: 'SKILL.md', type: 'file' as const },
                {
                  name: 'scripts',
                  path: 'scripts',
                  type: 'folder' as const,
                  children: [
                    { name: 'design_token_generator.py', path: 'scripts/design_token_generator.py', type: 'file' as const }
                  ]
                }
              ]
            };
          }
          return item;
        })
      }));
      
      setCollections(colsWithFiles);
      if (colsWithFiles.length > 0 && !selectedId) {
        setSelectedId(colsWithFiles[0].id);
      }
    } catch (error) {
      console.error('Error loading collections:', error);
      // Clear corrupted data
      localStorage.removeItem('claudeCodeCollections');
      setCollections([]);
    }
  }

  function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const col = localCollections.create(newName.trim());
      setCollections((prev) => [...prev, col]);
      setSelectedId(col.id);
      setNewName('');
    } catch (err) {
      console.error('Failed to create collection:', err);
    } finally {
      setCreating(false);
    }
  }

  function handleRename(id: string) {
    if (!renameValue.trim()) return;
    try {
      localCollections.update(id, { name: renameValue.trim() });
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: renameValue.trim() } : c))
      );
      setRenaming(null);
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this collection and all its items?')) return;
    try {
      localCollections.delete(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) {
        const remaining = collections.filter((c) => c.id !== id);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  function handleRemoveItem(item: LocalCollectionItem, collectionId: string) {
    try {
      localCollections.removeItem(collectionId, item.path, item.type);
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? { ...c, items: c.items.filter((i) => !(i.path === item.path && i.type === item.type)) }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  }

  function copyCommand(text: string) {
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

  function toggleGroupExpanded(type: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleItemExpanded(itemId: string) {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handleFileClick(file: LocalComponentFile) {
    setSelectedFile(file);
    // Mock file content - in production, fetch from API
    const mockContent = `# ${file.name}\n\n# This is a mock file content\n# In production, this would be fetched from the actual component files\n\nimport os\nimport json\n\ndef generate_tokens():\n    """Generate design tokens for the UI system"""\n    tokens = {\n        "colors": {\n            "primary": "#3b82f6",\n            "secondary": "#8b5cf6",\n            "accent": "#f59e0b"\n        },\n        "spacing": {\n            "xs": "0.25rem",\n            "sm": "0.5rem",\n            "md": "1rem",\n            "lg": "1.5rem",\n            "xl": "2rem"\n        }\n    }\n    return tokens\n\nif __name__ == "__main__":\n    tokens = generate_tokens()\n    print(json.dumps(tokens, indent=2))`;
    setFileContent(mockContent);
  }

  function closeFileViewer() {
    setSelectedFile(null);
    setFileContent('');
  }

  function startEditingTitle() {
    if (!selectedCollection) return;
    setEditedTitle(selectedCollection.name);
    setIsEditingTitle(true);
  }

  function saveTitle() {
    if (!selectedCollection || !editedTitle.trim() || editedTitle === selectedCollection.name) {
      setIsEditingTitle(false);
      return;
    }

    try {
      localCollections.update(selectedCollection.id, { name: editedTitle.trim() });
      setCollections((prev) =>
        prev.map((c) => (c.id === selectedCollection.id ? { ...c, name: editedTitle.trim() } : c))
      );
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  }

  function cancelEditingTitle() {
    setIsEditingTitle(false);
    setEditedTitle('');
  }

  // Auto-expand all groups when collection changes
  useEffect(() => {
    if (selectedCollection) {
      const types = groupByType(selectedCollection.items).map(g => g.type);
      setExpandedGroups(new Set(types));
    }
  }, [selectedId]);

  const selectedCollection = collections.find((c) => c.id === selectedId);
  const selectedItems = selectedCollection?.items ?? [];

  return (
    <div className="flex h-full bg-surface-0">
      {/* Sidebar - Notion style */}
      <div className="w-64 border-r border-border flex flex-col shrink-0 bg-surface-0">
        {/* Header */}
        <div className="px-3 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary mb-1">My Collections</h2>
          <p className="text-xs text-text-tertiary">Saved locally in browser</p>
        </div>

        {/* Create new - Notion style */}
        <div className="px-2 py-2 border-b border-border">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-surface-2 transition-colors">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="New collection..."
              className="flex-1 bg-transparent border-none text-[13px] text-text-primary placeholder:text-text-tertiary outline-none"
              maxLength={100}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="p-1 rounded-md hover:bg-surface-3 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Collections list - Notion style */}
        <div className="flex-1 overflow-y-auto py-1 px-2">
          {collections.map((col) => {
            const isSelected = selectedId === col.id;
            const isExpanded = expandedIds.has(col.id);
            const items = col.items ?? [];

            return (
              <div key={col.id} className="mb-0.5">
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
                      className="w-full bg-surface-2 border border-border rounded-md text-[13px] text-text-primary px-2 py-1 outline-none focus:border-primary-500"
                      maxLength={100}
                    />
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSelectedId(col.id);
                        setExpandedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(col.id)) next.delete(col.id);
                          else next.add(col.id);
                          return next;
                        });
                      }}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[13px] transition-all duration-150 group ${
                        isSelected
                          ? 'bg-surface-3 text-text-primary font-medium'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                      }`}
                    >
                      {/* Chevron */}
                      <svg
                        className={`w-3 h-3 shrink-0 text-text-tertiary transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <svg className="w-4 h-4 shrink-0 text-text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                        <span className="truncate">{col.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-text-tertiary font-medium">{items.length}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenaming(col.id);
                            setRenameValue(col.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-surface-3 transition-all"
                          title="Rename"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(col.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500/10 text-text-tertiary hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </button>

                    {/* Expanded children - show component items */}
                    {isExpanded && items.length > 0 && (
                      <div className="ml-1 mt-0.5 mb-1 space-y-0.5">
                        {items.map((item) => {
                          const config = TYPE_CONFIG[pluralType(item.type)];
                          const itemId = `${col.id}-${item.type}-${item.path}`;
                          const itemExpanded = expandedItemIds.has(itemId);
                          const hasFiles = item.files && item.files.length > 0;
                          
                          return (
                            <div key={`${item.type}-${item.path}`}>
                              <div
                                className="group/treeitem flex items-center gap-1.5 py-[4px] pl-8 pr-2 rounded-md text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                              >
                                {/* Chevron for expandable items */}
                                {hasFiles ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleItemExpanded(itemId); }}
                                    className="p-0 shrink-0"
                                  >
                                    <svg
                                      className={`w-2.5 h-2.5 text-text-tertiary transition-transform duration-150 ${itemExpanded ? 'rotate-90' : ''}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                ) : (
                                  <span className="w-2.5 shrink-0" />
                                )}
                                <div
                                  className="w-3 h-3 rounded flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: config ? `${config.color}18` : '#ffffff08', color: config?.color ?? '#888' }}
                                >
                                  <TypeIcon type={pluralType(item.type)} size={10} />
                                </div>
                                <a
                                  href={`/component/${item.type}/${cleanPath(item.path)}`}
                                  className="truncate flex-1 hover:underline"
                                  style={{ color: config?.color }}
                                >
                                  {formatName(item.name)}
                                </a>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveItem(item, col.id); }}
                                  className="p-0.5 rounded hover:bg-white/10 text-text-tertiary hover:text-red-400 transition-colors opacity-0 group-hover/treeitem:opacity-100 shrink-0"
                                  title="Remove"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              {/* File structure */}
                              {itemExpanded && hasFiles && (
                                <div className="mt-0.5">
                                  {item.files!.map((file, i) => (
                                    <FileTreeNode
                                      key={`${file.path}-${i}`}
                                      file={file}
                                      depth={0}
                                      itemId={itemId}
                                      expandedItemIds={expandedItemIds}
                                      toggleItemExpanded={toggleItemExpanded}
                                      onFileClick={handleFileClick}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content - Notion style */}
      <div className="flex-1 overflow-y-auto bg-surface-0">
        {selectedComponent ? (
          // Component detail view
          <div className="h-full flex flex-col">
            {/* Back button */}
            <div className="border-b border-border px-6 py-4">
              <button
                onClick={() => setSelectedComponent(null)}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to collection
              </button>
            </div>
            {/* Component content */}
            <div className="flex-1 overflow-y-auto px-8 py-8">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ 
                      backgroundColor: TYPE_CONFIG[pluralType(selectedComponent.type)]?.color 
                        ? `${TYPE_CONFIG[pluralType(selectedComponent.type)].color}15` 
                        : '#ffffff08',
                      color: TYPE_CONFIG[pluralType(selectedComponent.type)]?.color ?? '#888'
                    }}
                  >
                    <TypeIcon type={pluralType(selectedComponent.type)} size={20} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-text-primary">{formatName(selectedComponent.name)}</h1>
                    <p className="text-sm text-text-tertiary mt-1">
                      {TYPE_CONFIG[pluralType(selectedComponent.type)]?.label ?? selectedComponent.type}
                      {selectedComponent.category && ` • ${selectedComponent.category}`}
                    </p>
                  </div>
                </div>
                
                {/* Component details */}
                <div className="rounded-lg border border-border overflow-hidden mb-6">
                  <div className="bg-surface-2 px-4 py-2 border-b border-border">
                    <span className="text-xs font-mono text-text-tertiary">Path</span>
                  </div>
                  <div className="bg-surface-1 p-4">
                    <code className="text-sm text-text-secondary font-mono break-all">
                      {selectedComponent.path}
                    </code>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => copyCommand(`npx claude-code-templates@latest ${TYPE_FLAGS[pluralType(selectedComponent.type)]} ${cleanPath(selectedComponent.path)}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white text-sm font-medium transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Install Command
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (selectedCollection && confirm('Remove this component from the collection?')) {
                        handleRemoveItem(selectedComponent, selectedCollection.id);
                        setSelectedComponent(null);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-red-500/10 border border-border hover:border-red-500/30 rounded-lg text-text-secondary hover:text-red-400 text-sm font-medium transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove from Collection
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : selectedCollection ? (
          selectedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <p className="text-base font-medium text-text-primary mb-2">
                "{selectedCollection.name}" is empty
              </p>
              <p className="text-sm text-text-tertiary mb-6 max-w-sm">
                Browse components and add them to your stack, then save as a collection.
              </p>
              <a
                href="/agents"
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm font-medium text-text-primary transition-colors"
              >
                Browse Components
              </a>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto px-8 py-8">
              {/* Header - Notion style with editable title */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    {/* Editable Title */}
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTitle();
                            if (e.key === 'Escape') cancelEditingTitle();
                          }}
                          onBlur={saveTitle}
                          className="flex-1 text-3xl font-bold text-text-primary bg-transparent border-0 border-b-2 border-accent-500 px-0 py-1 focus:outline-none focus:ring-0 transition-all"
                          style={{ caretColor: 'var(--color-accent-500)' }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <h1 
                        className="text-3xl font-bold text-text-primary mb-2 cursor-text hover:text-accent-500 transition-all duration-200 inline-flex items-center gap-2 group"
                        onClick={startEditingTitle}
                        title="Click to edit collection name"
                      >
                        {selectedCollection.name}
                        <svg className="w-5 h-5 opacity-0 group-hover:opacity-60 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </h1>
                    )}
                    <div className="flex items-center gap-4 text-sm text-text-tertiary">
                      <span>{selectedItems.length} component{selectedItems.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-lg">
                      <button
                        onClick={() => setViewMode('folder')}
                        className={`p-2 rounded-md transition-all ${
                          viewMode === 'folder'
                            ? 'bg-surface-3 text-text-primary'
                            : 'text-text-tertiary hover:text-text-secondary'
                        }`}
                        title="Folder view"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setViewMode('tree')}
                        className={`p-2 rounded-md transition-all ${
                          viewMode === 'tree'
                            ? 'bg-surface-3 text-text-primary'
                            : 'text-text-tertiary hover:text-text-secondary'
                        }`}
                        title="Tree view"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={() => copyCommand(generateCommand(selectedItems))}
                      className="flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white text-sm font-medium transition-colors"
                    >
                      {copied ? (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          Copy Command
                        </>
                      )}
                    </button>
                  </div>
                </div>

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
                            {selectedCollection.isPublic ? (
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
                            {selectedCollection.isPublic 
                              ? 'This collection is public. Anyone with the link can view it.' 
                              : 'This collection is private. Only you can see it on this device.'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          try {
                            localCollections.update(selectedCollection.id, { isPublic: !selectedCollection.isPublic });
                            setCollections((prev) =>
                              prev.map((c) => (c.id === selectedCollection.id ? { ...c, isPublic: !c.isPublic } : c))
                            );
                          } catch (err) {
                            console.error('Failed to toggle public:', err);
                          }
                        }}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 ${
                          selectedCollection.isPublic ? 'bg-accent-500 shadow-lg shadow-accent-500/30' : 'bg-surface-3'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                            selectedCollection.isPublic ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Local Storage Info */}
                    <div className="flex items-start gap-3 pt-4 border-t border-border">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text-primary mb-1">
                          Local Storage
                        </div>
                        <div className="text-xs text-text-tertiary leading-relaxed">
                          This collection is saved locally in your browser. Sign in to sync across devices.
                        </div>
                      </div>
                    </div>

                    {/* Export/Import (Placeholder) */}
                    <div className="pt-4 border-t border-border space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-2">
                        <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Sharing & Export
                      </div>
                      <button
                        onClick={() => alert('Sign in to share collections publicly with a unique link!')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-500/10 hover:bg-accent-500/20 border border-accent-500/30 hover:border-accent-500/50 text-accent-500 hover:text-accent-400 rounded-lg text-xs font-medium transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share Collection (Sign In Required)
                      </button>
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-lg text-xs font-medium text-text-tertiary cursor-not-allowed opacity-50"
                        title="Coming soon"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export as JSON (Coming Soon)
                      </button>
                    </div>

                    {/* Danger Zone */}
                    <div className="pt-4 border-t border-red-500/20">
                      <div className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Danger Zone
                      </div>
                      <button
                        onClick={() => handleDelete(selectedCollection.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Collection
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Install command - Notion code block style */}
              <div className="mb-8 rounded-lg border border-border overflow-hidden">
                <div className="bg-surface-2 px-4 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-mono text-text-tertiary">Terminal</span>
                  <button
                    onClick={() => copyCommand(generateCommand(selectedItems))}
                    className="p-1.5 rounded hover:bg-surface-1 text-text-tertiary hover:text-text-primary transition-colors"
                    title="Copy command"
                  >
                    {copied ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="bg-surface-1 p-4">
                  <code className="text-sm text-text-secondary font-mono break-all leading-relaxed block">
                    {generateCommand(selectedItems)}
                  </code>
                </div>
              </div>

              {/* Component groups - Folder or Tree view */}
              <div className="space-y-8">
                {viewMode === 'folder' ? (
                  // Folder view - card grid
                  groupByType(selectedItems).map((group) => (
                    <div key={group.type}>
                      <div className="flex items-center gap-2 mb-4">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: `${group.color}15`, color: group.color }}
                        >
                          <TypeIcon type={group.type} size={14} />
                        </div>
                        <h3 className="text-base font-semibold text-text-primary">
                          {group.label}
                        </h3>
                        <span className="text-sm text-text-tertiary">
                          {group.items.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {group.items.map((item) => {
                          const config = TYPE_CONFIG[group.type];
                          return (
                            <div
                              key={`${item.type}-${item.path}`}
                              className="group/card flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-hover hover:bg-surface-1 transition-all duration-150"
                            >
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: config ? `${config.color}12` : '#ffffff08', color: config?.color ?? '#888' }}
                              >
                                <TypeIcon type={group.type} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <a
                                  href={`/component/${item.type}/${cleanPath(item.path)}`}
                                  className="text-sm font-medium text-text-primary hover:text-primary-500 transition-colors line-clamp-1 block"
                                >
                                  {formatName(item.name)}
                                </a>
                                {item.category && (
                                  <span className="text-xs text-text-tertiary mt-0.5 block">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleRemoveItem(item, selectedCollection!.id)}
                                className="opacity-0 group-hover/card:opacity-100 p-2 rounded-md hover:bg-surface-2 text-text-tertiary hover:text-red-400 transition-all duration-150 shrink-0"
                                title="Remove"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  // Tree view - hierarchical list
                  <div className="border border-border rounded-lg overflow-hidden">
                    {groupByType(selectedItems).map((group, groupIdx) => {
                      const isExpanded = expandedGroups.has(group.type);
                      return (
                        <div key={group.type} className={groupIdx > 0 ? 'border-t border-border' : ''}>
                          {/* Folder header */}
                          <button
                            onClick={() => toggleGroupExpanded(group.type)}
                            className="w-full flex items-center gap-2 p-3 hover:bg-surface-1 transition-colors"
                          >
                            <svg 
                              className={`w-4 h-4 text-text-tertiary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center"
                              style={{ backgroundColor: `${group.color}15`, color: group.color }}
                            >
                              <TypeIcon type={group.type} size={12} />
                            </div>
                            <span className="text-sm font-medium text-text-primary flex-1 text-left">
                              {group.label}
                            </span>
                            <span className="text-xs text-text-tertiary font-medium px-2 py-0.5 rounded-full bg-surface-2">
                              {group.items.length}
                            </span>
                          </button>
                          {/* Files */}
                          {isExpanded && (
                            <div className="bg-surface-0">
                              {group.items.map((item, itemIdx) => {
                                const config = TYPE_CONFIG[group.type];
                                return (
                                  <div
                                    key={`${item.type}-${item.path}`}
                                    className="group/item flex items-center gap-2 px-3 py-2 hover:bg-surface-1 transition-colors border-t border-border"
                                  >
                                    <div className="w-8 flex justify-center">
                                      <svg className="w-4 h-4 text-text-tertiary opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <a
                                      href={`/component/${item.type}/${cleanPath(item.path)}`}
                                      className="text-sm text-text-primary hover:text-primary-500 transition-colors flex-1 truncate"
                                    >
                                      {formatName(item.name)}
                                    </a>
                                    {item.category && (
                                      <span className="text-xs text-text-tertiary px-2 py-0.5 rounded-full bg-surface-2">
                                        {item.category}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleRemoveItem(item, selectedCollection!.id)}
                                      className="opacity-0 group-hover/item:opacity-100 p-1.5 rounded-md hover:bg-surface-2 text-text-tertiary hover:text-red-400 transition-all"
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            </div>
            <p className="text-base font-medium text-text-secondary">Select a collection</p>
          </div>
        )}
      </div>

      {/* File Viewer Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">{selectedFile.name}</h3>
                  <p className="text-xs text-text-tertiary font-mono">{selectedFile.path}</p>
                </div>
              </div>
              <button
                onClick={closeFileViewer}
                className="p-2 rounded-lg hover:bg-surface-3 text-text-tertiary hover:text-text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
                <pre className="text-sm text-text-secondary font-mono leading-relaxed overflow-x-auto">
                  <code>{fileContent}</code>
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-2">
              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Read-only preview • Actual file content will be loaded from component</span>
              </div>
              <button
                onClick={closeFileViewer}
                className="px-4 py-2 bg-surface-3 hover:bg-surface-4 rounded-lg text-sm font-medium text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

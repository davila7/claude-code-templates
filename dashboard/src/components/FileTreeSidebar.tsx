import { useState, useMemo } from 'react';

interface FileTreeSidebarProps {
  references: string[];
  skillName: string;
}

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
  ext?: string;
}

const EXT_COLORS: Record<string, string> = {
  md: '#60a5fa', js: '#facc15', ts: '#60a5fa', tsx: '#60a5fa', jsx: '#facc15',
  py: '#4ade80', html: '#fb923c', json: '#fde047', txt: 'var(--color-text-tertiary)',
  sh: '#86efac', yml: '#f472b6', yaml: '#f472b6', css: '#c084fc', toml: '#f472b6',
};

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const p of paths) {
    const parts = p.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');

      let existing = current.find((n) => n.name === name && n.isFile === isFile);
      if (!existing) {
        const ext = isFile ? name.split('.').pop()?.toLowerCase() : undefined;
        existing = { name, path: fullPath, isFile, children: [], ext };
        current.push(existing);
      }
      current = existing.children;
    }
  }

  // Sort: folders first, then files, alphabetically
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (!n.isFile) sortNodes(n.children);
    }
  }
  sortNodes(root);
  return root;
}

function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.isFile) count++;
    else count += countFiles(n.children);
  }
  return count;
}

export default function FileTreeSidebar({ references, skillName }: FileTreeSidebarProps) {
  const tree = useMemo(() => buildTree(references), [references]);
  const [search, setSearch] = useState('');

  const filteredRefs = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return references.filter((r) => r.toLowerCase().includes(q));
  }, [search, references]);

  const filteredTree = useMemo(() => {
    if (!filteredRefs) return tree;
    return buildTree(filteredRefs);
  }, [filteredRefs, tree]);

  return (
    <div className="w-64 shrink-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{skillName}</span>
        </div>
        <span className="text-[10px] text-[var(--color-text-tertiary)] shrink-0">{references.length} files</span>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-[var(--color-border)]">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-[var(--color-surface-3)] border-none rounded pl-7 pr-2 py-1 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-accent-400/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
        {filteredTree.length === 0 && search ? (
          <div className="px-3 py-4 text-center text-[11px] text-[var(--color-text-tertiary)]">No matching files</div>
        ) : (
          <TreeNodes nodes={filteredTree} depth={0} forceOpen={!!search} />
        )}
      </div>
    </div>
  );
}

function TreeNodes({ nodes, depth, forceOpen }: { nodes: TreeNode[]; depth: number; forceOpen?: boolean }) {
  return (
    <>
      {nodes.map((node) =>
        node.isFile ? (
          <FileNode key={node.path} node={node} depth={depth} />
        ) : (
          <FolderNode key={node.path} node={node} depth={depth} forceOpen={forceOpen} />
        )
      )}
    </>
  );
}

function FolderNode({ node, depth, forceOpen }: { node: TreeNode; depth: number; forceOpen?: boolean }) {
  const [open, setOpen] = useState(forceOpen || depth < 1);
  const fileCount = useMemo(() => countFiles(node.children), [node.children]);

  // If forceOpen changes to true, open the folder
  const isOpen = forceOpen || open;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1 py-[3px] pr-2 hover:bg-white/[0.04] transition-colors group/folder"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <svg
          className={`w-3 h-3 text-[var(--color-text-tertiary)] shrink-0 transition-transform duration-100 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={isOpen ? '#facc15' : 'var(--color-text-tertiary)'} strokeWidth={1.5}>
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          )}
        </svg>
        <span className="text-[11px] text-[var(--color-text-secondary)] truncate">{node.name}</span>
        <span className="text-[9px] text-[var(--color-text-tertiary)] ml-auto opacity-0 group-hover/folder:opacity-100 transition-opacity">{fileCount}</span>
      </button>
      {isOpen && <TreeNodes nodes={node.children} depth={depth + 1} forceOpen={forceOpen} />}
    </div>
  );
}

function FileNode({ node, depth }: { node: TreeNode; depth: number }) {
  const color = EXT_COLORS[node.ext ?? ''] ?? 'var(--color-text-tertiary)';

  return (
    <div
      className="flex items-center gap-1.5 py-[3px] pr-2 hover:bg-white/[0.04] cursor-default transition-colors"
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      title={node.path}
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <span className="text-[11px] text-[var(--color-text-primary)] truncate font-mono">{node.name}</span>
      {node.ext && (
        <span className="text-[8px] ml-auto shrink-0 font-mono uppercase" style={{ color }}>{node.ext}</span>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import SkillSlideView from './SkillSlideView';

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface SearchMatch {
  type: 'heading' | 'text';
  text: string;
  id: string;
  context?: string;
}

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
  ext?: string;
}

interface SkillExplorerProps {
  skillContent: string;
  skillName: string;
  skillPath: string;
  references: string[];
  headings: Heading[];
}

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/skills';

const EXT_COLORS: Record<string, string> = {
  md: '#60a5fa', js: '#facc15', ts: '#60a5fa', tsx: '#60a5fa', jsx: '#facc15',
  py: '#4ade80', html: '#fb923c', json: '#fde047', txt: 'var(--color-text-tertiary)',
  sh: '#86efac', yml: '#f472b6', yaml: '#f472b6', css: '#c084fc', toml: '#f472b6',
};

// ─── Markdown rendering ────────────────────────────────────────────
function renderMarkdown(content: string): string {
  const stripped = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  marked.setOptions({ gfm: true, breaks: false });
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
    const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    return `<h${depth} id="${id}" class="md-heading">${text}</h${depth}>`;
  };
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    return `<div class="md-code-block"><div class="md-code-lang">${lang || ''}</div><pre><code class="language-${lang || ''}">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
  };
  return marked.parse(stripped, { renderer }) as string;
}

function extractHeadings(content: string): Heading[] {
  const stripped = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  const headings: Heading[] = [];
  const regex = /^(#{1,4})\s+(.+)$/gm;
  let m;
  while ((m = regex.exec(stripped)) !== null) {
    const text = m[2].replace(/[*_`\[\]]/g, '').trim();
    const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    headings.push({ level: m[1].length, text, id });
  }
  return headings;
}

function buildSearchIndex(content: string, headings: Heading[]): { text: string; headingId: string }[] {
  const stripped = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  const lines = stripped.split('\n');
  const entries: { text: string; headingId: string }[] = [];
  let currentHeadingId = headings[0]?.id ?? '';
  let paragraph = '';
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (paragraph.trim()) { entries.push({ text: paragraph.trim(), headingId: currentHeadingId }); paragraph = ''; }
      const text = headingMatch[2].replace(/[*_`\[\]]/g, '').trim();
      currentHeadingId = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
      continue;
    }
    if (line.trim() === '') {
      if (paragraph.trim()) { entries.push({ text: paragraph.trim(), headingId: currentHeadingId }); paragraph = ''; }
    } else {
      paragraph += (paragraph ? ' ' : '') + line.trim();
    }
  }
  if (paragraph.trim()) entries.push({ text: paragraph.trim(), headingId: currentHeadingId });
  return entries;
}

// ─── Tree building ─────────────────────────────────────────────────
function buildTree(paths: string[], skillName: string): TreeNode[] {
  const root: TreeNode[] = [];
  root.push({ name: 'SKILL.md', path: 'SKILL.md', isFile: true, children: [], ext: 'md' });
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
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.name === 'SKILL.md') return -1;
      if (b.name === 'SKILL.md') return 1;
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (!n.isFile) sortNodes(n.children);
  }
  sortNodes(root);
  return root;
}

function countFiles(nodes: TreeNode[]): number {
  let c = 0;
  for (const n of nodes) { if (n.isFile) c++; else c += countFiles(n.children); }
  return c;
}

// ─── Main Component ────────────────────────────────────────────────
export default function SkillExplorer({ skillContent, skillName, skillPath, references, headings: initialHeadings }: SkillExplorerProps) {
  const [selectedFile, setSelectedFile] = useState('SKILL.md');
  const [fileContent, setFileContent] = useState(skillContent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'code' | 'preview' | 'slides'>('preview');
  const [expanded, setExpanded] = useState(false);
  const [activeHeading, setActiveHeading] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [highlightCount, setHighlightCount] = useState(0);
  const [treeOpen, setTreeOpen] = useState(false);
  const [treeFilter, setTreeFilter] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isMarkdown = selectedFile.endsWith('.md');
  const html = useMemo(() => isMarkdown ? renderMarkdown(fileContent) : '', [fileContent, isMarkdown]);
  const currentHeadings = useMemo(() => {
    if (selectedFile === 'SKILL.md') return initialHeadings;
    if (isMarkdown) return extractHeadings(fileContent);
    return [];
  }, [selectedFile, fileContent, isMarkdown, initialHeadings]);
  const searchIndex = useMemo(() => buildSearchIndex(fileContent, currentHeadings), [fileContent, currentHeadings]);

  const tree = useMemo(() => buildTree(references, skillName), [references, skillName]);
  const filteredTree = useMemo(() => {
    if (!treeFilter.trim()) return tree;
    const q = treeFilter.toLowerCase();
    const filtered = references.filter((r) => r.toLowerCase().includes(q));
    const t = buildTree(filtered, skillName);
    if (!('SKILL.md').toLowerCase().includes(q)) {
      const idx = t.findIndex((n) => n.name === 'SKILL.md');
      if (idx >= 0) t.splice(idx, 1);
    }
    return t;
  }, [treeFilter, references, tree, skillName]);

  // Fetch file content
  useEffect(() => {
    if (selectedFile === 'SKILL.md') { setFileContent(skillContent); setError(''); return; }
    setLoading(true); setError('');
    fetch(`${GITHUB_RAW_BASE}/${skillPath}/${selectedFile}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
      .then((text) => setFileContent(text))
      .catch((e) => { setError(`Failed to load file: ${e.message}`); setFileContent(''); })
      .finally(() => setLoading(false));
  }, [selectedFile, skillPath, skillContent]);

  // Search results
  const searchResults = useMemo((): SearchMatch[] => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    const results: SearchMatch[] = [];
    const seen = new Set<string>();
    for (const h of currentHeadings) {
      if (h.text.toLowerCase().includes(q)) { results.push({ type: 'heading', text: h.text, id: h.id }); seen.add(h.id); }
    }
    for (const entry of searchIndex) {
      if (entry.text.toLowerCase().includes(q) && !seen.has(entry.headingId)) {
        const idx = entry.text.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 40);
        const end = Math.min(entry.text.length, idx + q.length + 40);
        const context = (start > 0 ? '...' : '') + entry.text.slice(start, end) + (end < entry.text.length ? '...' : '');
        results.push({ type: 'text', text: entry.text.slice(idx, idx + q.length), id: entry.headingId, context });
        seen.add(entry.headingId);
      }
    }
    return results.slice(0, 15);
  }, [searchQuery, currentHeadings, searchIndex]);

  // Highlight matches
  useEffect(() => {
    if (!previewRef.current || mode !== 'preview') return;
    previewRef.current.querySelectorAll('mark.md-search-hl').forEach((m) => {
      const p = m.parentNode; if (p) { p.replaceChild(document.createTextNode(m.textContent || ''), m); p.normalize(); }
    });
    if (!searchQuery.trim() || searchQuery.length < 2) { setHighlightCount(0); return; }
    const walker = document.createTreeWalker(previewRef.current, NodeFilter.SHOW_TEXT);
    const q = searchQuery.toLowerCase();
    const nodesToProcess: { node: Text; indices: number[] }[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = (node.textContent || '').toLowerCase();
      const indices: number[] = []; let pos = 0;
      while ((pos = text.indexOf(q, pos)) !== -1) { indices.push(pos); pos += q.length; }
      if (indices.length) nodesToProcess.push({ node, indices });
    }
    let count = 0;
    for (const { node: textNode, indices } of nodesToProcess) {
      const text = textNode.textContent || '';
      const parent = textNode.parentNode;
      if (!parent || parent.nodeName === 'CODE' || parent.nodeName === 'PRE') continue;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      for (const idx of indices) {
        if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
        const mark = document.createElement('mark'); mark.className = 'md-search-hl';
        mark.textContent = text.slice(idx, idx + q.length); frag.appendChild(mark);
        lastIdx = idx + q.length; count++;
      }
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      parent.replaceChild(frag, textNode);
    }
    setHighlightCount(count);
  }, [searchQuery, mode, html]);

  // Heading observer
  useEffect(() => {
    if (mode !== 'preview' || !previewRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActiveHeading(e.target.id); },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    previewRef.current.querySelectorAll('.md-heading').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [mode, html]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && (previewRef.current || codeRef.current)) {
        e.preventDefault(); setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); setSearchQuery(''); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [searchOpen]);

  useEffect(() => { setSelectedIdx(0); }, [searchResults]);

  const handleCopy = () => navigator.clipboard.writeText(fileContent);

  const scrollToHeading = useCallback((id: string) => {
    if (!expanded) setExpanded(true);
    setTimeout(() => {
      const container = previewRef.current || codeRef.current;
      container?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeading(id);
    }, expanded ? 0 : 100);
  }, [expanded]);

  const navigateToResult = useCallback((result: SearchMatch) => {
    if (mode !== 'preview') setMode('preview');
    scrollToHeading(result.id);
    setSearchOpen(false);
  }, [mode, scrollToHeading]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, searchResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && searchResults[selectedIdx]) { e.preventDefault(); navigateToResult(searchResults[selectedIdx]); }
  };

  const handleFileClick = (path: string) => {
    setSelectedFile(path);
    if (mode === 'slides') setMode('preview');
    setSearchOpen(false);
    setSearchQuery('');
    setExpanded(false);
  };

  const fileTreePanel = treeOpen ? (
    <div className="w-56 shrink-0 bg-[var(--color-surface-2)] border border-r-0 border-[var(--color-border)] rounded-l-lg overflow-hidden flex flex-col animate-slide-in-left">
      <div className="px-3 py-2.5 border-b border-[var(--color-border)] flex items-center gap-2">
        <button 
          onClick={() => setTreeOpen(false)} 
          className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] p-1 rounded-md shrink-0 transition-all duration-150 active:scale-95" 
          title="Close file tree"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-[11px] font-bold text-[var(--color-text-primary)] truncate flex-1">{skillName}</span>
        <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded-md shrink-0">{references.length + 1}</span>
      </div>
      <div className="px-2.5 py-2 border-b border-[var(--color-border)]">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" value={treeFilter} onChange={(e) => setTreeFilter(e.target.value)}
            placeholder="Filter files..." className="w-full bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary-500)]/40 focus:ring-1 focus:ring-[var(--color-primary-500)]/20 transition-all" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
        <TreeNodes nodes={filteredTree} depth={0} forceOpen={!!treeFilter} selectedFile={selectedFile} onSelect={handleFileClick} />
      </div>
    </div>
  ) : (
    <button
      onClick={() => setTreeOpen(true)}
      className="shrink-0 w-10 bg-[var(--color-surface-2)] border border-r-0 border-[var(--color-border)] rounded-l-lg flex flex-col items-center justify-start pt-4 gap-2.5 hover:bg-[var(--color-surface-3)] hover:w-11 hover:shadow-sm transition-all duration-200 group active:scale-95"
      title={`Browse files (${references.length + 1})`}
    >
      <svg className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
      <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] transition-colors" style={{ writingMode: 'vertical-lr' }}>Files</span>
    </button>
  );

  return (
    <div className="flex-1 min-w-0">
        {/* File indicator when viewing non-SKILL file */}
        {selectedFile !== 'SKILL.md' && (
          <div className="flex items-center gap-2 mb-2 text-[12px] text-[var(--color-text-secondary)]">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={EXT_COLORS[selectedFile.split('.').pop() || ''] || 'var(--color-text-tertiary)'} strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="font-mono">{selectedFile}</span>
            <button onClick={() => handleFileClick('SKILL.md')} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] ml-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Toolbar — identical to MarkdownViewer */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isMarkdown && (
              <div className="flex items-center gap-1 bg-[var(--color-surface-3)] rounded-lg p-0.5">
                <button onClick={() => setMode('code')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'code' ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                  Code
                </button>
                <button onClick={() => setMode('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'preview' ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Preview
                </button>
                {selectedFile === 'SKILL.md' && (
                  <button onClick={() => setMode('slides')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'slides' ? 'bg-surface-2 text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                    </svg>
                    Slides
                  </button>
                )}
              </div>
            )}
            {isMarkdown && (
              <button onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${searchOpen ? 'bg-accent-500/15 text-accent-400' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-white/[0.04]'}`}
                title="Search in document (Cmd+F)">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline text-[9px] px-1 py-0.5 rounded bg-white/[0.06] text-[var(--color-text-tertiary)] font-mono ml-1">
                  {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}F
                </kbd>
              </button>
            )}
          </div>
          <button onClick={handleCopy}
            className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
            Copy
          </button>
        </div>

        {/* Search bar */}
        {searchOpen && isMarkdown && mode !== 'slides' && (
          <div className="mb-3 relative">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search sections and content..."
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg pl-9 pr-20 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-accent-400/50 focus:ring-1 focus:ring-accent-400/20 font-sans" autoFocus />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {searchQuery.length >= 2 && (
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    {highlightCount > 0 ? `${highlightCount} match${highlightCount !== 1 ? 'es' : ''}` : 'No matches'}
                  </span>
                )}
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {searchResults.map((result, i) => (
                  <button key={`${result.id}-${i}`} onClick={() => navigateToResult(result)} onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors ${i === selectedIdx ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                    {result.type === 'heading' ? (
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5h13.5m-13.5 4.5h7.5m-7.5 4.5h13.5" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    )}
                    <div className="flex-1 min-w-0">
                      {result.type === 'heading' ? (
                        <HighlightText text={result.text} query={searchQuery} className="text-sm text-[var(--color-text-primary)] font-medium" />
                      ) : (
                        <>
                          <div className="text-[11px] text-[var(--color-text-tertiary)] mb-0.5">{currentHeadings.find((h) => h.id === result.id)?.text ?? ''}</div>
                          <HighlightText text={result.context || ''} query={searchQuery} className="text-xs text-[var(--color-text-secondary)] leading-relaxed" />
                        </>
                      )}
                    </div>
                    {i === selectedIdx && <kbd className="text-[9px] px-1 py-0.5 rounded bg-white/[0.06] text-[var(--color-text-tertiary)] font-mono self-center shrink-0">Enter</kbd>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Slides mode */}
        {mode === 'slides' && selectedFile === 'SKILL.md' ? (
          <SkillSlideView content={skillContent} skillName={skillName} />
        ) : (
        <>
        {/* Content + TOC — identical layout to MarkdownViewer */}
        <div className="flex gap-0 items-stretch">
          {/* File tree panel */}
          {fileTreePanel}

          <div className="flex-1 min-w-0 flex gap-4">
            <div className="flex-1 min-w-0 relative">
              {loading && (
                <div className="absolute inset-0 bg-[var(--color-surface-2)]/80 z-10 flex items-center justify-center rounded-r-lg">
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Loading...
                  </div>
                </div>
              )}
              {error ? (
                <div className="bg-[var(--color-surface-2)] border border-l-0 border-[var(--color-border)] rounded-lg rounded-l-none p-6 text-sm text-red-400">{error}</div>
              ) : isMarkdown && mode === 'preview' ? (
                <div ref={previewRef}
                  className={`md-preview bg-[var(--color-surface-2)] border border-l-0 border-[var(--color-border)] rounded-lg rounded-l-none p-6 overflow-hidden transition-[max-height] duration-300 ${expanded ? '' : 'max-h-[32rem]'}`}
                  dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <div ref={codeRef}
                  className={`bg-[var(--color-surface-2)] border border-l-0 border-[var(--color-border)] rounded-lg rounded-l-none p-6 text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap font-mono overflow-hidden transition-[max-height] duration-300 ${expanded ? '' : 'max-h-[32rem]'}`}>
                  {fileContent || 'No content available'}
                </div>
              )}

              {/* Gradient fade + expand */}
              {!expanded && (
                <div className="absolute bottom-0 left-0 right-0 rounded-br-lg overflow-hidden">
                  <div className="h-24 bg-gradient-to-t from-[var(--color-surface-2)] to-transparent pointer-events-none" />
                  <div className="bg-[var(--color-surface-2)] px-4 pb-3 flex justify-center border-r border-b border-[var(--color-border)] rounded-br-lg -mt-px">
                    <button onClick={() => setExpanded(true)}
                      className="text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-[var(--color-surface-3)] transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      Show full {mode === 'preview' ? 'document' : 'source'}
                    </button>
                  </div>
                </div>
              )}

              {expanded && (
                <div className="flex justify-center py-2 bg-[var(--color-surface-2)] border border-l-0 border-t-0 border-[var(--color-border)] rounded-br-lg">
                  <button onClick={() => setExpanded(false)}
                    className="text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-[var(--color-surface-3)] transition-colors">
                    <svg className="w-3.5 h-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    Collapse
                  </button>
                </div>
              )}
            </div>

          {/* TOC sidebar — identical to MarkdownViewer */}
          {isMarkdown && currentHeadings.length >= 1 && mode === 'preview' && (
            <nav className="hidden lg:block w-52 shrink-0">
              <div className="sticky top-24">
                <h4 className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">On this page</h4>
                <ul className="space-y-0.5 text-[12px] border-l border-[var(--color-border)] max-h-[calc(100vh-10rem)] overflow-y-auto">
                  {currentHeadings.map((h) => (
                    <li key={h.id}>
                      <button onClick={() => scrollToHeading(h.id)}
                        className={`block w-full text-left py-1 transition-colors border-l-2 -ml-px ${
                          h.level === 1 ? 'pl-3' : h.level === 2 ? 'pl-5' : 'pl-7'
                        } ${activeHeading === h.id ? 'border-accent-400 text-accent-400' : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border)]'}`}
                        title={h.text}>
                        <span className="line-clamp-1">{h.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          )}
          </div>
        </div>
        </>
        )}
      </div>
  );
}

// ─── Tree components ───────────────────────────────────────────────
function TreeNodes({ nodes, depth, forceOpen, selectedFile, onSelect }: { nodes: TreeNode[]; depth: number; forceOpen?: boolean; selectedFile: string; onSelect: (path: string) => void }) {
  return (
    <>
      {nodes.map((node) =>
        node.isFile ? (
          <FileNode key={node.path} node={node} depth={depth} selected={selectedFile === node.path} onSelect={onSelect} />
        ) : (
          <FolderNode key={node.path} node={node} depth={depth} forceOpen={forceOpen} selectedFile={selectedFile} onSelect={onSelect} />
        )
      )}
    </>
  );
}

function FolderNode({ node, depth, forceOpen, selectedFile, onSelect }: { node: TreeNode; depth: number; forceOpen?: boolean; selectedFile: string; onSelect: (path: string) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const isOpen = forceOpen || open;
  const fc = useMemo(() => countFiles(node.children), [node.children]);
  return (
    <div>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1 py-[3px] pr-2 hover:bg-white/[0.04] transition-colors group/f"
        style={{ paddingLeft: `${depth * 10 + 6}px` }}>
        <svg className={`w-2.5 h-2.5 text-[var(--color-text-tertiary)] shrink-0 transition-transform duration-100 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={isOpen ? '#facc15' : 'var(--color-text-tertiary)'} strokeWidth={1.5}>
          {isOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />}
        </svg>
        <span className="text-[11px] text-[var(--color-text-secondary)] truncate">{node.name}</span>
        <span className="text-[8px] text-[var(--color-text-tertiary)] ml-auto opacity-0 group-hover/f:opacity-100">{fc}</span>
      </button>
      {isOpen && <TreeNodes nodes={node.children} depth={depth + 1} forceOpen={forceOpen} selectedFile={selectedFile} onSelect={onSelect} />}
    </div>
  );
}

function FileNode({ node, depth, selected, onSelect }: { node: TreeNode; depth: number; selected: boolean; onSelect: (path: string) => void }) {
  const color = EXT_COLORS[node.ext ?? ''] ?? 'var(--color-text-tertiary)';
  return (
    <button onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1.5 py-[3px] pr-2 transition-colors ${selected ? 'bg-accent-400/10 text-accent-300' : 'hover:bg-white/[0.04] text-[var(--color-text-primary)]'}`}
      style={{ paddingLeft: `${depth * 10 + 16}px` }} title={node.path}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={selected ? 'currentColor' : color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <span className="text-[11px] truncate font-mono">{node.name}</span>
    </button>
  );
}

function HighlightText({ text, query, className }: { text: string; query: string; className?: string }) {
  if (!query.trim()) return <span className={className}>{text}</span>;
  const parts: { text: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let lastIdx = 0, pos = 0;
  while ((pos = lower.indexOf(q, lastIdx)) !== -1) {
    if (pos > lastIdx) parts.push({ text: text.slice(lastIdx, pos), match: false });
    parts.push({ text: text.slice(pos, pos + q.length), match: true });
    lastIdx = pos + q.length;
  }
  if (lastIdx < text.length) parts.push({ text: text.slice(lastIdx), match: false });
  return (
    <span className={className}>
      {parts.map((p, i) => p.match ? <mark key={i} className="bg-accent-400/25 text-accent-300 rounded-sm px-px">{p.text}</mark> : <span key={i}>{p.text}</span>)}
    </span>
  );
}

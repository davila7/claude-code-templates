import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import { sanitizeHtml, codeLang, demoteH1 } from '../lib/sanitize-html';
import { extractHeadings, forEachMarkdownLine, parseHeadingLine, stripFrontmatter } from '../lib/markdown-headings';
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
  /** Component type directory under cli-tool/components (default "skills"; mods pass "mods"). */
  componentType?: string;
  /** The file `skillContent` is (default "SKILL.md"; mods pass "README.md"). */
  mainFile?: string;
  /** Files already fetched with the component (mods): read from here instead of GitHub. */
  files?: Record<string, string>;
  /** External components (source.json): raw URL of the upstream folder at the pinned
   *  commit, for files the content file lists but does not embed (big plugins). */
  rawBase?: string;
}

const GITHUB_RAW_ROOT = 'https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components';

const EXT_COLORS: Record<string, string> = {
  md: '#60a5fa', js: '#facc15', ts: '#60a5fa', tsx: '#60a5fa', jsx: '#facc15',
  py: '#4ade80', html: '#fb923c', json: '#fde047', txt: 'var(--color-text-tertiary)',
  sh: '#86efac', yml: '#f472b6', yaml: '#f472b6', css: '#c084fc', toml: '#f472b6',
};

/** Height of the collapsed viewer; "Show full" appears only when the file is taller. */
const COLLAPSED_MAX = 'max-h-[34rem]';
/** Above this many files the tree gets a filter box; below it the box is noise. */
const FILTER_MIN_FILES = 8;
/** Lines rendered in the collapsed Code view (the rest renders on "Show full source"). */
const COLLAPSED_LINES = 120;
const DESKTOP_QUERY = '(min-width: 1024px)';

// ─── Markdown rendering ────────────────────────────────────────────
function renderMarkdown(content: string): string {
  marked.setOptions({ gfm: true, breaks: false });
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
    const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    // The page owns the only <h1>: a document's headings go one level down
    // (# → h2), keeping their look through the md-hN class.
    const tag = `h${Math.min(depth + 1, 6)}`;
    return `<${tag} id="${id}" class="md-heading md-h${depth}">${text}</${tag}>`;
  };
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    return `<div class="md-code-block"><div class="md-code-lang">${codeLang(lang)}</div><pre><code class="language-${codeLang(lang)}">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
  };
  return demoteH1(sanitizeHtml(marked.parse(stripFrontmatter(content), { renderer }) as string));
}

function buildSearchIndex(content: string, headings: Heading[]): { text: string; headingId: string }[] {
  const entries: { text: string; headingId: string }[] = [];
  let currentHeadingId = headings[0]?.id ?? '';
  let paragraph = '';
  const flush = () => { if (paragraph.trim()) entries.push({ text: paragraph.trim(), headingId: currentHeadingId }); paragraph = ''; };
  forEachMarkdownLine(content, (line, inFence) => {
    const heading = inFence ? null : parseHeadingLine(line);
    if (heading) { flush(); currentHeadingId = heading.id; return; }
    if (line.trim() === '') flush();
    else paragraph += (paragraph ? ' ' : '') + line.trim();
  });
  flush();
  return entries;
}

// ─── Tree building ─────────────────────────────────────────────────
function buildTree(paths: string[], mainFile = 'SKILL.md'): TreeNode[] {
  const root: TreeNode[] = [];
  root.push({ name: mainFile, path: mainFile, isFile: true, children: [], ext: 'md' });
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
      if (a.name === mainFile) return -1;
      if (b.name === mainFile) return 1;
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

function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP_QUERY).matches;
}

// ─── Icons ─────────────────────────────────────────────────────────
const Icon = ({ d, className = 'w-4 h-4', strokeWidth = 1.75 }: { d: string; className?: string; strokeWidth?: number }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICON = {
  sidebar: 'M3.75 5.25h16.5v13.5H3.75zM9 5.25v13.5',
  code: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
  eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  slides: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h12a2.25 2.25 0 002.25-2.25V3M2.25 3h19.5M9 20.25l3-3.75 3 3.75',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  outline: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z',
  copy: 'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75',
  check: 'M4.5 12.75l6 6 9-13.5',
  close: 'M6 18L18 6M6 6l12 12',
  chevron: 'M19 9l-7 7-7-7',
};

const iconButton = 'inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/40';
const quietButton = `${iconButton} text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]`;

// ─── Main Component ────────────────────────────────────────────────
export default function SkillExplorer({ skillContent, skillName, skillPath, references, headings: initialHeadings, componentType = 'skills', mainFile = 'SKILL.md', files, rawBase }: SkillExplorerProps) {
  const [selectedFile, setSelectedFile] = useState(mainFile);
  const [fileContent, setFileContent] = useState(skillContent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'code' | 'preview' | 'slides'>('preview');
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [activeHeading, setActiveHeading] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [highlightCount, setHighlightCount] = useState(0);
  const [treeOpen, setTreeOpen] = useState(false);
  const [treeFilter, setTreeFilter] = useState('');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);

  const totalFiles = references.length + 1;
  const isMarkdown = selectedFile.endsWith('.md');
  const html = useMemo(() => isMarkdown ? renderMarkdown(fileContent) : '', [fileContent, isMarkdown]);
  const currentHeadings = useMemo(() => {
    if (selectedFile === mainFile) return initialHeadings;
    if (isMarkdown) return extractHeadings(fileContent);
    return [];
  }, [selectedFile, fileContent, isMarkdown, initialHeadings, mainFile]);
  const searchIndex = useMemo(() => buildSearchIndex(fileContent, currentHeadings), [fileContent, currentHeadings]);
  const lines = useMemo(() => (fileContent || '').replace(/\n$/, '').split('\n'), [fileContent]);
  const showOutline = isMarkdown && mode === 'preview' && currentHeadings.length > 1;

  const tree = useMemo(() => buildTree(references, mainFile), [references, mainFile]);
  const filteredTree = useMemo(() => {
    if (!treeFilter.trim()) return tree;
    const q = treeFilter.toLowerCase();
    const t = buildTree(references.filter((r) => r.toLowerCase().includes(q)), mainFile);
    if (!mainFile.toLowerCase().includes(q)) {
      const idx = t.findIndex((n) => n.name === mainFile);
      if (idx >= 0) t.splice(idx, 1);
    }
    return t;
  }, [treeFilter, references, tree, mainFile]);

  // The tree starts open on desktop, where there is room beside the document.
  useEffect(() => { if (isDesktop()) setTreeOpen(true); }, []);

  // Fetch file content
  useEffect(() => {
    if (selectedFile === mainFile) { setFileContent(skillContent); setError(''); return; }
    if (files && selectedFile in files) { setFileContent(files[selectedFile] ?? ''); setError(''); return; }
    setLoading(true); setError('');
    fetch(rawBase ? `${rawBase}/${selectedFile}` : `${GITHUB_RAW_ROOT}/${componentType}/${skillPath}/${selectedFile}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
      .then((text) => setFileContent(text))
      .catch((e) => { setError(`Failed to load file: ${e.message}`); setFileContent(''); })
      .finally(() => setLoading(false));
  }, [selectedFile, skillPath, skillContent, componentType, mainFile, files, rawBase]);

  // The component page's file list opens a file here ('component-file:open', detail = path).
  useEffect(() => {
    const open = (e: Event) => {
      const file = (e as CustomEvent<string>).detail;
      if (file === mainFile || references.includes(file)) setSelectedFile(file);
    };
    window.addEventListener('component-file:open', open);
    return () => window.removeEventListener('component-file:open', open);
  }, [mainFile, references]);

  // "Show full" only when the file is taller than the collapsed viewer.
  useLayoutEffect(() => {
    if (expanded) return;
    const el = previewRef.current || codeRef.current;
    if (!el) { setOverflowing(false); return; }
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 4);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [html, fileContent, mode, expanded, treeOpen, error, loading]);

  // Close the outline on an outside click or Escape.
  useEffect(() => {
    if (!outlineOpen) return;
    const onDown = (e: MouseEvent) => { if (!outlineRef.current?.contains(e.target as Node)) setOutlineOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOutlineOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [outlineOpen]);
  useEffect(() => { if (!showOutline) setOutlineOpen(false); }, [showOutline]);

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

  const handleCopy = () => {
    navigator.clipboard?.writeText(fileContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

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
    // On a phone the tree sits above the document: get it out of the way once a file is picked.
    if (!isDesktop()) setTreeOpen(false);
  };

  const toggleSearch = () => {
    setSearchOpen(!searchOpen);
    if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
    else setSearchQuery('');
  };

  // Breadcrumb: component / folder / file. The root goes back to the main file.
  const crumbs = selectedFile.split('/');

  const modeButton = (value: 'code' | 'preview' | 'slides', label: string, icon: string) => (
    <button type="button" onClick={() => setMode(value)} aria-pressed={mode === value}
      className={`flex items-center gap-1.5 px-2.5 h-7 rounded-[5px] text-[12.5px] font-medium transition-colors ${mode === value
        ? 'bg-[var(--color-surface-0)] text-[var(--color-text-primary)] shadow-sm ring-1 ring-[var(--color-border)]'
        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}>
      <Icon d={icon} className="w-3.5 h-3.5" strokeWidth={2} />
      {label}
    </button>
  );

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-0)]">
      {/* Header: tree toggle, path, view switch and actions in one bar, like a repository file view. */}
      <div className="relative flex flex-wrap items-center gap-x-1.5 gap-y-2 px-2 py-1.5 bg-[var(--color-surface-1)] border-b border-[var(--color-border)] rounded-t-lg">
        <button type="button" data-explorer-tree-toggle onClick={() => setTreeOpen(!treeOpen)}
          aria-expanded={treeOpen} aria-label={treeOpen ? 'Hide file tree' : `Show file tree (${totalFiles} files)`}
          className={`${quietButton} w-8 shrink-0 ${treeOpen ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-3)]' : ''}`}>
          <Icon d={ICON.sidebar} />
        </button>

        <nav aria-label="File path" className="flex-1 min-w-0 flex items-center gap-1 font-mono text-[13px] overflow-hidden">
          <button type="button" onClick={() => handleFileClick(mainFile)}
            className="min-w-[1.5rem] shrink truncate text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:underline underline-offset-4">
            {skillName}
          </button>
          {crumbs.map((part, i) => (
            <span key={i} className={`flex items-center gap-1 min-w-0 ${i === crumbs.length - 1 ? '' : 'shrink-[2]'}`}>
              <span className="text-[var(--color-text-tertiary)]">/</span>
              <span className={`truncate ${i === crumbs.length - 1 ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>{part}</span>
            </span>
          ))}
        </nav>

        {/* View controls: their own full-width row on a phone, inline from sm up. */}
        <div className="order-last sm:order-none w-full sm:w-auto flex items-center gap-1">
          {isMarkdown && (
            <div role="group" aria-label="View" className="flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--color-surface-3)]">
              {modeButton('code', 'Code', ICON.code)}
              {modeButton('preview', 'Preview', ICON.eye)}
              {selectedFile === mainFile && modeButton('slides', 'Slides', ICON.slides)}
            </div>
          )}
          <span className="flex-1 sm:hidden" />
          {isMarkdown && mode !== 'slides' && (
            <button type="button" onClick={toggleSearch} aria-pressed={searchOpen} aria-label="Search in document" title="Search in document"
              className={`${quietButton} px-2 ${searchOpen ? 'text-[var(--color-accent)] bg-[var(--color-surface-3)]' : ''}`}>
              <Icon d={ICON.search} />
              <kbd className="hidden 2xl:inline text-[10px] px-1 py-px rounded bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] font-mono">
                {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}F
              </kbd>
            </button>
          )}
          {showOutline && (
            <div ref={outlineRef} className="relative">
              <button type="button" onClick={() => setOutlineOpen(!outlineOpen)} aria-expanded={outlineOpen} aria-haspopup="true" aria-label="Outline" title="Outline"
                className={`${quietButton} px-2 ${outlineOpen ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-3)]' : ''}`}>
                <Icon d={ICON.outline} />
                <span className="hidden 2xl:inline">Outline</span>
              </button>
              {outlineOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-[min(20rem,calc(100vw-2rem))] max-h-[min(60vh,28rem)] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-xl py-1.5"
                  style={{ scrollbarWidth: 'thin' }}>
                  <p className="px-3 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">On this page</p>
                  <ul>
                    {currentHeadings.map((h) => (
                      <li key={h.id}>
                        <button type="button" onClick={() => { setOutlineOpen(false); scrollToHeading(h.id); }}
                          className={`block w-full text-left pr-3 py-1.5 text-[13px] leading-snug transition-colors ${
                            h.level <= 1 ? 'pl-3' : h.level === 2 ? 'pl-5' : h.level === 3 ? 'pl-8' : 'pl-11'
                          } ${activeHeading === h.id
                            ? 'text-[var(--color-accent)] bg-[var(--color-surface-3)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'}`}>
                          <span className="line-clamp-2">{h.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <button type="button" onClick={handleCopy} aria-label={copied ? 'Copied' : `Copy ${crumbs[crumbs.length - 1]}`} title={`Copy ${crumbs[crumbs.length - 1]}`}
          className={`${quietButton} px-2 shrink-0 ${copied ? 'text-[var(--color-accent)]' : ''}`}>
          <Icon d={copied ? ICON.check : ICON.copy} />
          <span className="hidden 2xl:inline">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Search bar */}
      {searchOpen && isMarkdown && mode !== 'slides' && (
        <div className="relative px-2 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none"><Icon d={ICON.search} className="w-3.5 h-3.5" strokeWidth={2} /></span>
            <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search sections and content..."
              className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-md pl-9 pr-24 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-accent-400/50 focus:ring-1 focus:ring-accent-400/20 font-sans" autoFocus />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchQuery.length >= 2 && (
                <span className="text-[11px] text-[var(--color-text-tertiary)]">
                  {highlightCount > 0 ? `${highlightCount} match${highlightCount !== 1 ? 'es' : ''}` : 'No matches'}
                </span>
              )}
              <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} aria-label="Close search" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
                <Icon d={ICON.close} className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
          {searchResults.length > 0 && (
            <div className="absolute z-30 top-full left-2 right-2 mt-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {searchResults.map((result, i) => (
                <button key={`${result.id}-${i}`} onClick={() => navigateToResult(result)} onMouseEnter={() => setSelectedIdx(i)}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors ${i === selectedIdx ? 'bg-[var(--color-surface-3)]' : 'hover:bg-[var(--color-surface-2)]'}`}>
                  <span className={`mt-0.5 shrink-0 ${result.type === 'heading' ? 'text-accent-400' : 'text-[var(--color-text-tertiary)]'}`}>
                    <Icon d={result.type === 'heading' ? ICON.outline : ICON.search} className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
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
                  {i === selectedIdx && <kbd className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] font-mono self-center shrink-0">Enter</kbd>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'slides' && selectedFile === mainFile ? (
        <div className="p-3 sm:p-4">
          <SkillSlideView content={skillContent} skillName={skillName} />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row">
          {/* File tree. On desktop it sits in an absolute box so its length never sets the
              row height (the document does); it scrolls inside it and stays sticky when the
              document is expanded. On a phone it stacks above the document. */}
          {treeOpen && (
            <aside aria-label="Files" className="relative shrink-0 lg:w-60 border-b lg:border-b-0 lg:border-r border-[var(--color-border)] animate-slide-in-left">
              <div className="lg:absolute lg:inset-0">
                <div className="lg:sticky lg:top-20 flex flex-col max-h-64 lg:max-h-[min(calc(100vh-6rem),100%)]">
                  {totalFiles >= FILTER_MIN_FILES && (
                    <div className="p-2 border-b border-[var(--color-border)]">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none"><Icon d={ICON.search} className="w-3.5 h-3.5" strokeWidth={2} /></span>
                        <input type="text" value={treeFilter} onChange={(e) => setTreeFilter(e.target.value)} aria-label="Filter files"
                          placeholder={`Filter ${totalFiles} files`}
                          className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md pl-8 pr-2.5 py-1.5 text-[12.5px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-accent-400/40 focus:ring-1 focus:ring-accent-400/20" />
                      </div>
                    </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-y-auto py-1.5" style={{ scrollbarWidth: 'thin' }}>
                    {filteredTree.length === 0 ? (
                      <p className="px-3 py-4 text-center text-[12px] text-[var(--color-text-tertiary)]">No matching files</p>
                    ) : (
                      <TreeNodes nodes={filteredTree} depth={0} forceOpen={!!treeFilter} selectedFile={selectedFile} onSelect={handleFileClick} />
                    )}
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* self-start: the column is exactly the viewer's height, so the "Show full" bar
              sits at the bottom of the document, never far below it (#1621). */}
          <div className={`relative flex-1 min-w-0 self-start w-full ${treeOpen ? 'lg:min-h-[16rem]' : ''}`}>
            {loading && (
              <div className="absolute inset-0 bg-[var(--color-surface-0)]/80 z-10 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Loading...
                </div>
              </div>
            )}
            {error ? (
              <div className="p-6 text-sm text-red-400">{error}</div>
            ) : isMarkdown && mode === 'preview' ? (
              <div ref={previewRef}
                className={`md-preview px-5 py-5 sm:px-8 sm:py-6 overflow-hidden ${expanded ? '' : COLLAPSED_MAX}`}
                dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div ref={codeRef} className={`overflow-hidden ${expanded ? '' : COLLAPSED_MAX}`}>
                {fileContent ? (
                  <table className="w-full border-collapse font-mono text-[12.5px] leading-[1.65] my-3">
                    <tbody>
                      {(expanded ? lines : lines.slice(0, COLLAPSED_LINES)).map((line, i) => (
                        <tr key={i}>
                          <td className="w-px whitespace-nowrap select-none text-right align-top pl-4 pr-4 text-[var(--color-text-tertiary)] tabular-nums" aria-hidden="true">{i + 1}</td>
                          <td className="pr-4 align-top whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[var(--color-text-primary)]">{line || ' '}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-6 text-sm text-[var(--color-text-tertiary)]">No content available</p>
                )}
              </div>
            )}

            {!expanded && overflowing && !error && (
              <div className="absolute bottom-0 inset-x-0">
                <div className="h-24 bg-gradient-to-t from-[var(--color-surface-0)] to-transparent pointer-events-none" />
                <div className="flex justify-center pb-3 bg-[var(--color-surface-0)] rounded-br-lg">
                  <button type="button" onClick={() => setExpanded(true)}
                    className="flex items-center gap-1.5 px-3.5 h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors">
                    <Icon d={ICON.chevron} className="w-3.5 h-3.5" strokeWidth={2} />
                    Show full {mode === 'preview' ? 'document' : `source · ${lines.length} lines`}
                  </button>
                </div>
              </div>
            )}

            {expanded && (
              <div className="flex justify-center py-2.5 border-t border-[var(--color-border)]">
                <button type="button" onClick={() => setExpanded(false)}
                  className="flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors">
                  <Icon d={ICON.chevron} className="w-3.5 h-3.5 rotate-180" strokeWidth={2} />
                  Collapse
                </button>
              </div>
            )}
          </div>
        </div>
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
          <FileNode key={`f:${node.path}`} node={node} depth={depth} selected={selectedFile === node.path} onSelect={onSelect} />
        ) : (
          <FolderNode key={`d:${node.path}`} node={node} depth={depth} forceOpen={forceOpen} selectedFile={selectedFile} onSelect={onSelect} />
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
        className="w-[calc(100%-0.75rem)] mx-1.5 flex items-center gap-1.5 py-1 pr-2 rounded-md hover:bg-[var(--color-surface-2)] transition-colors group/f"
        style={{ paddingLeft: `${depth * 14 + 6}px` }} aria-expanded={isOpen}>
        <svg className={`w-3 h-3 text-[var(--color-text-tertiary)] shrink-0 transition-transform duration-100 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={isOpen ? '#facc15' : 'var(--color-text-tertiary)'} strokeWidth={1.5}>
          {isOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />}
        </svg>
        <span className="text-[13px] text-[var(--color-text-secondary)] truncate">{node.name}</span>
        <span className="text-[11px] text-[var(--color-text-tertiary)] ml-auto tabular-nums">{fc}</span>
      </button>
      {isOpen && <TreeNodes nodes={node.children} depth={depth + 1} forceOpen={forceOpen} selectedFile={selectedFile} onSelect={onSelect} />}
    </div>
  );
}

function FileNode({ node, depth, selected, onSelect }: { node: TreeNode; depth: number; selected: boolean; onSelect: (path: string) => void }) {
  const color = EXT_COLORS[node.ext ?? ''] ?? 'var(--color-text-tertiary)';
  return (
    <button onClick={() => onSelect(node.path)}
      className={`w-[calc(100%-0.75rem)] mx-1.5 flex items-center gap-1.5 py-1 pr-2 rounded-md transition-colors ${selected ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium' : 'hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
      style={{ paddingLeft: `${depth * 14 + 24}px` }} aria-current={selected ? 'true' : undefined}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <span className="text-[13px] truncate">{node.name}</span>
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

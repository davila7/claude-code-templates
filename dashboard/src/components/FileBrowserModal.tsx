import { useState, useEffect } from 'react';
import FileExplorer from './FileExplorer';
import MarkdownViewer from './MarkdownViewer';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface FileBrowserModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  teamSlug: string;
}

export default function FileBrowserModal({ isOpen = false, onClose, teamSlug }: FileBrowserModalProps) {
  const [open, setOpen] = useState(isOpen);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [headings, setHeadings] = useState<{ level: number; text: string; id: string }[]>([]);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-file-browser', handleOpen);
    return () => window.removeEventListener('open-file-browser', handleOpen);
  }, []);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  const fileTree: FileNode[] = [
    {
      name: 'code-review-system',
      path: 'code-review-system',
      type: 'folder',
      children: [
        { name: 'README.md', path: 'README.md', type: 'file' },
        { name: 'INDEX.md', path: 'INDEX.md', type: 'file' },
        { name: 'CHANGELOG.md', path: 'CHANGELOG.md', type: 'file' },
        { name: 'EXAMPLE_REVIEW.md', path: 'EXAMPLE_REVIEW.md', type: 'file' },
        { name: 'orchestrator.md', path: 'orchestrator.md', type: 'file' },
        { name: 'review-planner.md', path: 'review-planner.md', type: 'file' },
        { name: 'team.yaml', path: 'team.yaml', type: 'file' },
        {
          name: 'reviewers',
          path: 'reviewers',
          type: 'folder',
          children: [
            { name: 'security-reviewer.md', path: 'reviewers/security-reviewer.md', type: 'file' },
            { name: 'code-reviewer.md', path: 'reviewers/code-reviewer.md', type: 'file' },
            { name: 'architecture-reviewer.md', path: 'reviewers/architecture-reviewer.md', type: 'file' },
            { name: 'frontend-reviewer.md', path: 'reviewers/frontend-reviewer.md', type: 'file' },
            { name: 'backend-reviewer.md', path: 'reviewers/backend-reviewer.md', type: 'file' },
            { name: 'accessibility-reviewer.md', path: 'reviewers/accessibility-reviewer.md', type: 'file' },
            { name: 'async-reviewer.md', path: 'reviewers/async-reviewer.md', type: 'file' },
            { name: 'memory-safety-reviewer.md', path: 'reviewers/memory-safety-reviewer.md', type: 'file' },
            { name: 'dependency-reviewer.md', path: 'reviewers/dependency-reviewer.md', type: 'file' },
            { name: 'api-contract-reviewer.md', path: 'reviewers/api-contract-reviewer.md', type: 'file' },
            { name: 'database-reviewer.md', path: 'reviewers/database-reviewer.md', type: 'file' },
            { name: 'style-reviewer.md', path: 'reviewers/style-reviewer.md', type: 'file' },
            { name: 'test-reviewer.md', path: 'reviewers/test-reviewer.md', type: 'file' },
            { name: 'devops-reviewer.md', path: 'reviewers/devops-reviewer.md', type: 'file' },
            { name: 'mobile-reviewer.md', path: 'reviewers/mobile-reviewer.md', type: 'file' },
            { name: 'mockdata-reviewer.md', path: 'reviewers/mockdata-reviewer.md', type: 'file' },
          ]
        },
        {
          name: 'rules',
          path: 'rules',
          type: 'folder',
          children: [
            { name: 'security.md', path: 'rules/security.md', type: 'file' },
            { name: 'algorithms.md', path: 'rules/algorithms.md', type: 'file' },
            { name: 'concurrency.md', path: 'rules/concurrency.md', type: 'file' },
            { name: 'cross-file.md', path: 'rules/cross-file.md', type: 'file' },
            { name: 'predictive.md', path: 'rules/predictive.md', type: 'file' },
          ]
        },
        {
          name: 'templates',
          path: 'templates',
          type: 'folder',
          children: [
            { name: 'database-types-template.ts', path: 'templates/database-types-template.ts', type: 'file' },
            { name: 'migration-template.sql', path: 'templates/migration-template.sql', type: 'file' },
            { name: 'supabase-client-template.ts', path: 'templates/supabase-client-template.ts', type: 'file' },
          ]
        },
        {
          name: 'examples',
          path: 'examples',
          type: 'folder',
          children: [
            { name: 'mockdata-review-example.md', path: 'examples/mockdata-review-example.md', type: 'file' },
          ]
        },
      ]
    }
  ];

  const loadFile = async (path: string) => {
    setLoading(true);
    setSelectedFile(path);
    
    try {
      const response = await fetch(`/api/team-files/${teamSlug}/${path}`);
      if (response.ok) {
        const content = await response.text();
        setFileContent(content);
        
        // Extract headings for markdown files
        if (path.endsWith('.md')) {
          const headingRegex = /^(#{1,4})\s+(.+)$/gm;
          const extractedHeadings: { level: number; text: string; id: string }[] = [];
          let m;
          while ((m = headingRegex.exec(content)) !== null) {
            const text = m[2].replace(/[*_`\[\]]/g, '').trim();
            const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
            extractedHeadings.push({ level: m[1].length, text, id });
          }
          setHeadings(extractedHeadings);
        }
      } else {
        setFileContent('# Error\n\nFailed to load file.');
      }
    } catch (error) {
      setFileContent('# Error\n\nFailed to load file.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !selectedFile) {
      loadFile('README.md');
    }
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-7xl h-[90vh] bg-[var(--color-surface-0)] rounded-3xl border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Browse Files</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Explore the code review system structure
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* File Explorer Sidebar */}
          <div className="w-80 border-r border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-y-auto p-4">
            <FileExplorer
              files={fileTree}
              onFileSelect={loadFile}
              selectedFile={selectedFile || undefined}
            />
          </div>

          {/* File Viewer */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary-500)] rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm text-[var(--color-text-secondary)]">Loading file...</p>
                </div>
              </div>
            ) : selectedFile?.endsWith('.md') ? (
              <div className="p-8">
                <MarkdownViewer content={fileContent} headings={headings} />
              </div>
            ) : (
              <div className="p-8">
                <pre className="text-sm text-[var(--color-text-primary)] font-mono bg-[var(--color-surface-1)] rounded-xl p-6 border border-[var(--color-border)] overflow-x-auto">
                  <code>{fileContent}</code>
                </pre>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

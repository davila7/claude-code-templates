import { useState, useEffect } from 'react';

interface FileViewerProps {
  fileName: string;
  filePath: string;
  fileType: string;
  onClose: () => void;
}

export default function FileViewer({ fileName, filePath, fileType, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFile();
  }, [filePath]);

  async function loadFile() {
    setLoading(true);
    setError(null);
    try {
      // In a real implementation, this would fetch from your API
      // For now, we'll simulate loading
      const response = await fetch(`/api/files/${filePath}`);
      if (!response.ok) throw new Error('Failed to load file');
      const text = await response.text();
      setContent(text);
      setEditedContent(text);
    } catch (err: any) {
      console.error('Failed to load file:', err);
      setError(err.message || 'Failed to load file');
      // For demo purposes, show sample content
      const sampleContent = getSampleContent(fileName);
      setContent(sampleContent);
      setEditedContent(sampleContent);
    } finally {
      setLoading(false);
    }
  }

  function getSampleContent(name: string): string {
    if (name.endsWith('.md')) {
      return `# ${name.replace('.md', '')}\n\nThis is a sample markdown file.\n\n## Features\n- Feature 1\n- Feature 2\n- Feature 3\n\n## Usage\n\`\`\`bash\nnpx claude-code-templates --skill ${name.replace('.md', '')}\n\`\`\``;
    }
    if (name.endsWith('.py')) {
      return `#!/usr/bin/env python3\n"""${name}"""\n\ndef main():\n    """Main function"""\n    print("Hello from ${name}")\n\nif __name__ == "__main__":\n    main()`;
    }
    if (name.endsWith('.json')) {
      return `{\n  "name": "${name.replace('.json', '')}",\n  "version": "1.0.0",\n  "description": "Sample configuration"\n}`;
    }
    return `// ${name}\n\nSample file content`;
  }

  function getLanguage(name: string): string {
    if (name.endsWith('.md')) return 'markdown';
    if (name.endsWith('.py')) return 'python';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.js') || name.endsWith('.jsx')) return 'javascript';
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'typescript';
    if (name.endsWith('.css')) return 'css';
    if (name.endsWith('.html')) return 'html';
    return 'text';
  }

  function startEditing() {
    setIsEditing(true);
  }

  function cancelEditing() {
    setEditedContent(content);
    setIsEditing(false);
  }

  async function saveChanges() {
    setSaving(true);
    try {
      // In a real implementation, this would save to your API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate save
      setContent(editedContent);
      setIsEditing(false);
      alert('File saved successfully!');
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save file');
    } finally {
      setSaving(false);
    }
  }

  function downloadFile() {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(content);
    alert('Copied to clipboard!');
  }

  const language = getLanguage(fileName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl h-[85vh] bg-surface-0 rounded-xl border border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">{fileName}</h2>
              <p className="text-xs text-text-tertiary font-mono">{filePath}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-2 text-text-tertiary hover:text-text-primary transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-md bg-surface-2 text-text-tertiary border border-border font-mono">
              {language}
            </span>
            <span className="text-xs text-text-tertiary">
              {content.split('\n').length} lines
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-lg text-xs font-medium transition-all border border-border"
                  title="Copy to clipboard"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
                <button
                  onClick={downloadFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-lg text-xs font-medium transition-all border border-border"
                  title="Download file"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-xs font-medium transition-all shadow-sm"
                  title="Start editing"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Start Edit
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-lg text-xs font-medium transition-all border border-border disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving || editedContent === content}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-all shadow-sm disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-5 h-5 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-text-tertiary">Loading file...</span>
              </div>
            </div>
          ) : error && !content ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-text-primary mb-1">Failed to load file</p>
                <p className="text-xs text-text-tertiary">{error}</p>
              </div>
            </div>
          ) : isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-full p-6 bg-surface-0 text-text-primary font-mono text-xs leading-relaxed resize-none focus:outline-none"
              spellCheck={false}
            />
          ) : (
            <div className="h-full overflow-auto">
              <pre className="p-6 text-xs leading-relaxed">
                <code className="text-text-secondary font-mono whitespace-pre-wrap break-words">
                  {content}
                </code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isEditing && (
          <div className="px-6 py-3 border-t border-border bg-surface-1">
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>This file is read-only. Click "Start Edit" to make changes.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { ComponentType } from '../lib/types';

interface ComponentPreviewProps {
  content: string;
  type: ComponentType;
  editable?: boolean;
  onEdit?: (newContent: string) => void;
}

export default function ComponentPreview({
  content,
  type,
  editable = false,
  onEdit,
}: ComponentPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(isEditing ? editedContent : content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit(editedContent);
    }
    setIsEditing(false);
  };

  const language = type === 'hooks' || type === 'settings' || type === 'mcps' ? 'json' : 'markdown';

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <span className="text-xs px-2.5 py-1 bg-accent-500/20 text-accent-400 rounded-md font-medium border border-accent-500/30 flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Generated
        </span>
        <div className="flex gap-2">
          {editable && (
            <button
              onClick={() => {
                if (isEditing) {
                  handleSaveEdit();
                } else {
                  setIsEditing(true);
                }
              }}
              className="text-xs px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-lg transition-all border border-border font-medium"
            >
              {isEditing ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </span>
              )}
            </button>
          )}
          {isEditing && (
            <button
              onClick={() => {
                setEditedContent(content);
                setIsEditing(false);
              }}
              className="text-xs px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-lg transition-all border border-border font-medium"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-lg transition-all border border-border font-medium"
          >
            {copied ? (
              <span className="flex items-center gap-1.5 text-green-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full h-96 p-4 bg-surface-2 text-text-primary font-mono text-sm rounded-lg border border-border focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 resize-none"
          spellCheck={false}
        />
      ) : (
        <pre className="w-full max-h-96 overflow-auto p-4 bg-surface-2 text-text-secondary font-mono text-sm rounded-lg border border-border">
          <code className={`language-${language}`}>{content}</code>
        </pre>
      )}
    </div>
  );
}

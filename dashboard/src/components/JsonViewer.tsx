import { useState, useCallback } from 'react';

interface JsonViewerProps {
  content: string;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function parseJson(content: string): JsonValue | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export default function JsonViewer({ content }: JsonViewerProps) {
  const parsed = parseJson(content);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  if (parsed === null) {
    return (
      <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-6 text-sm text-red-400 font-mono whitespace-pre-wrap">
        Invalid JSON
        <pre className="mt-4 text-[var(--color-text-tertiary)]">{content}</pre>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">JSON</span>
        <button
          onClick={handleCopy}
          className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Copy
        </button>
      </div>
      <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg py-3 px-1 font-mono text-sm overflow-x-auto">
        <JsonNode value={parsed} path="" depth={0} defaultOpen />
      </div>
    </div>
  );
}

function JsonNode({
  value,
  path,
  depth,
  defaultOpen = false,
  keyName,
}: {
  value: JsonValue;
  path: string;
  depth: number;
  defaultOpen?: boolean;
  keyName?: string;
}) {
  if (value === null) return <JsonPrimitive keyName={keyName} depth={depth} value="null" className="text-[var(--color-text-tertiary)] italic" />;
  if (typeof value === 'boolean') return <JsonPrimitive keyName={keyName} depth={depth} value={String(value)} className="text-purple-400" />;
  if (typeof value === 'number') return <JsonPrimitive keyName={keyName} depth={depth} value={String(value)} className="text-cyan-400" />;
  if (typeof value === 'string') return <JsonString keyName={keyName} depth={depth} value={value} />;
  if (Array.isArray(value)) return <JsonArray keyName={keyName} depth={depth} value={value} path={path} defaultOpen={defaultOpen} />;
  if (typeof value === 'object') return <JsonObject keyName={keyName} depth={depth} value={value as Record<string, JsonValue>} path={path} defaultOpen={defaultOpen} />;
  return null;
}

function JsonPrimitive({ keyName, depth, value, className }: { keyName?: string; depth: number; value: string; className: string }) {
  return (
    <div className="flex items-start" style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}>
      {keyName !== undefined && (
        <span className="text-accent-400 shrink-0">&quot;{keyName}&quot;<span className="text-[var(--color-text-tertiary)]">: </span></span>
      )}
      <span className={className}>{value}</span>
    </div>
  );
}

function JsonString({ keyName, depth, value }: { keyName?: string; depth: number; value: string }) {
  const isLong = value.length > 120;
  const [expanded, setExpanded] = useState(!isLong);

  const display = expanded ? value : value.slice(0, 80) + '...';

  return (
    <div className="flex items-start group/str" style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}>
      {keyName !== undefined && (
        <span className="text-accent-400 shrink-0">&quot;{keyName}&quot;<span className="text-[var(--color-text-tertiary)]">: </span></span>
      )}
      <span className="text-green-400 break-all">
        &quot;{display}&quot;
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.1] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors align-middle"
          >
            {expanded ? 'less' : `+${value.length - 80} chars`}
          </button>
        )}
      </span>
    </div>
  );
}

function JsonObject({
  keyName,
  depth,
  value,
  path,
  defaultOpen,
}: {
  keyName?: string;
  depth: number;
  value: Record<string, JsonValue>;
  path: string;
  defaultOpen?: boolean;
}) {
  const keys = Object.keys(value);
  const [open, setOpen] = useState(defaultOpen || depth < 2);

  const handleCopySection = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
  }, [value]);

  if (keys.length === 0) {
    return (
      <div style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}>
        {keyName !== undefined && (
          <span className="text-accent-400">&quot;{keyName}&quot;<span className="text-[var(--color-text-tertiary)]">: </span></span>
        )}
        <span className="text-[var(--color-text-tertiary)]">{'{}'}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 group/obj cursor-pointer hover:bg-white/[0.02] rounded py-0.5 transition-colors"
        style={{ paddingLeft: `${depth * 1.25 + 0.25}rem` }}
        onClick={() => setOpen(!open)}
      >
        <svg
          className={`w-3 h-3 text-[var(--color-text-tertiary)] shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        {keyName !== undefined && (
          <span className="text-accent-400">&quot;{keyName}&quot;<span className="text-[var(--color-text-tertiary)]">: </span></span>
        )}
        <span className="text-[var(--color-text-tertiary)]">{'{'}</span>
        {!open && (
          <span className="text-[var(--color-text-tertiary)] text-xs ml-1">
            {keys.length} key{keys.length !== 1 ? 's' : ''}
          </span>
        )}
        {!open && <span className="text-[var(--color-text-tertiary)]">{'}'}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); handleCopySection(); }}
          className="ml-auto mr-2 opacity-0 group-hover/obj:opacity-100 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.1] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-all"
          title="Copy this section"
        >
          Copy
        </button>
      </div>
      {open && (
        <>
          {keys.map((k) => (
            <JsonNode key={k} keyName={k} value={value[k]} path={`${path}.${k}`} depth={depth + 1} />
          ))}
          <div className="text-[var(--color-text-tertiary)]" style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}>{'}'}</div>
        </>
      )}
    </div>
  );
}

function JsonArray({
  keyName,
  depth,
  value,
  path,
  defaultOpen,
}: {
  keyName?: string;
  depth: number;
  value: JsonValue[];
  path: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || depth < 2);

  const handleCopySection = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
  }, [value]);

  if (value.length === 0) {
    return (
      <div style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}>
        {keyName !== undefined && (
          <span className="text-accent-400">&quot;{keyName}&quot;<span className="text-[var(--color-text-tertiary)]">: </span></span>
        )}
        <span className="text-[var(--color-text-tertiary)]">{'[]'}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 group/arr cursor-pointer hover:bg-white/[0.02] rounded py-0.5 transition-colors"
        style={{ paddingLeft: `${depth * 1.25 + 0.25}rem` }}
        onClick={() => setOpen(!open)}
      >
        <svg
          className={`w-3 h-3 text-[var(--color-text-tertiary)] shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        {keyName !== undefined && (
          <span className="text-accent-400">&quot;{keyName}&quot;<span className="text-[var(--color-text-tertiary)]">: </span></span>
        )}
        <span className="text-[var(--color-text-tertiary)]">{'['}</span>
        {!open && (
          <span className="text-[var(--color-text-tertiary)] text-xs ml-1">
            {value.length} item{value.length !== 1 ? 's' : ''}
          </span>
        )}
        {!open && <span className="text-[var(--color-text-tertiary)]">{']'}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); handleCopySection(); }}
          className="ml-auto mr-2 opacity-0 group-hover/arr:opacity-100 text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-all"
          title="Copy this section"
        >
          Copy
        </button>
      </div>
      {open && (
        <>
          {value.map((item, i) => (
            <JsonNode key={i} value={item} path={`${path}[${i}]`} depth={depth + 1} />
          ))}
          <div className="text-[var(--color-text-tertiary)]" style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}>{']'}</div>
        </>
      )}
    </div>
  );
}

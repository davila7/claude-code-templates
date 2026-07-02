import { useEffect, useRef } from 'react';
import type { ToolExecution } from '../../lib/live-task/types';

const toolColors: Record<string, string> = {
  Read: '#22c55e',
  Write: '#f59e0b',
  Edit: '#f59e0b',
  Bash: '#ef4444',
  Grep: '#8b5cf6',
  Glob: '#8b5cf6',
  WebSearch: '#3b82f6',
  WebFetch: '#3b82f6',
  Agent: '#ec4899',
};

function sanitizePaths(s: string): string {
  return s
    .replace(/\/Users\/[^/]+\/[^"' ]*(Proyectos|Projects|github|repos)\/[^/]+\//gi, '')
    .replace(/\/Users\/[^/]+\//g, '~/');
}

function relativeTime(baseTime: string, eventTime: string): string {
  const diff = new Date(eventTime).getTime() - new Date(baseTime).getTime();
  const totalSecs = Math.floor(diff / 1000);
  if (totalSecs < 0) return '+0s';
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins === 0) return `+${secs}s`;
  return `+${mins}m ${secs}s`;
}

interface Props {
  tools: ToolExecution[];
  cycleStartTime: string | null;
}

export default function ToolTimeline({ tools, cycleStartTime }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tools.length, cycleStartTime]);

  if (!cycleStartTime) {
    return (
      <div style={{
        padding: '32px 16px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 14,
        fontFamily: 'monospace',
      }}>
        Select a cycle to view tool executions
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div style={{
        padding: '32px 16px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 14,
        fontFamily: 'monospace',
      }}>
        No tool executions recorded yet for this cycle
      </div>
    );
  }

  let currentPhase = '';

  return (
    <div style={{
      maxHeight: 400,
      overflowY: 'auto',
      padding: '8px 0',
    }}>
      {tools.map((tool, i) => {
        const showPhaseSeparator = tool.phase && tool.phase !== currentPhase;
        if (tool.phase) currentPhase = tool.phase;

        return (
          <div key={tool.id}>
            {showPhaseSeparator && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px 4px',
              }}>
                <div style={{ height: 1, flex: 1, background: '#2a2a2a' }} />
                <span style={{
                  fontSize: 10,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontFamily: 'monospace',
                }}>
                  {tool.phase}
                </span>
                <div style={{ height: 1, flex: 1, background: '#2a2a2a' }} />
              </div>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '6px 16px',
              fontSize: 13,
              fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
            }}>
              {/* Timestamp */}
              <span style={{ color: '#4b5563', fontSize: 11, minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
                {relativeTime(cycleStartTime, tool.created_at)}
              </span>

              {/* Timeline dot + line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: tool.result_status === 'error' ? '#ef4444' : (toolColors[tool.tool_name] || '#6b7280'),
                  marginTop: 4,
                }} />
                {i < tools.length - 1 && (
                  <div style={{ width: 1, height: 20, background: '#2a2a2a', marginTop: 2 }} />
                )}
              </div>

              {/* Tool info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 600,
                  background: `${toolColors[tool.tool_name] || '#6b7280'}20`,
                  color: toolColors[tool.tool_name] || '#6b7280',
                  marginRight: 8,
                }}>
                  {tool.tool_name}
                </span>
                <span style={{
                  color: '#9ca3af',
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {sanitizePaths(tool.tool_args_summary || '')}
                </span>
              </div>

              {/* Status icon */}
              <span style={{ fontSize: 12, flexShrink: 0 }}>
                {tool.result_status === 'error' ? '!' : ''}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import type { ReviewCycle, ToolExecution, CycleControl } from '../../lib/live-task/types';
import CycleTable from './CycleTable';
import ToolTimeline from './ToolTimeline';

const POLL_INTERVAL = 5000;

export default function LiveTaskPanel() {
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolExecution[]>([]);
  const [control, setControl] = useState<CycleControl | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchCycles = useCallback(async () => {
    try {
      const res = await fetch('/api/live-task/cycles?limit=20');
      const data = await res.json();
      setCycles(data.cycles || []);
    } catch { /* silent */ }
  }, []);

  const fetchControl = useCallback(async () => {
    try {
      const res = await fetch('/api/live-task/control');
      const data = await res.json();
      setControl(data.control || null);
    } catch { /* silent */ }
  }, []);

  const fetchTools = useCallback(async (cycleId: string) => {
    try {
      const res = await fetch(`/api/live-task/tools?cycle_id=${cycleId}`);
      const data = await res.json();
      setTools(data.tools || []);
    } catch { /* silent */ }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([fetchCycles(), fetchControl()]).then(() => setLoading(false));
  }, [fetchCycles, fetchControl]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCycles();
      fetchControl();
      if (selectedCycleId) fetchTools(selectedCycleId);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchCycles, fetchControl, fetchTools, selectedCycleId]);

  // Fetch tools when selection changes
  useEffect(() => {
    if (selectedCycleId) {
      fetchTools(selectedCycleId);
    } else {
      setTools([]);
    }
  }, [selectedCycleId, fetchTools]);

  const [authError, setAuthError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is the authorized admin
  useEffect(() => {
    const checkAdmin = () => {
      const clerk = (window as any).Clerk;
      if (!clerk?.user) {
        setIsAdmin(false);
        return;
      }
      const email = clerk.user.primaryEmailAddress?.emailAddress;
      setIsAdmin(email === 'dan.avila7@gmail.com');
    };
    // Clerk may not be loaded yet
    const interval = setInterval(() => {
      if ((window as any).Clerk?.loaded) {
        checkAdmin();
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleTogglePause = async () => {
    if (!control) return;
    setToggling(true);
    setAuthError(null);
    try {
      const clerk = (window as any).Clerk;
      if (!clerk?.session) {
        setAuthError('Sign in required');
        setToggling(false);
        return;
      }
      const token = await clerk.session.getToken();
      const res = await fetch('/api/live-task/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_paused: !control.is_paused,
          reason: control.is_paused ? 'Resumed from dashboard' : 'Paused from dashboard',
        }),
      });
      if (res.status === 401) {
        setAuthError('Sign in required');
      } else if (res.status === 403) {
        setAuthError('Only the project admin can control the review cycle');
      } else if (!res.ok) {
        setAuthError('Failed to update control');
      }
      await fetchControl();
    } catch { setAuthError('Network error'); }
    setToggling(false);
  };

  const selectedCycle = cycles.find(c => c.id === selectedCycleId) || null;
  const activeCycles = cycles.filter(c => c.status === 'active').length;

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: '24px 16px',
      fontFamily: "'Geist', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#e5e7eb',
            margin: 0,
            fontFamily: "'Geist Mono', monospace",
          }}>
            Component Review Loop
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
            {loading ? 'Loading...' : `${cycles.length} cycles total | ${activeCycles} active`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {control && (
            <>
              <span style={{
                fontSize: 12,
                color: control.is_paused ? '#f59e0b' : '#22c55e',
                fontFamily: 'monospace',
              }}>
                {control.is_paused ? 'PAUSED' : 'RUNNING'}
              </span>
              {isAdmin && (
                <button
                  onClick={handleTogglePause}
                  disabled={toggling}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    border: '1px solid #2a2a2a',
                    background: control.is_paused ? '#1e3a5f' : '#1a1a1a',
                    color: control.is_paused ? '#60a5fa' : '#9ca3af',
                    fontSize: 13,
                    cursor: toggling ? 'wait' : 'pointer',
                    fontFamily: "'Geist Mono', monospace",
                    opacity: toggling ? 0.6 : 1,
                  }}
                >
                  {control.is_paused ? 'Resume' : 'Pause'}
                </button>
              )}
            </>
          )}
          {authError && (
            <span style={{ fontSize: 12, color: '#ef4444', fontFamily: 'monospace' }}>
              {authError}
            </span>
          )}
        </div>
      </div>

      {/* Cycles Table */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1a1a1a',
        borderRadius: 8,
        marginBottom: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid #1a1a1a',
          fontSize: 12,
          color: '#6b7280',
          fontFamily: "'Geist Mono', monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Review Cycles
        </div>
        <CycleTable
          cycles={cycles}
          selectedId={selectedCycleId}
          onSelect={setSelectedCycleId}
        />
      </div>

      {/* Tool Timeline */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1a1a1a',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 12,
            color: '#6b7280',
            fontFamily: "'Geist Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Tool Executions
          </span>
          {selectedCycle && (
            <span style={{
              fontSize: 11,
              color: '#4b5563',
              fontFamily: 'monospace',
            }}>
              {tools.length} tools | {selectedCycle.component_path.split('/').pop()}
            </span>
          )}
        </div>
        <ToolTimeline
          tools={tools}
          cycleStartTime={selectedCycle?.started_at || null}
        />
      </div>

      {/* Error display for selected cycle */}
      {selectedCycle?.error_message && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: '#1a0a0a',
          border: '1px solid #3f1515',
          borderRadius: 8,
          fontSize: 13,
          color: '#ef4444',
          fontFamily: "'Geist Mono', monospace",
        }}>
          Error: {selectedCycle.error_message}
        </div>
      )}

      {/* Improvements summary for selected cycle */}
      {selectedCycle?.improvements_summary && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: '#0a1a0a',
          border: '1px solid #153f15',
          borderRadius: 8,
          fontSize: 13,
          color: '#9ca3af',
          fontFamily: "'Geist Mono', monospace",
          whiteSpace: 'pre-wrap',
        }}>
          {selectedCycle.improvements_summary}
        </div>
      )}
    </div>
  );
}

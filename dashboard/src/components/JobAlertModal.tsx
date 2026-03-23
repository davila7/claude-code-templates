import { useState } from 'react';

interface JobAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters?: {
    location?: string;
    salary?: string;
    experience?: string;
    techStack?: string[];
  };
}

export default function JobAlertModal({ isOpen, onClose, currentFilters }: JobAlertModalProps) {
  const [alertName, setAlertName] = useState('');
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly'>('daily');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSave() {
    if (!alertName.trim()) return;

    setSaving(true);
    try {
      // For now, save to localStorage (can be upgraded to API later)
      const alerts = JSON.parse(localStorage.getItem('jobAlerts') || '[]');
      const newAlert = {
        id: Date.now().toString(),
        name: alertName,
        filters: currentFilters || {},
        frequency,
        enabled: true,
        createdAt: new Date().toISOString(),
      };
      alerts.push(newAlert);
      localStorage.setItem('jobAlerts', JSON.stringify(alerts));

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setAlertName('');
      }, 1500);
    } catch (error) {
      console.error('Error saving alert:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
          <h2 className="text-[16px] font-semibold text-[#ededed]">Create Job Alert</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#666] hover:text-[#a1a1a1] hover:bg-white/[0.04] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {success ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[14px] text-[#ededed] font-medium">Alert Created!</p>
              <p className="text-[12px] text-[#666] mt-1">You'll be notified of matching jobs</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[13px] text-[#a1a1a1] mb-2">Alert Name</label>
                <input
                  type="text"
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  placeholder="e.g., Senior React Remote Jobs"
                  className="w-full bg-[#111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-[13px] text-[#ededed] placeholder-[#555] outline-none focus:border-[#333]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[13px] text-[#a1a1a1] mb-2">Notification Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['instant', 'daily', 'weekly'] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFrequency(freq)}
                      className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                        frequency === freq
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-[#111] text-[#666] border border-[#1f1f1f] hover:border-[#333]'
                      }`}
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {currentFilters && Object.keys(currentFilters).length > 0 && (
                <div>
                  <label className="block text-[13px] text-[#a1a1a1] mb-2">Current Filters</label>
                  <div className="bg-[#111] border border-[#1f1f1f] rounded-lg p-3 space-y-1">
                    {currentFilters.location && (
                      <div className="text-[12px] text-[#999]">
                        <span className="text-[#666]">Location:</span> {currentFilters.location}
                      </div>
                    )}
                    {currentFilters.salary && (
                      <div className="text-[12px] text-[#999]">
                        <span className="text-[#666]">Salary:</span> {currentFilters.salary}
                      </div>
                    )}
                    {currentFilters.experience && (
                      <div className="text-[12px] text-[#999]">
                        <span className="text-[#666]">Experience:</span> {currentFilters.experience}
                      </div>
                    )}
                    {currentFilters.techStack && currentFilters.techStack.length > 0 && (
                      <div className="text-[12px] text-[#999]">
                        <span className="text-[#666]">Tech:</span> {currentFilters.techStack.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[11px] text-blue-400">
                    You'll receive notifications when new jobs match your criteria. Alerts are saved locally in your browser.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#1f1f1f]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-[#a1a1a1] hover:text-[#ededed] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!alertName.trim() || saving}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-[13px] text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Creating...' : 'Create Alert'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

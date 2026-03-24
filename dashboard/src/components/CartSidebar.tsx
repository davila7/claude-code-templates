import { useState, useEffect } from 'react';
import type { Cart } from '../lib/types';
import { TYPE_CONFIG } from '../lib/icons';
import { copyToClipboard } from '../lib/clipboard';

const EMPTY_CART: Cart = {
  agents: [], commands: [], settings: [], hooks: [], mcps: [], skills: [], templates: [],
};

const TYPE_FLAGS: Record<string, string> = {
  agents: '--agent', commands: '--command', settings: '--setting',
  hooks: '--hook', mcps: '--mcp', skills: '--skill', templates: '--template',
};

function cleanPath(path: string): string {
  return path?.replace(/\.(md|json)$/, '') ?? '';
}

function formatName(name: string): string {
  if (!name) return '';
  return name.replace(/\.(md|json)$/, '').replace(/[-_]/g, ' ')
    .split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function CartSidebar() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [copied, setCopied] = useState(false);

  // Load cart
  useEffect(() => {
    function loadCart() {
      try {
        const saved = localStorage.getItem('claudeCodeCart');
        if (saved) setCart({ ...EMPTY_CART, ...JSON.parse(saved) });
      } catch {}
    }

    loadCart();
    window.addEventListener('cart-updated', ((e: CustomEvent) => {
      setCart({ ...EMPTY_CART, ...e.detail });
    }) as EventListener);
    window.addEventListener('storage', loadCart);

    return () => window.removeEventListener('storage', loadCart);
  }, []);

  const totalItems = Object.values(cart).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);

  // Generate command
  function generateCommand(): string {
    let cmd = 'npx claude-code-templates@latest';
    for (const [type, items] of Object.entries(cart)) {
      if (items?.length > 0) {
        const flag = TYPE_FLAGS[type];
        if (flag) {
          const paths = items.map((i: any) => cleanPath(i.path)).join(',');
          cmd += ` ${flag} ${paths}`;
        }
      }
    }
    return cmd;
  }

  function removeItem(path: string, type: string) {
    setCart((prev) => {
      const next = { ...prev, [type]: (prev as any)[type]?.filter((i: any) => i.path !== path) ?? [] };
      localStorage.setItem('claudeCodeCart', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: next }));
      return next;
    });
  }

  function clearAll() {
    if (!confirm('Clear your entire stack?')) return;
    const empty = { ...EMPTY_CART };
    setCart(empty);
    localStorage.setItem('claudeCodeCart', JSON.stringify(empty));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: empty }));
  }

  async function copyCommand() {
    const success = await copyToClipboard(generateCommand());
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function shareTwitter() {
    const cmd = generateCommand();
    const text = `Check out my Claude Code stack!\n\n${cmd}\n\nBuild yours at https://aitmpl.com`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <>
      {/* Floating button */}
      {totalItems > 0 && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 pl-5 pr-4 py-3 bg-gradient-to-br from-[#7C5CFF] to-[#00E5FF] hover:from-[#9277FF] hover:to-[#22D3EE] text-white rounded-full shadow-[0_8px_32px_rgba(124,92,255,0.4)] transition-all hover:scale-105 hover:shadow-[0_12px_40px_rgba(124,92,255,0.6)] hover:-translate-y-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-[14px] font-semibold">Stack</span>
          <span className="min-w-6 h-6 px-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-[12px] font-bold flex items-center justify-center">
            {totalItems}
          </span>
        </button>
      )}

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 animate-in fade-in duration-200" onClick={() => setOpen(false)} />
      )}

      {/* Floating Sidebar Panel */}
      <div
        className={`fixed top-4 right-4 bottom-4 w-[420px] max-w-[calc(100vw-2rem)] bg-[var(--color-surface-1)]/95 backdrop-blur-xl border border-[var(--color-border-hover)] rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.5),0_0_60px_rgba(124,92,255,0.2)] z-50 transform transition-all duration-300 ${
          open ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+2rem)] opacity-0'
        } flex flex-col overflow-hidden`}
      >
        {/* Header with gradient accent */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-hover)]">
          {/* Gradient glow behind header */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#7C5CFF]/10 to-[#00E5FF]/10 pointer-events-none"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C5CFF] to-[#00E5FF] flex items-center justify-center shadow-[0_4px_12px_rgba(124,92,255,0.3)]">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">Stack Builder</h2>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">{totalItems} component{totalItems !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            {totalItems > 0 && (
              <button
                onClick={clearAll}
                className="text-[12px] text-[var(--color-text-tertiary)] hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-all font-medium"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {totalItems === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C5CFF]/20 to-[#00E5FF]/20 flex items-center justify-center mb-4 shadow-[0_8px_24px_rgba(124,92,255,0.15)]">
                <svg className="w-8 h-8 text-[var(--color-primary-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">Your stack is empty</p>
              <p className="text-[13px] text-[var(--color-text-tertiary)]">Click the + button on components to add them</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(cart).filter(([, items]) => items?.length > 0).map(([type, items]) => {
                const config = TYPE_CONFIG[type];
                return (
                  <div key={type} className="bg-[var(--color-surface-2)]/50 backdrop-blur-sm border border-[var(--color-border)] rounded-xl p-3 hover:border-[var(--color-border-hover)] transition-all">
                    {/* Folder header */}
                    <div className="flex items-center gap-2.5 mb-2 pb-2 border-b border-[var(--color-border)]">
                      <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-3)] flex items-center justify-center">
                        <svg className="w-4 h-4 text-[var(--color-primary-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                        </svg>
                      </div>
                      <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                        {config?.label ?? type}
                      </span>
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)] font-medium">
                        {items.length}
                      </span>
                    </div>
                    {/* File list */}
                    <div className="space-y-1">
                      {items.map((item: any) => (
                        <div
                          key={item.path}
                          className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[var(--color-surface-3)] transition-all"
                        >
                          {/* File icon */}
                          <svg className="w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {/* Name */}
                          <span className="text-[13px] text-[var(--color-text-primary)] flex-1 truncate font-medium">
                            {formatName(item.name)}
                          </span>
                          {/* Remove button */}
                          <button
                            onClick={() => removeItem(item.path, type)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-[var(--color-text-tertiary)] hover:text-red-400 transition-all shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with glassmorphism */}
        {totalItems > 0 && (
          <div className="relative border-t border-[var(--color-border-hover)] bg-[var(--color-surface-2)]/80 backdrop-blur-xl p-4 space-y-3">
            {/* Gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#7C5CFF]/5 to-transparent pointer-events-none"></div>
            
            {/* Command box */}
            <div className="relative bg-[var(--color-surface-0)]/80 backdrop-blur-sm border border-[var(--color-border)] rounded-xl p-3 max-h-24 overflow-y-auto">
              <code className="text-[12px] font-mono text-[var(--color-text-secondary)] break-all leading-relaxed">
                {generateCommand()}
              </code>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 relative z-10">
              <button
                onClick={copyCommand}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-[#7C5CFF] to-[#00E5FF] hover:from-[#9277FF] hover:to-[#22D3EE] text-white rounded-xl text-[13px] font-semibold transition-all hover:shadow-[0_8px_24px_rgba(124,92,255,0.4)] hover:-translate-y-0.5"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Command
                  </>
                )}
              </button>
              <button
                onClick={shareTwitter}
                className="px-4 py-3 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-4)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-xl transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                title="Share on Twitter"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

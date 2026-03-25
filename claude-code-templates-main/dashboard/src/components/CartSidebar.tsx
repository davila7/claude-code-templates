import { useState, useEffect } from 'react';
import type { Cart } from '../lib/types';
import { TYPE_CONFIG } from '../lib/icons';

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

  function copyCommand() {
    navigator.clipboard.writeText(generateCommand());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 pl-4 pr-3 py-2.5 bg-white hover:bg-neutral-100 text-black rounded-full shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition-all hover:scale-105 hover:shadow-[0_4px_24px_rgba(255,255,255,0.25)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-[13px] font-semibold">Stack</span>
          <span className="min-w-5 h-5 px-1 rounded-full bg-black text-white text-[11px] font-medium flex items-center justify-center">
            {totalItems}
          </span>
        </button>
      )}

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-[#0a0a0a] border-l border-[#1f1f1f] z-50 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-border]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[--color-text-primary]">Stack Builder</h2>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[--color-surface-3] text-[--color-text-tertiary]">
              {totalItems}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {totalItems > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-[--color-text-tertiary] hover:text-red-400 px-2 py-1 rounded transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-[--color-surface-3] text-[--color-text-secondary]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto h-[calc(100%-140px)]">
          {totalItems === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 rounded-full bg-[--color-surface-3] flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-sm text-[--color-text-secondary]">Your stack is empty</p>
              <p className="text-xs text-[--color-text-tertiary] mt-1">Click + on components to add them</p>
            </div>
          ) : (
            <div className="px-3 py-2">
              {Object.entries(cart).filter(([, items]) => items?.length > 0).map(([type, items], idx, arr) => {
                const config = TYPE_CONFIG[type];
                const isLast = idx === arr.length - 1;
                return (
                  <div key={type} className={!isLast ? 'mb-1 pb-1 border-b border-[#1f1f1f]' : ''}>
                    {/* Folder row */}
                    <div className="flex items-center gap-2 py-1.5 px-1">
                      <svg className="w-4 h-4 shrink-0 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                      </svg>
                      <span className="text-[12px] font-medium text-[#a1a1a1]">
                        {config?.label ?? type}
                      </span>
                      <span className="text-[11px] text-[#666] tabular-nums">
                        {items.length}
                      </span>
                    </div>
                    {/* File rows with tree lines */}
                    {items.map((item: any, i: number) => {
                      const isLastItem = i === items.length - 1;
                      return (
                        <div
                          key={item.path}
                          className="flex items-center group pl-3 pr-1"
                        >
                          {/* Tree connector */}
                          <span className="text-[#333] text-[12px] font-mono w-5 shrink-0 select-none">
                            {isLastItem ? '└─' : '├─'}
                          </span>
                          {/* File icon */}
                          <svg className="w-3.5 h-3.5 shrink-0 mr-2 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {/* Name */}
                          <span className="text-[12px] text-[#ededed] flex-1 truncate py-1">
                            {formatName(item.name)}
                          </span>
                          {/* Remove */}
                          <button
                            onClick={() => removeItem(item.path, type)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#1a1a1a] text-[#555] hover:text-red-400 transition-all shrink-0"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {totalItems > 0 && (
          <div className="absolute bottom-0 left-0 right-0 border-t border-[#1f1f1f] bg-[#0a0a0a] p-3 space-y-2">
            {/* Command */}
            <div className="bg-[--color-surface-0] rounded-lg p-2.5 text-xs font-mono text-[--color-text-secondary] break-all max-h-20 overflow-y-auto">
              {generateCommand()}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={copyCommand}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[--color-accent-500] hover:bg-[--color-accent-600] text-white rounded-lg text-sm font-medium transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Command
                  </>
                )}
              </button>
              <button
                onClick={shareTwitter}
                className="px-3 py-2 bg-[--color-surface-3] hover:bg-[--color-surface-4] text-[--color-text-secondary] hover:text-[--color-text-primary] rounded-lg text-sm transition-colors"
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

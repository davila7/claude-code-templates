import { useEffect, useState } from 'react';

// "Add to stack" on the component page. Same cart as the grid cards
// (localStorage 'claudeCodeCart' + 'cart-updated'), so CartSidebar picks it up.

interface CartItem { name: string; path: string; category: string; description: string; icon: string }
type CartState = Record<string, CartItem[]>;

interface Props {
  typePlural: string;
  name: string;
  path: string;
  category: string;
  description: string;
}

function readCart(): CartState {
  try {
    return JSON.parse(localStorage.getItem('claudeCodeCart') || '{}');
  } catch {
    return {};
  }
}

export default function AddToStackButton({ typePlural, name, path, category, description }: Props) {
  const [inStack, setInStack] = useState(false);

  useEffect(() => {
    const sync = () => setInStack(readCart()[typePlural]?.some((i) => i.path === path) ?? false);
    sync();
    window.addEventListener('cart-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cart-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [typePlural, path]);

  function toggle() {
    const cart = readCart();
    const items = cart[typePlural] ?? [];
    const next: CartState = inStack
      ? { ...cart, [typePlural]: items.filter((i) => i.path !== path) }
      : { ...cart, [typePlural]: [...items, { name, path, category, description, icon: typePlural }] };
    try {
      localStorage.setItem('claudeCodeCart', JSON.stringify(next));
    } catch { /* private mode: the event still updates this page */ }
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: next }));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={inStack}
      className="inline-flex h-10 md:h-9 w-full md:w-auto items-center justify-center gap-1.5 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[14px] md:text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
    >
      <svg className={`w-4 h-4 ${inStack ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        {inStack ? <path d="m3.5 8.5 3 3 6-7" /> : <path d="M8 3v10M3 8h10" />}
      </svg>
      {inStack ? 'In stack' : 'Add to stack'}
    </button>
  );
}

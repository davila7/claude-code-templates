// Small notice in the corner of the page, outside React so the code that
// resumes a pending action (on any page) can use it. One at a time.

export interface ToastOptions {
  message: string;
  /** Optional link shown as a button. External links open in a new tab. */
  action?: { label: string; href: string; external?: boolean };
  /** Milliseconds before it closes itself; 0 keeps it until closed. */
  duration?: number;
}

const TOAST_ID = 'aitmpl-toast';
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast({ message, action, duration = 6000 }: ToastOptions): void {
  if (typeof document === 'undefined') return;
  document.getElementById(TOAST_ID)?.remove();
  if (timer) { clearTimeout(timer); timer = null; }

  const box = document.createElement('div');
  box.id = TOAST_ID;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  box.style.cssText =
    'position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147482000;' +
    'max-width:380px;margin-left:auto;display:flex;align-items:center;gap:12px;padding:12px 12px 12px 16px;' +
    'border-radius:10px;background:var(--color-surface-1,#141413);border:1px solid var(--color-border,#2a2926);' +
    'color:var(--color-text-primary,#faf9f5);font-family:var(--font-sans,system-ui,sans-serif);font-size:13px;' +
    'line-height:1.45;box-shadow:0 12px 40px rgba(0,0,0,.45);';

  const text = document.createElement('p');
  text.textContent = message;
  text.style.cssText = 'margin:0;flex:1;min-width:0;';
  box.append(text);

  if (action) {
    const link = document.createElement('a');
    link.href = action.href;
    link.textContent = action.label;
    if (action.external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.style.cssText =
      'flex-shrink:0;padding:7px 12px;border-radius:6px;background:var(--color-accent,#d57455);color:#fff;' +
      'font-weight:500;text-decoration:none;white-space:nowrap;';
    link.addEventListener('click', () => close());
    box.append(link);
  }

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.style.cssText =
    'flex-shrink:0;width:28px;height:28px;border:0;border-radius:6px;background:transparent;cursor:pointer;' +
    'color:var(--color-text-tertiary,#77756c);font-size:18px;line-height:1;font-family:inherit;';
  dismiss.addEventListener('click', () => close());
  box.append(dismiss);

  function close() {
    box.remove();
    if (timer) { clearTimeout(timer); timer = null; }
  }

  document.body.append(box);
  if (duration > 0) timer = setTimeout(close, duration);
}

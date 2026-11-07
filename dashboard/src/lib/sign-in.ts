// Sign-in entry point for every "Sign in" button on the site.
//
// Social apps (X, Instagram, Facebook, LinkedIn, TikTok...) open links in an
// embedded WebView. GitHub and Google OAuth break there: Google refuses
// embedded user agents (disallowed_useragent) and the GitHub round trip comes
// back to clerk.aitmpl.com without the Clerk client cookie, so Clerk answers
// {"code":"authorization_invalid"}. Nothing in our Clerk config fixes that, so
// inside an in-app browser we explain it and offer to reopen the page in the
// system browser before showing Clerk's modal.

export type InAppBrowser = { app: string; platform: 'ios' | 'android' | 'other' };

const APP_MARKERS: Array<[RegExp, string]> = [
  [/\bTwitter\b|\bTwitterAndroid\b/i, 'X'],
  [/\bFBAN\/|\bFBAV\/|\bFB_IAB\b|\bFBIOS\b/, 'Facebook'],
  [/\bInstagram\b/, 'Instagram'],
  [/\bThreads\b/, 'Threads'],
  [/\bLinkedInApp\b/, 'LinkedIn'],
  [/\bmusical_ly\b|\bBytedanceWebview\b|\bTikTok\b/i, 'TikTok'],
  [/\bSnapchat\b/, 'Snapchat'],
  [/\bPinterest\b/, 'Pinterest'],
  [/\bLine\//, 'LINE'],
  [/\bMicroMessenger\b/, 'WeChat'],
];

export function detectInAppBrowser(ua: string): InAppBrowser | null {
  if (!ua) return null;
  const ios = /\b(iPhone|iPad|iPod)\b/.test(ua);
  const android = /\bAndroid\b/.test(ua);
  const platform = ios ? 'ios' : android ? 'android' : 'other';

  for (const [re, app] of APP_MARKERS) {
    if (re.test(ua)) return { app, platform };
  }
  // Generic embedded views: Android WebView marks itself with "; wv)"; an iOS
  // WKWebView lacks the "Safari/" token that Safari, Chrome (CriOS), Firefox
  // (FxiOS) and Edge (EdgiOS) all send.
  if (android && /;\s*wv\)/.test(ua)) return { app: 'this app', platform };
  if (ios && /AppleWebKit/.test(ua) && !/\bSafari\//.test(ua)) return { app: 'this app', platform };
  return null;
}

// Best-effort link that asks the OS to reopen the page in the system browser.
// iOS 17+ honours x-safari-https:// from many WebViews; Android hands an
// intent:// URL to Chrome (falling back to the plain URL). Neither is
// guaranteed, so the dialog always offers "Copy link" too.
export function externalBrowserUrl(href: string, platform: InAppBrowser['platform']): string | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  if (platform === 'ios') return `x-safari-https://${url.host}${url.pathname}${url.search}${url.hash}`;
  if (platform === 'android') {
    const fallback = encodeURIComponent(url.href);
    // The fragment is dropped: "#" starts the Intent section of the URL.
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;S.browser_fallback_url=${fallback};end`;
  }
  return null;
}

function clerkOpenSignIn() {
  (window as any).Clerk?.openSignIn?.();
}

const DIALOG_ID = 'inapp-signin-dialog';
let closeActiveDialog: ((restoreFocus?: boolean) => void) | null = null;

function showInAppDialog(info: InAppBrowser) {
  // Close a previous dialog through its own close() so its keydown listener goes too.
  closeActiveDialog?.(false);

  const appName = info.app === 'this app' ? "this app's browser" : `${info.app}'s browser`;
  const browserName = info.platform === 'ios' ? 'Safari' : info.platform === 'android' ? 'Chrome' : 'your browser';
  const openUrl = externalBrowserUrl(window.location.href, info.platform);

  const overlay = document.createElement('div');
  overlay.id = DIALOG_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', `${DIALOG_ID}-title`);
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;' +
    'padding:16px;background:rgba(0,0,0,.6);';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;max-width:420px;margin-bottom:env(safe-area-inset-bottom);border-radius:12px;padding:20px;' +
    'background:var(--color-surface-1,#141413);border:1px solid var(--color-border,#2a2926);' +
    'color:var(--color-text-primary,#faf9f5);font-family:var(--font-sans,system-ui,sans-serif);' +
    'box-shadow:0 12px 40px rgba(0,0,0,.5);';

  const title = document.createElement('h2');
  title.id = `${DIALOG_ID}-title`;
  title.textContent = `Open aitmpl.com in ${browserName} to sign in`;
  title.style.cssText = 'margin:0 0 8px;font-size:16px;font-weight:600;line-height:1.3;';

  const body = document.createElement('p');
  body.textContent =
    `GitHub and Google sign-in don't work inside ${appName}. ` +
    `Open this page in ${browserName} and sign in there.` +
    (info.app === 'X' ? ' In X, tap the compass icon at the bottom right.' : '');
  body.style.cssText = 'margin:0 0 16px;font-size:14px;line-height:1.5;color:var(--color-text-secondary,#a3a197);';

  const btnBase =
    'display:block;width:100%;box-sizing:border-box;padding:11px 14px;border-radius:8px;font-size:14px;' +
    'font-weight:500;text-align:center;text-decoration:none;cursor:pointer;font-family:inherit;';
  const primary = btnBase + 'background:var(--color-accent,#d57455);color:#fff;border:0;margin-bottom:8px;';
  const secondary =
    btnBase + 'background:transparent;color:var(--color-text-primary,#faf9f5);' +
    'border:1px solid var(--color-border-strong,#3d3c38);margin-bottom:8px;';

  const actions = document.createElement('div');

  if (openUrl) {
    const open = document.createElement('a');
    open.href = openUrl;
    open.textContent = `Open in ${browserName}`;
    open.style.cssText = primary;
    actions.append(open);
  }

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy link';
  copy.style.cssText = openUrl ? secondary : primary;
  copy.addEventListener('click', async () => {
    const href = window.location.href;
    let ok = false;
    try { await navigator.clipboard.writeText(href); ok = true; } catch { /* fall through */ }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = href;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.append(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    copy.textContent = ok ? `Copied. Paste it in ${browserName}` : href;
  });
  actions.append(copy);

  const email = document.createElement('button');
  email.type = 'button';
  email.textContent = 'Sign in with email here';
  email.style.cssText =
    btnBase + 'background:transparent;border:0;color:var(--color-text-secondary,#a3a197);margin:0;';
  email.addEventListener('click', () => { close(false); clerkOpenSignIn(); });
  actions.append(email);

  card.append(title, body, actions);
  overlay.append(card);

  const prevFocus = document.activeElement as HTMLElement | null;
  function close(restoreFocus = true) {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (closeActiveDialog === close) closeActiveDialog = null;
    if (restoreFocus) prevFocus?.focus?.();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    // Keep Tab inside the dialog.
    const items = Array.from(actions.querySelectorAll<HTMLElement>('a,button'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !overlay.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !overlay.contains(active))) { e.preventDefault(); first.focus(); }
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey, true);
  closeActiveDialog = close;

  document.body.append(overlay);
  (actions.firstElementChild as HTMLElement | null)?.focus();
}

export function openSignIn() {
  if (typeof window === 'undefined') return;
  const info = detectInAppBrowser(navigator.userAgent || '');
  if (info) showInAppDialog(info);
  else clerkOpenSignIn();
}

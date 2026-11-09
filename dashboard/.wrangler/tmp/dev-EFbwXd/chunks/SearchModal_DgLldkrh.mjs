globalThis.process ??= {}; globalThis.process.env ??= {};
import { e as createAstro, f as createComponent, m as maybeRenderHead, k as renderComponent, h as addAttribute, r as renderTemplate, u as unescapeHTML, l as renderScript, q as renderSlot, p as renderHead } from './astro/server_OwOTC5bf.mjs';
import { N as NAV_LINKS, C as COMPONENTS_JSON_URL } from './constants_B4Q_yTN4.mjs';
import { a as reactExports, R as React6, b as requireReactDom } from './_@astro-renderers_BvXjVE0w.mjs';
/* empty css                          */

const SUPPORT_PROGRAMS = [
  {
    org: "NVIDIA",
    program: "NVIDIA Inception",
    kind: "Startup program",
    description: "NVIDIA's program for companies building with AI. Claude Code Templates was accepted in November 2026.",
    url: "https://www.nvidia.com/en-us/startups/",
    linkLabel: "nvidia.com/startups",
    // Official NVIDIA green, not recolored (NVIDIA brand guidelines).
    icon: "https://cdn.simpleicons.org/nvidia/76B900",
    footerLabel: "NVIDIA"
  },
  {
    org: "Z.ai",
    program: "Z.ai",
    kind: "Sponsor",
    description: "Z.ai, the team behind the GLM models, sponsored Claude Code Templates and helped keep it running.",
    url: "https://z.ai",
    linkLabel: "z.ai",
    // Official mark from z.ai (z-cdn.chatglm.cn/z-ai/static/logo.svg), vendored so the page doesn't hotlink it.
    icon: "/supporters/zai.svg"
  },
  {
    org: "Anthropic",
    program: "Claude for Open Source",
    kind: "Open source program",
    description: "Claude access for maintainers of open source projects, used to build and maintain the catalog.",
    url: "https://claude.com/contact-sales/claude-for-oss",
    linkLabel: "claude.com",
    icon: "https://cdn.simpleicons.org/anthropic/ffffff",
    monochrome: true,
    footerLabel: "Claude"
  },
  {
    org: "Anthropic",
    program: "Anthropic OSS Scanner",
    kind: "Security",
    description: "Anthropic's free scanner for open source projects. It scans this repository and reports findings privately so they can be fixed before disclosure.",
    url: "https://red.anthropic.com/oss-scanner",
    linkLabel: "red.anthropic.com",
    icon: "https://cdn.simpleicons.org/anthropic/ffffff",
    monochrome: true
  },
  {
    org: "Vercel",
    program: "Vercel Open Source Program",
    kind: "Open source program",
    description: "Hosting credits and support for open source projects.",
    url: "https://vercel.com/open-source-program",
    linkLabel: "vercel.com",
    icon: "https://cdn.simpleicons.org/vercel/ffffff",
    monochrome: true,
    footerLabel: "Vercel"
  },
  {
    org: "Neon",
    program: "Neon Open Source Program",
    kind: "Open source program",
    description: "Serverless Postgres for open source projects. Neon stores the release monitoring and collections data behind aitmpl.com.",
    url: "https://neon.tech/open-source",
    linkLabel: "neon.tech",
    icon: "https://neon.tech/favicon/favicon.svg",
    footerLabel: "Neon"
  }
];

const ICONS = {
  skills: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  agents: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><path d="M9 17h6"/><path d="M12 2v2"/><path d="M2 10h2"/><path d="M20 10h2"/></svg>`,
  commands: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  settings: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  hooks: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
  mcps: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1115.71 8h1.79a4.5 4.5 0 012.5 8.242"/><path d="M12 12v9"/><path d="M8 17l4 4 4-4"/></svg>`,
  loops: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-2.64-6.36"/><polyline points="21 3 21 8 16 8"/></svg>`,
  mods: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4H6a2 2 0 00-2 2v3c0 1.1-.9 2-2 2 1.1 0 2 .9 2 2v3a2 2 0 002 2h2"/><path d="M16 4h2a2 2 0 012 2v3c0 1.1.9 2 2 2-1.1 0-2 .9-2 2v3a2 2 0 01-2 2h-2"/><path d="M10 15l2-6 2 6"/></svg>`,
  plugins: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`
};
const TYPE_CONFIG = {
  skills: { icon: "skills", label: "Skills", singular: "skill", color: "#f59e0b", flag: "--skill" },
  agents: { icon: "agents", label: "Agents", singular: "agent", color: "#3b82f6", flag: "--agent" },
  commands: { icon: "commands", label: "Commands", singular: "command", color: "#10b981", flag: "--command" },
  settings: { icon: "settings", label: "Settings", singular: "setting", color: "#8b5cf6", flag: "--setting" },
  hooks: { icon: "hooks", label: "Hooks", singular: "hook", color: "#f97316", flag: "--hook" },
  mcps: { icon: "mcps", label: "MCPs", singular: "mcp", color: "#06b6d4", flag: "--mcp" },
  loops: { icon: "loops", label: "Loops", singular: "loop", color: "#ec4899", flag: "--loop", hidden: true },
  mods: { icon: "mods", label: "Mods", singular: "mod", color: "#a3e635", flag: "--mod" },
  // Catalog plugins are listed on /plugins (with the external marketplaces), not as a grid tab.
  plugins: { icon: "plugins", label: "Plugins", singular: "plugin", color: "#ffd93d", flag: "--plugin", hidden: true }
};
const VALID_TYPES = Object.keys(TYPE_CONFIG);

var jsxRuntime = {exports: {}};

var reactJsxRuntime_production = {};

/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hasRequiredReactJsxRuntime_production;

function requireReactJsxRuntime_production () {
	if (hasRequiredReactJsxRuntime_production) return reactJsxRuntime_production;
	hasRequiredReactJsxRuntime_production = 1;
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"),
	  REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
	function jsxProd(type, config, maybeKey) {
	  var key = null;
	  void 0 !== maybeKey && (key = "" + maybeKey);
	  void 0 !== config.key && (key = "" + config.key);
	  if ("key" in config) {
	    maybeKey = {};
	    for (var propName in config)
	      "key" !== propName && (maybeKey[propName] = config[propName]);
	  } else maybeKey = config;
	  config = maybeKey.ref;
	  return {
	    $$typeof: REACT_ELEMENT_TYPE,
	    type: type,
	    key: key,
	    ref: void 0 !== config ? config : null,
	    props: maybeKey
	  };
	}
	reactJsxRuntime_production.Fragment = REACT_FRAGMENT_TYPE;
	reactJsxRuntime_production.jsx = jsxProd;
	reactJsxRuntime_production.jsxs = jsxProd;
	return reactJsxRuntime_production;
}

var hasRequiredJsxRuntime;

function requireJsxRuntime () {
	if (hasRequiredJsxRuntime) return jsxRuntime.exports;
	hasRequiredJsxRuntime = 1;
	{
	  jsxRuntime.exports = requireReactJsxRuntime_production();
	}
	return jsxRuntime.exports;
}

var jsxRuntimeExports = requireJsxRuntime();

const PENDING_ACTION_KEY = "aitmpl:pending-action";
function sessionStore() {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
function setPendingAction(action, store = sessionStore(), now = Date.now()) {
  try {
    store?.setItem(PENDING_ACTION_KEY, JSON.stringify({ ...action, at: now }));
  } catch {
  }
}
function clearPendingAction(store = sessionStore()) {
  try {
    store?.removeItem(PENDING_ACTION_KEY);
  } catch {
  }
}

function pluralType$1(type) {
  if (!type) return "";
  return type.endsWith("s") ? type : `${type}s`;
}
function componentPath(type, path) {
  const clean = (path ?? "").replace(/\.(md|json)$/, "").replace(/^\/+|\/+$/g, "");
  return `/component/${pluralType$1(type)}/${clean}`;
}

const SAFE_STRING = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;
function cleanParams(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "string" && SAFE_STRING.test(value)) out[key] = value;
  }
  return out;
}
function componentRef(type, path) {
  const clean = String(path || "").replace(/\.(md|json)$/, "").replace(/^\/+|\/+$/g, "");
  return { component_type: pluralType$1(String(type || "")), component_path: clean };
}
function track(name, params) {
  if (typeof window === "undefined") return;
  const dataLayer = window.dataLayer;
  if (!Array.isArray(dataLayer)) return;
  const clean = cleanParams(params);
  (function gtag(..._args) {
    dataLayer.push(arguments);
  })("event", name, clean);
}
const PENDING_KEY = "aitmpl-sign-in-origin";
function rememberSignInOrigin(origin, now = Date.now()) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ origin, at: now }));
  } catch {
  }
}

const APP_MARKERS = [
  [/\bTwitter\b|\bTwitterAndroid\b/i, "X"],
  [/\bFBAN\/|\bFBAV\/|\bFB_IAB\b|\bFBIOS\b/, "Facebook"],
  [/\bInstagram\b/, "Instagram"],
  [/\bThreads\b/, "Threads"],
  [/\bLinkedInApp\b/, "LinkedIn"],
  [/\bmusical_ly|\bBytedanceWebview\b|\bTikTok\b/i, "TikTok"],
  [/\bSnapchat\b/, "Snapchat"],
  [/\bPinterest\b/, "Pinterest"],
  [/\bLine\//, "LINE"],
  [/\bMicroMessenger\b/, "WeChat"]
];
function detectInAppBrowser(ua) {
  if (!ua) return null;
  const ios = /\b(iPhone|iPad|iPod)\b/.test(ua);
  const android = /\bAndroid\b/.test(ua);
  const platform = ios ? "ios" : android ? "android" : "other";
  for (const [re, app] of APP_MARKERS) {
    if (re.test(ua)) return { app, platform };
  }
  if (android && /;\s*wv\)/.test(ua)) return { app: "this app", platform };
  if (ios && /AppleWebKit/.test(ua) && !/\bSafari\//.test(ua)) return { app: "this app", platform };
  if (/\bMacintosh\b/.test(ua) && /AppleWebKit/.test(ua) && !/\bSafari\//.test(ua)) return { app: "this app", platform: "other" };
  return null;
}
function externalBrowserUrl(href, platform) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (platform === "ios") return `x-safari-https://${url.host}${url.pathname}${url.search}${url.hash}`;
  if (platform === "android") {
    const fallback = encodeURIComponent(url.href);
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;S.browser_fallback_url=${fallback};end`;
  }
  return null;
}
function clerkOpenSignIn(emailOnly = false) {
  const props = emailOnly ? { appearance: { elements: { socialButtonsRoot: { display: "none" }, dividerRow: { display: "none" } } } } : void 0;
  window.Clerk?.openSignIn?.(props);
}
const DIALOG_ID = "inapp-signin-dialog";
let closeActiveDialog = null;
function showInAppDialog(info) {
  closeActiveDialog?.(false);
  const appName = info.app === "this app" ? "this app's browser" : `${info.app}'s browser`;
  const browserName = info.platform === "ios" ? "Safari" : info.platform === "android" ? "Chrome" : "your browser";
  const openUrl = externalBrowserUrl(window.location.href, info.platform);
  const overlay = document.createElement("div");
  overlay.id = DIALOG_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", `${DIALOG_ID}-title`);
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,.6);";
  const card = document.createElement("div");
  card.style.cssText = "width:100%;max-width:420px;margin-bottom:env(safe-area-inset-bottom);border-radius:12px;padding:20px;background:var(--color-surface-1,#141413);border:1px solid var(--color-border,#2a2926);color:var(--color-text-primary,#faf9f5);font-family:var(--font-sans,system-ui,sans-serif);box-shadow:0 12px 40px rgba(0,0,0,.5);";
  const title = document.createElement("h2");
  title.id = `${DIALOG_ID}-title`;
  title.textContent = `Open aitmpl.com in ${browserName} to sign in`;
  title.style.cssText = "margin:0 0 8px;font-size:16px;font-weight:600;line-height:1.3;";
  const body = document.createElement("p");
  body.textContent = `GitHub and Google sign-in don't work inside ${appName}. Open this page in ${browserName} and sign in there.` + (info.app === "X" ? " In X, tap the compass icon at the bottom right." : "");
  body.style.cssText = "margin:0 0 16px;font-size:14px;line-height:1.5;color:var(--color-text-secondary,#c3c1b7);";
  const btnBase = "display:block;width:100%;box-sizing:border-box;padding:11px 14px;border-radius:8px;font-size:14px;font-weight:500;text-align:center;text-decoration:none;cursor:pointer;font-family:inherit;";
  const primary = btnBase + "background:var(--color-accent,#d57455);color:#fff;border:0;margin-bottom:8px;";
  const secondary = btnBase + "background:transparent;color:var(--color-text-primary,#faf9f5);border:1px solid var(--color-border-strong,#3d3c38);margin-bottom:8px;";
  const actions = document.createElement("div");
  if (openUrl) {
    const open = document.createElement("a");
    open.href = openUrl;
    open.textContent = `Open in ${browserName}`;
    open.style.cssText = primary;
    actions.append(open);
  }
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy link";
  copy.style.cssText = openUrl ? secondary : primary;
  copy.addEventListener("click", async () => {
    const href = window.location.href;
    let ok = false;
    try {
      await navigator.clipboard.writeText(href);
      ok = true;
    } catch {
    }
    if (!ok) {
      const ta = document.createElement("textarea");
      ta.value = href;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.append(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    copy.textContent = ok ? `Copied. Paste it in ${browserName}` : href;
  });
  actions.append(copy);
  const email = document.createElement("button");
  email.type = "button";
  email.textContent = "Use email and password here";
  email.style.cssText = btnBase + "background:transparent;border:0;color:var(--color-text-secondary,#c3c1b7);margin:0;";
  email.addEventListener("click", () => {
    close(false);
    clerkOpenSignIn(true);
  });
  actions.append(email);
  card.append(title, body, actions);
  overlay.append(card);
  const prevFocus = document.activeElement;
  function close(restoreFocus = true) {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
    if (closeActiveDialog === close) closeActiveDialog = null;
    if (restoreFocus) prevFocus?.focus?.();
  }
  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(actions.querySelectorAll("a,button"));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !overlay.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !overlay.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey, true);
  closeActiveDialog = close;
  document.body.append(overlay);
  actions.firstElementChild?.focus();
}
function signInOrigin(target) {
  if (typeof target === "string") return target;
  return target.kind === "save" ? "save" : target.source;
}
function openSignIn(target) {
  if (typeof window === "undefined") return;
  if (target && typeof target === "object") setPendingAction(target);
  else clearPendingAction();
  if (target) {
    const origin = signInOrigin(target);
    track("sign_in_open", { origin });
    rememberSignInOrigin(origin);
  }
  const info = detectInAppBrowser(navigator.userAgent || "");
  if (info) showInAppDialog(info);
  else clerkOpenSignIn();
}

const MOCK_USER = {
  fullName: "Bitreon",
  firstName: "Bitreon",
  imageUrl: "https://avatars.githubusercontent.com/u/207326426?v=4"
};
function useGlobalAuth$1() {
  const [state, setState] = reactExports.useState({
    isSignedIn: false,
    isLoaded: false,
    user: null
  });
  const [mockEnabled, setMockEnabled] = reactExports.useState(false);
  reactExports.useEffect(() => {
    window.enableAuthMock = () => {
      window.__authMockEnabled = true;
      setMockEnabled(true);
      console.log("✅ Auth mock mode enabled! Showing mock user:", MOCK_USER.fullName);
    };
    window.disableAuthMock = () => {
      window.__authMockEnabled = false;
      setMockEnabled(false);
      console.log("❌ Auth mock mode disabled");
    };
    if (window.__authMockEnabled) {
      setMockEnabled(true);
    }
    function check() {
      const isVercel = window.location.hostname.includes("vercel.app") || window.location.hostname.includes("claude.ai");
      if (window.__authMockEnabled && !isVercel) {
        setState({
          isSignedIn: true,
          isLoaded: true,
          user: MOCK_USER
        });
        return;
      }
      const clerk = window.Clerk;
      if (clerk?.loaded) {
        setState({
          isSignedIn: !!clerk.user,
          isLoaded: true,
          user: clerk.user ? {
            fullName: clerk.user.fullName,
            firstName: clerk.user.firstName,
            imageUrl: clerk.user.imageUrl,
            email: clerk.user.primaryEmailAddress?.emailAddress || ""
          } : null
        });
      }
    }
    check();
    const interval = setInterval(check, 500);
    const handleChange = () => check();
    window.addEventListener("clerk:session", handleChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("clerk:session", handleChange);
    };
  }, [mockEnabled]);
  return state;
}
function UserMenu({ user }) {
  const [open, setOpen] = reactExports.useState(false);
  const ref = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  const displayName = user.fullName || user.firstName || "User";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref, className: "relative", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => setOpen(!open),
        className: "flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors w-full",
        children: [
          user.imageUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "img",
            {
              src: user.imageUrl,
              alt: displayName,
              className: "w-6 h-6 rounded-full shrink-0 ring-2 ring-orange-500"
            }
          ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0 text-[11px] font-bold text-white ring-2 ring-orange-500", children: displayName.charAt(0).toUpperCase() }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate flex-1 text-left", children: displayName })
        ]
      }
    ),
    open && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "fixed bottom-4 left-4 w-56 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg shadow-xl z-[9999] py-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-3 py-2 border-b border-[var(--color-border)]", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[13px] font-medium text-[var(--color-text-primary)] truncate", children: displayName }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[11px] text-[var(--color-text-secondary)] truncate", children: user.email || "" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "py-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            onClick: () => {
              console.log("Navigate to My Components");
              window.location.href = "/my-components";
              setOpen(false);
            },
            className: "flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" }) }),
              "My Components"
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            onClick: () => {
              console.log("Navigate to Settings");
              window.location.href = "/settings";
              setOpen(false);
            },
            className: "flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "w-3.5 h-3.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
              ] }),
              "Settings"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-t border-[var(--color-border)] my-1" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "py-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => {
            const isVercel = window.location.hostname.includes("vercel.app") || window.location.hostname.includes("claude.ai");
            if (window.__authMockEnabled && !isVercel) {
              console.log("🔓 Mock sign out - disabling mock mode");
              window.disableAuthMock?.();
            } else {
              window.Clerk?.signOut?.();
            }
            setOpen(false);
          },
          className: "flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" }) }),
            "Sign Out"
          ]
        }
      ) })
    ] })
  ] });
}
function AuthButton() {
  const { isSignedIn, isLoaded, user } = useGlobalAuth$1();
  if (!isLoaded) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5 px-2.5 py-[6px]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-6 h-6 rounded-full bg-[var(--color-surface-3)] animate-pulse" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-3 w-16 bg-[var(--color-surface-3)] rounded animate-pulse" })
    ] });
  }
  if (isSignedIn && user) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(UserMenu, { user });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "button",
    {
      onClick: () => openSignIn("sidebar"),
      className: "flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors w-full",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4 shrink-0", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Sign In" })
      ]
    }
  );
}

function useGlobalAuth() {
  const [state, setState] = reactExports.useState({ isSignedIn: false, isLoaded: false });
  reactExports.useEffect(() => {
    function check() {
      const clerk = window.Clerk;
      if (clerk?.loaded) {
        setState({ isSignedIn: !!clerk.user, isLoaded: true });
      }
    }
    check();
    const interval = setInterval(check, 500);
    const handleChange = () => check();
    window.addEventListener("clerk:session", handleChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("clerk:session", handleChange);
    };
  }, []);
  return state;
}
function NavContent({ isActive }) {
  const { isSignedIn, isLoaded } = useGlobalAuth();
  if (!isLoaded) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 px-3 py-2 rounded-lg", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-[18px] h-[18px] flex items-center justify-center shrink-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-[18px] h-[18px] rounded bg-[var(--color-surface-3)] animate-pulse" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "sidebar-text w-24 h-3.5 rounded bg-[var(--color-surface-3)] animate-pulse" })
    ] });
  }
  const icon = /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-[18px] h-[18px] flex-shrink-0", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" }) });
  if (isSignedIn) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "a",
      {
        href: "/my-components",
        "data-tooltip": "My Components",
        className: `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 group ${isActive ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium shadow-sm" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm"}`,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `w-[18px] h-[18px] shrink-0 flex items-center justify-center transition-all duration-150 ${isActive ? "text-[var(--color-text-primary)] scale-105" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:scale-105"}`, children: icon }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sidebar-text truncate transition-all duration-300", children: "My Components" })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "button",
    {
      onClick: () => openSignIn("sidebar"),
      "data-tooltip": "My Components",
      className: "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm transition-all duration-150 group w-full text-left",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "w-[18px] h-[18px] shrink-0 flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-all duration-150 group-hover:scale-105", children: icon }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sidebar-text truncate transition-all duration-300", children: "My Components" })
      ]
    }
  );
}
function MyComponentsSidebarItem({ isActive = false }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(NavContent, { isActive });
}

const $$Astro$1 = createAstro("https://www.aitmpl.com");
const $$Sidebar = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Sidebar;
  const currentPath = Astro2.url.pathname;
  function isActive(path) {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  }
  return renderTemplate`${maybeRenderHead()}<div class="flex flex-col h-full bg-[var(--color-surface-0)] relative"> <!-- Logo --> <div class="px-4 py-4 border-b border-[var(--color-border)] flex items-center justify-between min-h-[65px] transition-all duration-300 bg-[var(--color-surface-0)]"> <a href="/" class="flex items-center gap-2.5 group min-w-0 overflow-hidden transition-all duration-300"> <svg class="w-8 h-8 shrink-0 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 32 32" aria-hidden="true"> <rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="var(--color-surface-2)" stroke="var(--color-border-strong)"></rect> <g fill="var(--color-text-primary)"> <rect x="7" y="7" width="8" height="8" rx="1.6"></rect> <rect x="17" y="17" width="8" height="8" rx="1.6"></rect> <rect x="7" y="17" width="8" height="8" rx="1.6"></rect> </g> <rect x="18" y="8" width="6" height="6" rx="1.2" fill="none" stroke="var(--color-text-primary)" stroke-width="2"></rect> </svg> <span class="sidebar-text text-[14px] font-bold text-[var(--color-text-primary)] tracking-tight whitespace-nowrap transition-all duration-300">AI Templates</span> </a> <button id="sidebar-toggle" class="hidden md:flex shrink-0 w-8 h-8 items-center justify-center rounded-lg hover:bg-[var(--color-surface-2)] transition-all duration-200 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] active:scale-95 hover:rotate-180" aria-label="Toggle sidebar" title="Collapse sidebar"> <svg class="w-4 h-4 transition-transform duration-300 ease-in-out" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path> </svg> </button> <button id="mobile-sidebar-close" class="md:hidden shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-2)] transition-all duration-200 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] active:scale-95" onclick="window.toggleSidebar && window.toggleSidebar()" aria-label="Close menu"> <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path> </svg> </button> </div> <!-- Navigation --> <nav class="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1 scrollbar-thin scrollbar-thumb-[var(--color-surface-3)] scrollbar-track-transparent transition-all duration-300"> <!-- Workplace section --> <div class="px-2 pt-1 pb-2 overflow-hidden"> <span class="sidebar-text font-ui-mono text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.1em] select-none transition-all duration-300 block">Workplace</span> </div> <!-- My Components (React island) --> ${renderComponent($$result, "MyComponentsSidebarItem", MyComponentsSidebarItem, { "client:load": true, "isActive": isActive("/my-components"), "client:component-hydration": "load", "client:component-path": "/home/user/claude-code-templates/dashboard/src/components/MyComponentsSidebarItem", "client:component-export": "default" })} <!-- Divider --> <div class="my-4 mx-2 border-t border-[var(--color-border)] opacity-60"></div> <!-- Browse section --> <div class="px-2 pt-1 pb-2 overflow-hidden"> <span class="sidebar-text font-ui-mono text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.1em] select-none transition-all duration-300 block">Browse</span> </div> ${Object.entries(TYPE_CONFIG).filter(([, config]) => !config.hidden).map(([type, config]) => renderTemplate`<a${addAttribute(`/${type}`, "href")}${addAttribute(type, "data-nav-type")}${addAttribute(config.label, "data-tooltip")}${addAttribute([
    "sidebar-nav-link flex items-center gap-3 px-3 py-2 rounded text-[13px] transition-all duration-150 group relative overflow-hidden font-ui-mono",
    isActive(`/${type}`) ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]/40" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] border border-transparent hover:border-[var(--color-border)]"
  ], "class:list")}> ${isActive(`/${type}`) && renderTemplate`<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-full"></span>`} <span class="sidebar-nav-icon w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center"> <span${addAttribute([
    "w-full h-full inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:flex-shrink-0 [&>svg]:block [&>svg]:m-auto transition-all duration-200",
    isActive(`/${type}`) ? "text-[var(--color-accent)] scale-110" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:scale-105"
  ], "class:list")}>${unescapeHTML(ICONS[type])}</span> </span> <span class="sidebar-text truncate transition-all duration-300">${config.label}</span> <span class="sidebar-nav-count font-ui-mono ml-auto text-[11px] font-semibold tabular-nums text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-0.5 rounded min-w-[24px] text-center transition-all duration-300 group-hover:bg-[var(--color-surface-3)]"${addAttribute(type, "data-count-type")}></span> </a>`)} <!-- Plugins (external marketplaces) --> <a href="/plugins" data-nav-type="plugins" data-tooltip="Plugins"${addAttribute([
    "sidebar-nav-link flex items-center gap-3 px-3 py-2 rounded text-[13px] transition-all duration-150 group relative overflow-hidden font-ui-mono",
    isActive("/plugins") ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]/40" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] border border-transparent hover:border-[var(--color-border)]"
  ], "class:list")}> ${isActive("/plugins") && renderTemplate`<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-full"></span>`} <span class="sidebar-nav-icon w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center"> <span${addAttribute([
    "w-full h-full inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:flex-shrink-0 [&>svg]:block [&>svg]:m-auto transition-all duration-200",
    isActive("/plugins") ? "text-[var(--color-accent)] scale-110" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:scale-105"
  ], "class:list")}> <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"> <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"></path> </svg> </span> </span> <span class="sidebar-text truncate transition-all duration-300">Plugins</span> <span class="sidebar-nav-count font-ui-mono ml-auto text-[11px] font-semibold tabular-nums text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-0.5 rounded min-w-[24px] text-center transition-all duration-300 group-hover:bg-[var(--color-surface-3)]" data-count-type="plugins"></span> </a> <!-- Divider --> <div class="my-4 mx-2 border-t border-[var(--color-border)] opacity-60"></div> <!-- Resources --> <div class="px-2 pt-1 pb-2 overflow-hidden"> <span class="sidebar-text font-ui-mono text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.1em] select-none transition-all duration-300 block">Resources</span> </div> <a href="/trending" data-tooltip="Trending"${addAttribute([
    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group overflow-hidden",
    isActive("/trending") ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium shadow-sm" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm"
  ], "class:list")}> <span${addAttribute([
    "w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center transition-all duration-200",
    isActive("/trending") ? "text-[var(--color-text-primary)] scale-105" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:scale-105"
  ], "class:list")}> <svg class="w-full h-full flex-shrink-0 block m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"> <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline> </svg> </span> <span class="sidebar-text transition-all duration-300">Trending</span> </a> <a href="/jobs" data-tooltip="Jobs"${addAttribute([
    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group overflow-hidden",
    isActive("/jobs") ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium shadow-sm" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm"
  ], "class:list")}> <span${addAttribute([
    "w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center transition-all duration-200",
    isActive("/jobs") ? "text-[var(--color-text-primary)] scale-105" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:scale-105"
  ], "class:list")}> <svg class="w-full h-full flex-shrink-0 block m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"></path><line x1="12" y1="12" x2="12" y2="12.01"></line> </svg> </span> <span class="sidebar-text transition-all duration-300">Jobs</span> </a> <a href="/certifications" data-tooltip="Certifications"${addAttribute([
    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group overflow-hidden",
    isActive("/certifications") ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium shadow-sm" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm"
  ], "class:list")}> <span${addAttribute([
    "w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center transition-all duration-200",
    isActive("/certifications") ? "text-[var(--color-text-primary)] scale-105" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:scale-105"
  ], "class:list")}> <svg class="w-full h-full flex-shrink-0 block m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="9" r="6"></circle><path d="M8.5 13.9 7 22l5-3 5 3-1.5-8.1"></path> </svg> </span> <span class="sidebar-text transition-all duration-300">Certifications</span> <span class="sidebar-text ml-auto text-[9px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded-md shadow-sm transition-all duration-300">New</span> </a> <a href="/supporters" data-tooltip="Supporters"${addAttribute([
    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group overflow-hidden",
    isActive("/supporters") ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium shadow-sm" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm"
  ], "class:list")}> <span${addAttribute([
    "w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center transition-all duration-200",
    isActive("/supporters") ? "text-[var(--color-text-primary)] scale-105" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:scale-105"
  ], "class:list")}> <svg class="w-full h-full flex-shrink-0 block m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"> <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"></path> </svg> </span> <span class="sidebar-text transition-all duration-300">Supporters</span> </a> <a${addAttribute(NAV_LINKS.blog, "href")} target="_blank" rel="noopener noreferrer" data-tooltip="Blog" class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm transition-all duration-200 group overflow-hidden"> <span class="w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-all duration-200 group-hover:scale-105"> <svg class="w-full h-full flex-shrink-0 block m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"> <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20"></path> </svg> </span> <span class="sidebar-text transition-all duration-300">Blog</span> <svg class="sidebar-text w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg> </a> <a${addAttribute(NAV_LINKS.docs, "href")} target="_blank" rel="noopener noreferrer" data-tooltip="Docs" class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm transition-all duration-150 group"> <span class="w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-transform duration-150 group-hover:scale-105"> <svg class="w-full h-full flex-shrink-0 block m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"> <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline> </svg> </span> <span class="sidebar-text transition-all duration-300">Docs</span> <svg class="sidebar-text w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg> </a> <a${addAttribute(NAV_LINKS.github, "href")} target="_blank" rel="noopener noreferrer" data-tooltip="GitHub" class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm transition-all duration-200 group overflow-hidden"> <span class="w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-all duration-200 group-hover:scale-105"> <svg class="w-full h-full flex-shrink-0 block m-auto" viewBox="0 0 24 24" fill="currentColor"> <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path> </svg> </span> <span class="sidebar-text transition-all duration-300">GitHub</span> <svg class="sidebar-text w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg> </a> </nav> <!-- Bottom --> <div class="px-3 py-3 border-t border-[var(--color-border)] space-y-2.5 bg-[var(--color-surface-0)] overflow-hidden"> ${renderComponent($$result, "AuthButton", AuthButton, { "client:idle": true, "client:component-hydration": "idle", "client:component-path": "/home/user/claude-code-templates/dashboard/src/components/AuthButton", "client:component-export": "default" })} </div> </div> ${renderScript($$result, "/home/user/claude-code-templates/dashboard/src/components/Sidebar.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/user/claude-code-templates/dashboard/src/components/Sidebar.astro", void 0);

//#region src/errors/createErrorTypeGuard.ts
/**
* Creates a type guard function for any error class.
* The returned function can be called as a standalone function or as a method on an error object.
*
* @example
* ```typescript
* class MyError extends Error {}
* const isMyError = createErrorTypeGuard(MyError);
*
* // As a standalone function
* if (isMyError(error)) { ... }
*
* // As a method (when attached to error object)
* if (error.isMyError()) { ... }
* ```
*/

//#endregion
//#region src/errors/clerkError.ts
var ClerkError = class ClerkError extends Error {
	static kind = "ClerkError";
	clerkError = true;
	code;
	longMessage;
	docsUrl;
	cause;
	get name() {
		return this.constructor.name;
	}
	constructor(opts) {
		super(new.target.formatMessage(new.target.kind, opts.message, opts.code, opts.docsUrl), { cause: opts.cause });
		Object.setPrototypeOf(this, ClerkError.prototype);
		this.code = opts.code;
		this.docsUrl = opts.docsUrl;
		this.longMessage = opts.longMessage;
		this.cause = opts.cause;
	}
	toString() {
		return `[${this.name}]\nMessage:${this.message}`;
	}
	static formatMessage(name, msg, code, docsUrl) {
		const prefix = "Clerk:";
		const regex = new RegExp(prefix.replace(" ", "\\s*"), "i");
		msg = msg.replace(regex, "");
		msg = `${prefix} ${msg.trim()}\n\n(code="${code}")\n\n`;
		if (docsUrl) msg += `\n\nDocs: ${docsUrl}`;
		return msg;
	}
};

//#endregion
//#region src/errors/errorThrower.ts
const DefaultMessages = Object.freeze({
	InvalidProxyUrlErrorMessage: `The proxyUrl passed to Clerk is invalid. The expected value for proxyUrl is an absolute URL or a relative path with a leading '/'. (key={{url}})`,
	InvalidPublishableKeyErrorMessage: `The publishableKey passed to Clerk is invalid. You can get your Publishable key at https://dashboard.clerk.com/last-active?path=api-keys. (key={{key}})`,
	MissingPublishableKeyErrorMessage: `Missing publishableKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
	MissingSecretKeyErrorMessage: `Missing secretKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
	MissingClerkProvider: `{{source}} can only be used within the <ClerkProvider /> component. Learn more: https://clerk.com/docs/components/clerk-provider`
});
/**
* Builds an error thrower.
*
* @internal
*/
function buildErrorThrower({ packageName, customMessages }) {
	let pkg = packageName;
	/**
	* Builds a message from a raw message and replacements.
	*
	* @internal
	*/
	function buildMessage(rawMessage, replacements) {
		if (!replacements) return `${pkg}: ${rawMessage}`;
		let msg = rawMessage;
		const matches = rawMessage.matchAll(/{{([a-zA-Z0-9-_]+)}}/g);
		for (const match of matches) {
			const replacement = (replacements[match[1]] || "").toString();
			msg = msg.replace(`{{${match[1]}}}`, replacement);
		}
		return `${pkg}: ${msg}`;
	}
	const messages = {
		...DefaultMessages,
		...customMessages
	};
	return {
		setPackageName({ packageName: packageName$1 }) {
			if (typeof packageName$1 === "string") pkg = packageName$1;
			return this;
		},
		setMessages({ customMessages: customMessages$1 }) {
			Object.assign(messages, customMessages$1 || {});
			return this;
		},
		throwInvalidPublishableKeyError(params) {
			throw new Error(buildMessage(messages.InvalidPublishableKeyErrorMessage, params));
		},
		throwInvalidProxyUrl(params) {
			throw new Error(buildMessage(messages.InvalidProxyUrlErrorMessage, params));
		},
		throwMissingPublishableKeyError() {
			throw new Error(buildMessage(messages.MissingPublishableKeyErrorMessage));
		},
		throwMissingSecretKeyError() {
			throw new Error(buildMessage(messages.MissingSecretKeyErrorMessage));
		},
		throwMissingClerkProviderError(params) {
			throw new Error(buildMessage(messages.MissingClerkProvider, params));
		},
		throw(message) {
			throw new Error(buildMessage(message));
		}
	};
}

//#endregion
//#region src/errors/clerkRuntimeError.ts
/**
* Custom error class for representing Clerk runtime errors.
*
* @class ClerkRuntimeError
*
* @example
*   throw new ClerkRuntimeError('An error occurred', { code: 'password_invalid' });
*/
var ClerkRuntimeError = class ClerkRuntimeError extends ClerkError {
	static kind = "ClerkRuntimeError";
	/**
	* @deprecated Use `clerkError` property instead. This property is maintained for backward compatibility.
	*/
	clerkRuntimeError = true;
	constructor(message, options) {
		super({
			...options,
			message
		});
		Object.setPrototypeOf(this, ClerkRuntimeError.prototype);
	}
};

//#region src/constants.ts
const DEV_OR_STAGING_SUFFIXES = [
	".lcl.dev",
	".stg.dev",
	".lclstage.dev",
	".stgstage.dev",
	".dev.lclclerk.com",
	".stg.lclclerk.com",
	".accounts.lclclerk.com",
	"accountsstage.dev",
	"accounts.dev"
];

//#region src/isomorphicAtob.ts
/**
* A function that decodes a string of data which has been encoded using base-64 encoding.
* Uses `atob` if available, otherwise uses `Buffer` from `global`. If neither are available, returns the data as-is.
*/
const isomorphicAtob = (data) => {
	if (typeof atob !== "undefined" && typeof atob === "function") return atob(data);
	else if (typeof global !== "undefined" && global.Buffer) return new global.Buffer(data, "base64").toString();
	return data;
};

//#region src/keys.ts
/** Prefix used for production publishable keys */
const PUBLISHABLE_KEY_LIVE_PREFIX = "pk_live_";
/** Prefix used for development publishable keys */
const PUBLISHABLE_KEY_TEST_PREFIX = "pk_test_";
/**
* Validates that a decoded publishable key has the correct format.
* The decoded value should be a frontend API followed by exactly one '$' at the end.
*
* @param decoded - The decoded publishable key string to validate.
* @returns `true` if the decoded key has valid format, `false` otherwise.
*/
function isValidDecodedPublishableKey(decoded) {
	if (!decoded.endsWith("$")) return false;
	const withoutTrailing = decoded.slice(0, -1);
	if (withoutTrailing.includes("$")) return false;
	return withoutTrailing.includes(".");
}
/**
* Parses and validates a publishable key, extracting the frontend API and instance type.
*
* @param key - The publishable key to parse.
* @param options - Configuration options for parsing.
* @param options.fatal
* @param options.domain
* @param options.proxyUrl
* @param options.isSatellite
* @returns Parsed publishable key object with instanceType and frontendApi, or null if invalid.
*
* @throws {Error} When options.fatal is true and key is missing or invalid.
*/
function parsePublishableKey(key, options = {}) {
	key = key || "";
	if (!key || !isPublishableKey(key)) {
		if (options.fatal && !key) throw new Error("Publishable key is missing. Ensure that your publishable key is correctly configured. Double-check your environment configuration for your keys, or access them here: https://dashboard.clerk.com/last-active?path=api-keys");
		if (options.fatal && !isPublishableKey(key)) throw new Error("Publishable key not valid.");
		return null;
	}
	const instanceType = key.startsWith(PUBLISHABLE_KEY_LIVE_PREFIX) ? "production" : "development";
	let decodedFrontendApi;
	try {
		decodedFrontendApi = isomorphicAtob(key.split("_")[2]);
	} catch {
		if (options.fatal) throw new Error("Publishable key not valid: Failed to decode key.");
		return null;
	}
	if (!isValidDecodedPublishableKey(decodedFrontendApi)) {
		if (options.fatal) throw new Error("Publishable key not valid: Decoded key has invalid format.");
		return null;
	}
	let frontendApi = decodedFrontendApi.slice(0, -1);
	if (options.proxyUrl) frontendApi = options.proxyUrl;
	else if (instanceType !== "development" && options.domain && options.isSatellite) frontendApi = `clerk.${options.domain}`;
	return {
		instanceType,
		frontendApi
	};
}
/**
* Checks if the provided key is a valid publishable key.
*
* @param key - The key to be checked. Defaults to an empty string if not provided.
* @returns `true` if 'key' is a valid publishable key, `false` otherwise.
*/
function isPublishableKey(key = "") {
	try {
		if (!(key.startsWith(PUBLISHABLE_KEY_LIVE_PREFIX) || key.startsWith(PUBLISHABLE_KEY_TEST_PREFIX))) return false;
		const parts = key.split("_");
		if (parts.length !== 3) return false;
		const encodedPart = parts[2];
		if (!encodedPart) return false;
		return isValidDecodedPublishableKey(isomorphicAtob(encodedPart));
	} catch {
		return false;
	}
}
/**
* Creates a memoized cache for checking if URLs are development or staging environments.
* Uses a Map to cache results for better performance on repeated checks.
*
* @returns An object with an isDevOrStagingUrl method that checks if a URL is dev/staging.
*/
function createDevOrStagingUrlCache() {
	const devOrStagingUrlCache = /* @__PURE__ */ new Map();
	return { isDevOrStagingUrl: (url) => {
		if (!url) return false;
		const hostname = typeof url === "string" ? url : url.hostname;
		let res = devOrStagingUrlCache.get(hostname);
		if (res === void 0) {
			res = DEV_OR_STAGING_SUFFIXES.some((s) => hostname.endsWith(s));
			devOrStagingUrlCache.set(hostname, res);
		}
		return res;
	} };
}

var has = Object.prototype.hasOwnProperty;

function find(iter, tar, key) {
	for (key of iter.keys()) {
		if (dequal(key, tar)) return key;
	}
}

function dequal(foo, bar) {
	var ctor, len, tmp;
	if (foo === bar) return true;

	if (foo && bar && (ctor=foo.constructor) === bar.constructor) {
		if (ctor === Date) return foo.getTime() === bar.getTime();
		if (ctor === RegExp) return foo.toString() === bar.toString();

		if (ctor === Array) {
			if ((len=foo.length) === bar.length) {
				while (len-- && dequal(foo[len], bar[len]));
			}
			return len === -1;
		}

		if (ctor === Set) {
			if (foo.size !== bar.size) {
				return false;
			}
			for (len of foo) {
				tmp = len;
				if (tmp && typeof tmp === 'object') {
					tmp = find(bar, tmp);
					if (!tmp) return false;
				}
				if (!bar.has(tmp)) return false;
			}
			return true;
		}

		if (ctor === Map) {
			if (foo.size !== bar.size) {
				return false;
			}
			for (len of foo) {
				tmp = len[0];
				if (tmp && typeof tmp === 'object') {
					tmp = find(bar, tmp);
					if (!tmp) return false;
				}
				if (!dequal(len[1], bar.get(tmp))) {
					return false;
				}
			}
			return true;
		}

		if (ctor === ArrayBuffer) {
			foo = new Uint8Array(foo);
			bar = new Uint8Array(bar);
		} else if (ctor === DataView) {
			if ((len=foo.byteLength) === bar.byteLength) {
				while (len-- && foo.getInt8(len) === bar.getInt8(len));
			}
			return len === -1;
		}

		if (ArrayBuffer.isView(foo)) {
			if ((len=foo.byteLength) === bar.byteLength) {
				while (len-- && foo[len] === bar[len]);
			}
			return len === -1;
		}

		if (!ctor || typeof foo === 'object') {
			len = 0;
			for (ctor in foo) {
				if (has.call(foo, ctor) && ++len && !has.call(bar, ctor)) return false;
				if (!(ctor in bar) || !dequal(foo[ctor], bar[ctor])) return false;
			}
			return Object.keys(bar).length === len;
		}
	}

	return foo !== foo && bar !== bar;
}

//#region src/react/hooks/createContextAndHook.ts
/**
* Assert that the context value exists, otherwise throw an error.
*
* @internal
*/
function assertContextExists(contextVal, msgOrCtx) {
	if (!contextVal) throw typeof msgOrCtx === "string" ? new Error(msgOrCtx) : /* @__PURE__ */ new Error(`${msgOrCtx.displayName} not found`);
}
/**
* Create and return a Context and two hooks that return the context value.
* The Context type is derived from the type passed in by the user.
*
* The first hook returned guarantees that the context exists so the returned value is always `CtxValue`
* The second hook makes no guarantees, so the returned value can be `CtxValue | undefined`
*
* @internal
*/
const createContextAndHook = (displayName, options) => {
	const { assertCtxFn = assertContextExists } = {};
	const Ctx = React6.createContext(void 0);
	Ctx.displayName = displayName;
	const useCtx = () => {
		const ctx = React6.useContext(Ctx);
		assertCtxFn(ctx, `${displayName} not found`);
		return ctx.value;
	};
	const useCtxWithoutGuarantee = () => {
		const ctx = React6.useContext(Ctx);
		return ctx ? ctx.value : {};
	};
	return [
		Ctx,
		useCtx,
		useCtxWithoutGuarantee
	];
};

//#endregion
//#region src/react/contexts.tsx
const [ClerkInstanceContext, useClerkInstanceContext] = createContextAndHook("ClerkInstanceContext");
createContextAndHook("UserContext");
createContextAndHook("ClientContext");
createContextAndHook("SessionContext");
React6.createContext({});
createContextAndHook("CheckoutContext");
createContextAndHook("OrganizationContext");
/**
* @internal
*/
function useAssertWrappedByClerkProvider$1(displayNameOrFn) {
	if (!React6.useContext(ClerkInstanceContext)) {
		if (typeof displayNameOrFn === "function") {
			displayNameOrFn();
			return;
		}
		throw new Error(`${displayNameOrFn} can only be used within the <ClerkProvider /> component.

Possible fixes:
1. Ensure that the <ClerkProvider /> is correctly wrapping your application where this component is used.
2. Check for multiple versions of the \`@clerk/shared\` package in your project. Use a tool like \`npm ls @clerk/shared\` to identify multiple versions, and update your dependencies to only rely on one.

Learn more: https://clerk.com/docs/components/clerk-provider`.trim());
	}
}

//#endregion
//#region src/react/hooks/useSafeLayoutEffect.tsx
/**
* @internal
*/
typeof window !== "undefined" ? React6.useLayoutEffect : React6.useEffect;
/**
* @internal
*/
const isDeeplyEqual = dequal;

//#endregion
//#region src/react/stripe-react/utils.ts
const usePrevious = (value) => {
	const ref = reactExports.useRef(value);
	reactExports.useEffect(() => {
		ref.current = value;
	}, [value]);
	return ref.current;
};
const useAttachEvent = (element, event, cb) => {
	const cbDefined = !!cb;
	const cbRef = reactExports.useRef(cb);
	reactExports.useEffect(() => {
		cbRef.current = cb;
	}, [cb]);
	reactExports.useEffect(() => {
		if (!cbDefined || !element) return () => {};
		const decoratedCb = (...args) => {
			if (cbRef.current) cbRef.current(...args);
		};
		element.on(event, decoratedCb);
		return () => {
			element.off(event, decoratedCb);
		};
	}, [
		cbDefined,
		event,
		element,
		cbRef
	]);
};

//#endregion
//#region src/react/stripe-react/index.tsx
const ElementsContext = React6.createContext(null);
ElementsContext.displayName = "ElementsContext";
const parseElementsContext = (ctx, useCase) => {
	if (!ctx) throw new Error(`Could not find Elements context; You need to wrap the part of your app that ${useCase} in an <Elements> provider.`);
	return ctx;
};
const isUnknownObject = (raw) => {
	return raw !== null && typeof raw === "object";
};
const extractAllowedOptionsUpdates = (options, prevOptions, immutableKeys) => {
	if (!isUnknownObject(options)) return null;
	return Object.keys(options).reduce((newOptions, key) => {
		const isUpdated = !isUnknownObject(prevOptions) || !isEqual(options[key], prevOptions[key]);
		if (immutableKeys.includes(key)) {
			if (isUpdated) console.warn(`Unsupported prop change: options.${key} is not a mutable property.`);
			return newOptions;
		}
		if (!isUpdated) return newOptions;
		return {
			...newOptions || {},
			[key]: options[key]
		};
	}, null);
};
const PLAIN_OBJECT_STR = "[object Object]";
const isEqual = (left, right) => {
	if (!isUnknownObject(left) || !isUnknownObject(right)) return left === right;
	const leftArray = Array.isArray(left);
	if (leftArray !== Array.isArray(right)) return false;
	const leftPlainObject = Object.prototype.toString.call(left) === PLAIN_OBJECT_STR;
	if (leftPlainObject !== (Object.prototype.toString.call(right) === PLAIN_OBJECT_STR)) return false;
	if (!leftPlainObject && !leftArray) return left === right;
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	const keySet = {};
	for (let i = 0; i < leftKeys.length; i += 1) keySet[leftKeys[i]] = true;
	for (let i = 0; i < rightKeys.length; i += 1) keySet[rightKeys[i]] = true;
	const allKeys = Object.keys(keySet);
	if (allKeys.length !== leftKeys.length) return false;
	const l = left;
	const r = right;
	const pred = (key) => {
		return isEqual(l[key], r[key]);
	};
	return allKeys.every(pred);
};
const useElementsOrCheckoutSdkContextWithUseCase = (useCaseString) => {
	return parseElementsContext(React6.useContext(ElementsContext), useCaseString);
};
const capitalized = (str) => str.charAt(0).toUpperCase() + str.slice(1);
const createElementComponent = (type, isServer) => {
	const displayName = `${capitalized(type)}Element`;
	const ClientElement = ({ id, className, fallback, options = {}, onBlur, onFocus, onReady, onChange, onEscape, onClick, onLoadError, onLoaderStart, onNetworksChange, onConfirm, onCancel, onShippingAddressChange, onShippingRateChange }) => {
		const ctx = useElementsOrCheckoutSdkContextWithUseCase(`mounts <${displayName}>`);
		const elements = "elements" in ctx ? ctx.elements : null;
		const [element, setElement] = React6.useState(null);
		const elementRef = React6.useRef(null);
		const domNode = React6.useRef(null);
		const [isReady, setReady] = reactExports.useState(false);
		useAttachEvent(element, "blur", onBlur);
		useAttachEvent(element, "focus", onFocus);
		useAttachEvent(element, "escape", onEscape);
		useAttachEvent(element, "click", onClick);
		useAttachEvent(element, "loaderror", onLoadError);
		useAttachEvent(element, "loaderstart", onLoaderStart);
		useAttachEvent(element, "networkschange", onNetworksChange);
		useAttachEvent(element, "confirm", onConfirm);
		useAttachEvent(element, "cancel", onCancel);
		useAttachEvent(element, "shippingaddresschange", onShippingAddressChange);
		useAttachEvent(element, "shippingratechange", onShippingRateChange);
		useAttachEvent(element, "change", onChange);
		let readyCallback;
		if (onReady) readyCallback = () => {
			setReady(true);
			onReady(element);
		};
		useAttachEvent(element, "ready", readyCallback);
		React6.useLayoutEffect(() => {
			if (elementRef.current === null && domNode.current !== null && elements) {
				let newElement = null;
				if (elements) newElement = elements.create(type, options);
				elementRef.current = newElement;
				setElement(newElement);
				if (newElement) newElement.mount(domNode.current);
			}
		}, [elements, options]);
		const prevOptions = usePrevious(options);
		React6.useEffect(() => {
			if (!elementRef.current) return;
			const updates = extractAllowedOptionsUpdates(options, prevOptions, ["paymentRequest"]);
			if (updates && "update" in elementRef.current) elementRef.current.update(updates);
		}, [options, prevOptions]);
		React6.useLayoutEffect(() => {
			return () => {
				if (elementRef.current && typeof elementRef.current.destroy === "function") try {
					elementRef.current.destroy();
					elementRef.current = null;
				} catch {}
			};
		}, []);
		return /* @__PURE__ */ React6.createElement(React6.Fragment, null, !isReady && fallback, /* @__PURE__ */ React6.createElement("div", {
			id,
			style: {
				height: isReady ? "unset" : "0px",
				visibility: isReady ? "visible" : "hidden"
			},
			className,
			ref: domNode
		}));
	};
	const ServerElement = (props) => {
		useElementsOrCheckoutSdkContextWithUseCase(`mounts <${displayName}>`);
		const { id, className } = props;
		return /* @__PURE__ */ React6.createElement("div", {
			id,
			className
		});
	};
	const Element = isServer ? ServerElement : ClientElement;
	Element.displayName = displayName;
	Element.__elementType = type;
	return Element;
};
createElementComponent("payment", typeof window === "undefined");
createContextAndHook("PaymentElementContext");
createContextAndHook("StripeUtilsContext");

// src/errors/errorThrower.ts
var errorThrower$1 = buildErrorThrower({ packageName: "@clerk/clerk-react" });
function setErrorThrowerOptions(options) {
  errorThrower$1.setMessages(options).setPackageName(options);
}
createContextAndHook("AuthContext");
var useIsomorphicClerkContext = useClerkInstanceContext;
var multipleChildrenInButtonComponent = (name) => `You've passed multiple children components to <${name}/>. You can only pass a single child component or text.`;
var unsupportedNonBrowserDomainOrProxyUrlFunction = "Unsupported usage of isSatellite, domain or proxyUrl. The usage of isSatellite, domain or proxyUrl as function is not supported in non-browser environments.";
var userProfilePageRenderedError = "<UserProfile.Page /> component needs to be a direct child of `<UserProfile />` or `<UserButton />`.";
var userProfileLinkRenderedError = "<UserProfile.Link /> component needs to be a direct child of `<UserProfile />` or `<UserButton />`.";
var organizationProfilePageRenderedError = "<OrganizationProfile.Page /> component needs to be a direct child of `<OrganizationProfile />` or `<OrganizationSwitcher />`.";
var organizationProfileLinkRenderedError = "<OrganizationProfile.Link /> component needs to be a direct child of `<OrganizationProfile />` or `<OrganizationSwitcher />`.";
var customPagesIgnoredComponent = (componentName) => `<${componentName} /> can only accept <${componentName}.Page /> and <${componentName}.Link /> as its children. Any other provided component will be ignored. Additionally, please ensure that the component is rendered in a client component.`;
var customPageWrongProps = (componentName) => `Missing props. <${componentName}.Page /> component requires the following props: url, label, labelIcon, alongside with children to be rendered inside the page.`;
var customLinkWrongProps = (componentName) => `Missing props. <${componentName}.Link /> component requires the following props: url, label and labelIcon.`;
var userButtonIgnoredComponent = `<UserButton /> can only accept <UserButton.UserProfilePage />, <UserButton.UserProfileLink /> and <UserButton.MenuItems /> as its children. Any other provided component will be ignored. Additionally, please ensure that the component is rendered in a client component.`;
var customMenuItemsIgnoredComponent = "<UserButton.MenuItems /> component can only accept <UserButton.Action /> and <UserButton.Link /> as its children. Any other provided component will be ignored. Additionally, please ensure that the component is rendered in a client component.";
var userButtonMenuItemsRenderedError = "<UserButton.MenuItems /> component needs to be a direct child of `<UserButton />`.";
var userButtonMenuActionRenderedError = "<UserButton.Action /> component needs to be a direct child of `<UserButton.MenuItems />`.";
var userButtonMenuLinkRenderedError = "<UserButton.Link /> component needs to be a direct child of `<UserButton.MenuItems />`.";
var userButtonMenuItemLinkWrongProps = "Missing props. <UserButton.Link /> component requires the following props: href, label and labelIcon.";
var userButtonMenuItemsActionWrongsProps = "Missing props. <UserButton.Action /> component requires the following props: label.";
var useAssertWrappedByClerkProvider = (source) => {
  useAssertWrappedByClerkProvider$1(() => {
    errorThrower$1.throwMissingClerkProviderError({ source });
  });
};
var withClerk = (Component, displayNameOrOptions) => {
  const passedDisplayedName = typeof displayNameOrOptions === "string" ? displayNameOrOptions : displayNameOrOptions == null ? void 0 : displayNameOrOptions.component;
  const displayName = passedDisplayedName || Component.displayName || Component.name || "Component";
  Component.displayName = displayName;
  const options = typeof displayNameOrOptions === "string" ? void 0 : displayNameOrOptions;
  const HOC = (props) => {
    useAssertWrappedByClerkProvider(displayName || "withClerk");
    const clerk = useIsomorphicClerkContext();
    if (!clerk.loaded && !(options == null ? void 0 : options.renderWhileLoading)) {
      return null;
    }
    return /* @__PURE__ */ React6.createElement(
      Component,
      {
        ...props,
        component: displayName,
        clerk
      }
    );
  };
  HOC.displayName = `withClerk(${displayName})`;
  return HOC;
};

const isDevelopmentEnvironment = () => {
  try {
    return false;
  } catch {
  }
  return false;
};
const isTestEnvironment = () => {
  try {
    return false;
  } catch {
  }
  return false;
};
const isProductionEnvironment = () => {
  try {
    return true;
  } catch {
  }
  return false;
};

//#region src/deprecated.ts
/**
* Mark class method / function as deprecated.
*
* A console WARNING will be displayed when class method / function is invoked.
*
* Examples
* 1. Deprecate class method
* class Example {
*   getSomething = (arg1, arg2) => {
*       deprecated('Example.getSomething', 'Use `getSomethingElse` instead.');
*       return `getSomethingValue:${arg1 || '-'}:${arg2 || '-'}`;
*   };
* }
*
* 2. Deprecate function
* const getSomething = () => {
*   deprecated('getSomething', 'Use `getSomethingElse` instead.');
*   return 'getSomethingValue';
* };
*/
const displayedWarnings = /* @__PURE__ */ new Set();
const deprecated = (fnName, warning, key) => {
	const hideWarning = isTestEnvironment() || isProductionEnvironment();
	const messageId = fnName;
	if (displayedWarnings.has(messageId) || hideWarning) return;
	displayedWarnings.add(messageId);
	console.warn(`Clerk - DEPRECATION WARNING: "${fnName}" is deprecated and will be removed in the next major release.\n${warning}`);
};

withClerk(({ clerk, ...props }) => {
  const { client, session } = clerk;
  const hasSignedInSessions = client.signedInSessions ? client.signedInSessions.length > 0 : (
    // Compat for clerk-js<5.54.0 (which was released with the `signedInSessions` property)
    client.activeSessions && client.activeSessions.length > 0
  );
  React6.useEffect(() => {
    if (session === null && hasSignedInSessions) {
      void clerk.redirectToAfterSignOut();
    } else {
      void clerk.redirectToSignIn(props);
    }
  }, []);
  return null;
}, "RedirectToSignIn");
withClerk(({ clerk, ...props }) => {
  React6.useEffect(() => {
    void clerk.redirectToSignUp(props);
  }, []);
  return null;
}, "RedirectToSignUp");
withClerk(({ clerk, ...props }) => {
  React6.useEffect(() => {
    void clerk.redirectToTasks(props);
  }, []);
  return null;
}, "RedirectToTasks");
withClerk(({ clerk }) => {
  React6.useEffect(() => {
    deprecated("RedirectToUserProfile", "Use the `redirectToUserProfile()` method instead.");
    void clerk.redirectToUserProfile();
  }, []);
  return null;
}, "RedirectToUserProfile");
withClerk(({ clerk }) => {
  React6.useEffect(() => {
    deprecated("RedirectToOrganizationProfile", "Use the `redirectToOrganizationProfile()` method instead.");
    void clerk.redirectToOrganizationProfile();
  }, []);
  return null;
}, "RedirectToOrganizationProfile");
withClerk(({ clerk }) => {
  React6.useEffect(() => {
    deprecated("RedirectToCreateOrganization", "Use the `redirectToCreateOrganization()` method instead.");
    void clerk.redirectToCreateOrganization();
  }, []);
  return null;
}, "RedirectToCreateOrganization");
withClerk(
  ({ clerk, ...handleRedirectCallbackParams }) => {
    React6.useEffect(() => {
      void clerk.handleRedirectCallback(handleRedirectCallbackParams);
    }, []);
    return null;
  },
  "AuthenticateWithRedirectCallback"
);

//#region src/utils/handleValueOrFn.ts
function handleValueOrFn(value, url, defaultValue) {
	if (typeof value === "function") return value(url);
	if (typeof value !== "undefined") return value;
	if (typeof defaultValue !== "undefined") return defaultValue;
}

//#endregion
//#region src/utils/logErrorInDevMode.ts
const logErrorInDevMode = (message) => {
	if (isDevelopmentEnvironment()) console.error(`Clerk: ${message}`);
};

var reactDomExports = requireReactDom();

//#region src/object.ts
const without = (obj, ...props) => {
	const copy = { ...obj };
	for (const prop of props) delete copy[prop];
	return copy;
};

var assertSingleChild = (children) => (name) => {
  try {
    return React6.Children.only(children);
  } catch {
    return errorThrower$1.throw(multipleChildrenInButtonComponent(name));
  }
};
var normalizeWithDefaultValue = (children, defaultText) => {
  if (!children) {
    children = defaultText;
  }
  if (typeof children === "string") {
    children = /* @__PURE__ */ React6.createElement("button", null, children);
  }
  return children;
};
var safeExecute = (cb) => (...args) => {
  if (cb && typeof cb === "function") {
    return cb(...args);
  }
};

// src/utils/isConstructor.ts
function isConstructor(f) {
  return typeof f === "function";
}
var useCustomElementPortal = (elements) => {
  const [nodeMap, setNodeMap] = reactExports.useState(/* @__PURE__ */ new Map());
  return elements.map((el) => ({
    id: el.id,
    mount: (node) => setNodeMap((prev) => new Map(prev).set(String(el.id), node)),
    unmount: () => setNodeMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(String(el.id), null);
      return newMap;
    }),
    portal: () => {
      const node = nodeMap.get(String(el.id));
      return node ? reactDomExports.createPortal(el.component, node) : null;
    }
  }));
};
var isThatComponent = (v, component) => {
  return !!v && React6.isValidElement(v) && (v == null ? void 0 : v.type) === component;
};

// src/utils/useCustomPages.tsx
var useUserProfileCustomPages = (children, options) => {
  const reorderItemsLabels = ["account", "security", "billing", "apiKeys"];
  return useCustomPages(
    {
      children,
      reorderItemsLabels,
      LinkComponent: UserProfileLink,
      PageComponent: UserProfilePage,
      MenuItemsComponent: MenuItems,
      componentName: "UserProfile"
    },
    options
  );
};
var useOrganizationProfileCustomPages = (children, options) => {
  const reorderItemsLabels = ["general", "members", "billing", "apiKeys"];
  return useCustomPages(
    {
      children,
      reorderItemsLabels,
      LinkComponent: OrganizationProfileLink,
      PageComponent: OrganizationProfilePage,
      componentName: "OrganizationProfile"
    },
    options
  );
};
var useSanitizedChildren = (children) => {
  const sanitizedChildren = [];
  const excludedComponents = [
    OrganizationProfileLink,
    OrganizationProfilePage,
    MenuItems,
    UserProfilePage,
    UserProfileLink
  ];
  React6.Children.forEach(children, (child) => {
    if (!excludedComponents.some((component) => isThatComponent(child, component))) {
      sanitizedChildren.push(child);
    }
  });
  return sanitizedChildren;
};
var useCustomPages = (params, options) => {
  const { children, LinkComponent, PageComponent, MenuItemsComponent, reorderItemsLabels, componentName } = params;
  const { allowForAnyChildren = false } = options || {};
  const validChildren = [];
  React6.Children.forEach(children, (child) => {
    if (!isThatComponent(child, PageComponent) && !isThatComponent(child, LinkComponent) && !isThatComponent(child, MenuItemsComponent)) {
      if (child && !allowForAnyChildren) {
        logErrorInDevMode(customPagesIgnoredComponent(componentName));
      }
      return;
    }
    const { props } = child;
    const { children: children2, label, url, labelIcon } = props;
    if (isThatComponent(child, PageComponent)) {
      if (isReorderItem(props, reorderItemsLabels)) {
        validChildren.push({ label });
      } else if (isCustomPage(props)) {
        validChildren.push({ label, labelIcon, children: children2, url });
      } else {
        logErrorInDevMode(customPageWrongProps(componentName));
        return;
      }
    }
    if (isThatComponent(child, LinkComponent)) {
      if (isExternalLink(props)) {
        validChildren.push({ label, labelIcon, url });
      } else {
        logErrorInDevMode(customLinkWrongProps(componentName));
        return;
      }
    }
  });
  const customPageContents = [];
  const customPageLabelIcons = [];
  const customLinkLabelIcons = [];
  validChildren.forEach((cp, index) => {
    if (isCustomPage(cp)) {
      customPageContents.push({ component: cp.children, id: index });
      customPageLabelIcons.push({ component: cp.labelIcon, id: index });
      return;
    }
    if (isExternalLink(cp)) {
      customLinkLabelIcons.push({ component: cp.labelIcon, id: index });
    }
  });
  const customPageContentsPortals = useCustomElementPortal(customPageContents);
  const customPageLabelIconsPortals = useCustomElementPortal(customPageLabelIcons);
  const customLinkLabelIconsPortals = useCustomElementPortal(customLinkLabelIcons);
  const customPages = [];
  const customPagesPortals = [];
  validChildren.forEach((cp, index) => {
    if (isReorderItem(cp, reorderItemsLabels)) {
      customPages.push({ label: cp.label });
      return;
    }
    if (isCustomPage(cp)) {
      const {
        portal: contentPortal,
        mount,
        unmount
      } = customPageContentsPortals.find((p) => p.id === index);
      const {
        portal: labelPortal,
        mount: mountIcon,
        unmount: unmountIcon
      } = customPageLabelIconsPortals.find((p) => p.id === index);
      customPages.push({ label: cp.label, url: cp.url, mount, unmount, mountIcon, unmountIcon });
      customPagesPortals.push(contentPortal);
      customPagesPortals.push(labelPortal);
      return;
    }
    if (isExternalLink(cp)) {
      const {
        portal: labelPortal,
        mount: mountIcon,
        unmount: unmountIcon
      } = customLinkLabelIconsPortals.find((p) => p.id === index);
      customPages.push({ label: cp.label, url: cp.url, mountIcon, unmountIcon });
      customPagesPortals.push(labelPortal);
      return;
    }
  });
  return { customPages, customPagesPortals };
};
var isReorderItem = (childProps, validItems) => {
  const { children, label, url, labelIcon } = childProps;
  return !children && !url && !labelIcon && validItems.some((v) => v === label);
};
var isCustomPage = (childProps) => {
  const { children, label, url, labelIcon } = childProps;
  return !!children && !!url && !!labelIcon && !!label;
};
var isExternalLink = (childProps) => {
  const { children, label, url, labelIcon } = childProps;
  return !children && !!url && !!labelIcon && !!label;
};
var useUserButtonCustomMenuItems = (children, options) => {
  var _a;
  const reorderItemsLabels = ["manageAccount", "signOut"];
  return useCustomMenuItems({
    children,
    reorderItemsLabels,
    MenuItemsComponent: MenuItems,
    MenuActionComponent: MenuAction,
    MenuLinkComponent: MenuLink,
    UserProfileLinkComponent: UserProfileLink,
    UserProfilePageComponent: UserProfilePage,
    allowForAnyChildren: (_a = options == null ? void 0 : options.allowForAnyChildren) != null ? _a : false
  });
};
var useCustomMenuItems = ({
  children,
  MenuItemsComponent,
  MenuActionComponent,
  MenuLinkComponent,
  UserProfileLinkComponent,
  UserProfilePageComponent,
  reorderItemsLabels,
  allowForAnyChildren = false
}) => {
  const validChildren = [];
  const customMenuItems = [];
  const customMenuItemsPortals = [];
  React6.Children.forEach(children, (child) => {
    if (!isThatComponent(child, MenuItemsComponent) && !isThatComponent(child, UserProfileLinkComponent) && !isThatComponent(child, UserProfilePageComponent)) {
      if (child && !allowForAnyChildren) {
        logErrorInDevMode(userButtonIgnoredComponent);
      }
      return;
    }
    if (isThatComponent(child, UserProfileLinkComponent) || isThatComponent(child, UserProfilePageComponent)) {
      return;
    }
    const { props } = child;
    React6.Children.forEach(props.children, (child2) => {
      if (!isThatComponent(child2, MenuActionComponent) && !isThatComponent(child2, MenuLinkComponent)) {
        if (child2) {
          logErrorInDevMode(customMenuItemsIgnoredComponent);
        }
        return;
      }
      const { props: props2 } = child2;
      const { label, labelIcon, href, onClick, open } = props2;
      if (isThatComponent(child2, MenuActionComponent)) {
        if (isReorderItem2(props2, reorderItemsLabels)) {
          validChildren.push({ label });
        } else if (isCustomMenuItem(props2)) {
          const baseItem = {
            label,
            labelIcon
          };
          if (onClick !== void 0) {
            validChildren.push({
              ...baseItem,
              onClick
            });
          } else if (open !== void 0) {
            validChildren.push({
              ...baseItem,
              open: open.startsWith("/") ? open : `/${open}`
            });
          } else {
            logErrorInDevMode("Custom menu item must have either onClick or open property");
            return;
          }
        } else {
          logErrorInDevMode(userButtonMenuItemsActionWrongsProps);
          return;
        }
      }
      if (isThatComponent(child2, MenuLinkComponent)) {
        if (isExternalLink2(props2)) {
          validChildren.push({ label, labelIcon, href });
        } else {
          logErrorInDevMode(userButtonMenuItemLinkWrongProps);
          return;
        }
      }
    });
  });
  const customMenuItemLabelIcons = [];
  const customLinkLabelIcons = [];
  validChildren.forEach((mi, index) => {
    if (isCustomMenuItem(mi)) {
      customMenuItemLabelIcons.push({ component: mi.labelIcon, id: index });
    }
    if (isExternalLink2(mi)) {
      customLinkLabelIcons.push({ component: mi.labelIcon, id: index });
    }
  });
  const customMenuItemLabelIconsPortals = useCustomElementPortal(customMenuItemLabelIcons);
  const customLinkLabelIconsPortals = useCustomElementPortal(customLinkLabelIcons);
  validChildren.forEach((mi, index) => {
    if (isReorderItem2(mi, reorderItemsLabels)) {
      customMenuItems.push({
        label: mi.label
      });
    }
    if (isCustomMenuItem(mi)) {
      const {
        portal: iconPortal,
        mount: mountIcon,
        unmount: unmountIcon
      } = customMenuItemLabelIconsPortals.find((p) => p.id === index);
      const menuItem = {
        label: mi.label,
        mountIcon,
        unmountIcon
      };
      if ("onClick" in mi) {
        menuItem.onClick = mi.onClick;
      } else if ("open" in mi) {
        menuItem.open = mi.open;
      }
      customMenuItems.push(menuItem);
      customMenuItemsPortals.push(iconPortal);
    }
    if (isExternalLink2(mi)) {
      const {
        portal: iconPortal,
        mount: mountIcon,
        unmount: unmountIcon
      } = customLinkLabelIconsPortals.find((p) => p.id === index);
      customMenuItems.push({
        label: mi.label,
        href: mi.href,
        mountIcon,
        unmountIcon
      });
      customMenuItemsPortals.push(iconPortal);
    }
  });
  return { customMenuItems, customMenuItemsPortals };
};
var isReorderItem2 = (childProps, validItems) => {
  const { children, label, onClick, labelIcon } = childProps;
  return !children && !onClick && !labelIcon && validItems.some((v) => v === label);
};
var isCustomMenuItem = (childProps) => {
  const { label, labelIcon, onClick, open } = childProps;
  return !!labelIcon && !!label && (typeof onClick === "function" || typeof open === "string");
};
var isExternalLink2 = (childProps) => {
  const { label, href, labelIcon } = childProps;
  return !!href && !!labelIcon && !!label;
};
var createAwaitableMutationObserver = (globalOptions) => {
  const isReady = globalOptions == null ? void 0 : globalOptions.isReady;
  return (options) => new Promise((resolve, reject) => {
    const { root = document == null ? void 0 : document.body, selector, timeout = 0 } = options;
    if (!root) {
      reject(new Error("No root element provided"));
      return;
    }
    let elementToWatch = root;
    if (selector) {
      elementToWatch = root == null ? void 0 : root.querySelector(selector);
    }
    if (isReady(elementToWatch, selector)) {
      resolve();
      return;
    }
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (!elementToWatch && selector) {
          elementToWatch = root == null ? void 0 : root.querySelector(selector);
        }
        if (globalOptions.childList && mutation.type === "childList" || globalOptions.attributes && mutation.type === "attributes") {
          if (isReady(elementToWatch, selector)) {
            observer.disconnect();
            resolve();
            return;
          }
        }
      }
    });
    observer.observe(root, globalOptions);
    if (timeout > 0) {
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for ${selector}`));
      }, timeout);
    }
  });
};
var waitForElementChildren = createAwaitableMutationObserver({
  childList: true,
  subtree: true,
  isReady: (el, selector) => {
    var _a;
    return !!(el == null ? void 0 : el.childElementCount) && ((_a = el == null ? void 0 : el.matches) == null ? void 0 : _a.call(el, selector)) && el.childElementCount > 0;
  }
});
function useWaitForComponentMount(component, options) {
  const watcherRef = reactExports.useRef();
  const [status, setStatus] = reactExports.useState("rendering");
  reactExports.useEffect(() => {
    if (!component) {
      throw new Error("Clerk: no component name provided, unable to detect mount.");
    }
    if (typeof window !== "undefined" && !watcherRef.current) {
      const defaultSelector = `[data-clerk-component="${component}"]`;
      const selector = options == null ? void 0 : options.selector;
      watcherRef.current = waitForElementChildren({
        selector: selector ? (
          // Allows for `[data-clerk-component="xxxx"][data-some-attribute="123"] .my-class`
          defaultSelector + selector
        ) : defaultSelector
      }).then(() => {
        setStatus("rendered");
      }).catch(() => {
        setStatus("error");
      });
    }
  }, [component, options == null ? void 0 : options.selector]);
  return status;
}
var isMountProps = (props) => {
  return "mount" in props;
};
var isOpenProps = (props) => {
  return "open" in props;
};
var stripMenuItemIconHandlers = (menuItems) => {
  return menuItems == null ? void 0 : menuItems.map(({ mountIcon, unmountIcon, ...rest }) => rest);
};
var ClerkHostRenderer = class extends React6.PureComponent {
  constructor() {
    super(...arguments);
    this.rootRef = React6.createRef();
  }
  componentDidUpdate(_prevProps) {
    var _a, _b, _c, _d;
    if (!isMountProps(_prevProps) || !isMountProps(this.props)) {
      return;
    }
    const prevProps = without(_prevProps.props, "customPages", "customMenuItems", "children");
    const newProps = without(this.props.props, "customPages", "customMenuItems", "children");
    const customPagesChanged = ((_a = prevProps.customPages) == null ? void 0 : _a.length) !== ((_b = newProps.customPages) == null ? void 0 : _b.length);
    const customMenuItemsChanged = ((_c = prevProps.customMenuItems) == null ? void 0 : _c.length) !== ((_d = newProps.customMenuItems) == null ? void 0 : _d.length);
    const prevMenuItemsWithoutHandlers = stripMenuItemIconHandlers(_prevProps.props.customMenuItems);
    const newMenuItemsWithoutHandlers = stripMenuItemIconHandlers(this.props.props.customMenuItems);
    if (!isDeeplyEqual(prevProps, newProps) || !isDeeplyEqual(prevMenuItemsWithoutHandlers, newMenuItemsWithoutHandlers) || customPagesChanged || customMenuItemsChanged) {
      if (this.rootRef.current) {
        this.props.updateProps({ node: this.rootRef.current, props: this.props.props });
      }
    }
  }
  componentDidMount() {
    if (this.rootRef.current) {
      if (isMountProps(this.props)) {
        this.props.mount(this.rootRef.current, this.props.props);
      }
      if (isOpenProps(this.props)) {
        this.props.open(this.props.props);
      }
    }
  }
  componentWillUnmount() {
    if (this.rootRef.current) {
      if (isMountProps(this.props)) {
        this.props.unmount(this.rootRef.current);
      }
      if (isOpenProps(this.props)) {
        this.props.close();
      }
    }
  }
  render() {
    const { hideRootHtmlElement = false } = this.props;
    const rootAttributes = {
      ref: this.rootRef,
      ...this.props.rootProps,
      ...this.props.component && { "data-clerk-component": this.props.component }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, !hideRootHtmlElement && /* @__PURE__ */ React6.createElement("div", { ...rootAttributes }), this.props.children);
  }
};

// src/components/uiComponents.tsx
var CustomPortalsRenderer = (props) => {
  var _a, _b;
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, (_a = props == null ? void 0 : props.customPagesPortals) == null ? void 0 : _a.map((portal, index) => reactExports.createElement(portal, { key: index })), (_b = props == null ? void 0 : props.customMenuItemsPortals) == null ? void 0 : _b.map((portal, index) => reactExports.createElement(portal, { key: index })));
};
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountSignIn,
        unmount: clerk.unmountSignIn,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "SignIn", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountSignUp,
        unmount: clerk.unmountSignUp,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "SignUp", renderWhileLoading: true }
);
function UserProfilePage({ children }) {
  logErrorInDevMode(userProfilePageRenderedError);
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, children);
}
function UserProfileLink({ children }) {
  logErrorInDevMode(userProfileLinkRenderedError);
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, children);
}
var _UserProfile = withClerk(
  ({
    clerk,
    component,
    fallback,
    ...props
  }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    const { customPages, customPagesPortals } = useUserProfileCustomPages(props.children);
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountUserProfile,
        unmount: clerk.unmountUserProfile,
        updateProps: clerk.__unstable__updateProps,
        props: { ...props, customPages },
        rootProps: rendererRootProps
      },
      /* @__PURE__ */ React6.createElement(CustomPortalsRenderer, { customPagesPortals })
    ));
  },
  { component: "UserProfile", renderWhileLoading: true }
);
Object.assign(_UserProfile, {
  Page: UserProfilePage,
  Link: UserProfileLink
});
var UserButtonContext = reactExports.createContext({
  mount: () => {
  },
  unmount: () => {
  },
  updateProps: () => {
  }
});
var _UserButton = withClerk(
  ({
    clerk,
    component,
    fallback,
    ...props
  }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    const { customPages, customPagesPortals } = useUserProfileCustomPages(props.children, {
      allowForAnyChildren: !!props.__experimental_asProvider
    });
    const userProfileProps = { ...props.userProfileProps, customPages };
    const { customMenuItems, customMenuItemsPortals } = useUserButtonCustomMenuItems(props.children, {
      allowForAnyChildren: !!props.__experimental_asProvider
    });
    const sanitizedChildren = useSanitizedChildren(props.children);
    const passableProps = {
      mount: clerk.mountUserButton,
      unmount: clerk.unmountUserButton,
      updateProps: clerk.__unstable__updateProps,
      props: { ...props, userProfileProps, customMenuItems }
    };
    const portalProps = {
      customPagesPortals,
      customMenuItemsPortals
    };
    return /* @__PURE__ */ React6.createElement(UserButtonContext.Provider, { value: passableProps }, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        ...passableProps,
        hideRootHtmlElement: !!props.__experimental_asProvider,
        rootProps: rendererRootProps
      },
      props.__experimental_asProvider ? sanitizedChildren : null,
      /* @__PURE__ */ React6.createElement(CustomPortalsRenderer, { ...portalProps })
    ));
  },
  { component: "UserButton", renderWhileLoading: true }
);
function MenuItems({ children }) {
  logErrorInDevMode(userButtonMenuItemsRenderedError);
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, children);
}
function MenuAction({ children }) {
  logErrorInDevMode(userButtonMenuActionRenderedError);
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, children);
}
function MenuLink({ children }) {
  logErrorInDevMode(userButtonMenuLinkRenderedError);
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, children);
}
function UserButtonOutlet(outletProps) {
  const providerProps = reactExports.useContext(UserButtonContext);
  const portalProps = {
    ...providerProps,
    props: {
      ...providerProps.props,
      ...outletProps
    }
  };
  return /* @__PURE__ */ React6.createElement(ClerkHostRenderer, { ...portalProps });
}
Object.assign(_UserButton, {
  UserProfilePage,
  UserProfileLink,
  MenuItems,
  Action: MenuAction,
  Link: MenuLink,
  __experimental_Outlet: UserButtonOutlet
});
function OrganizationProfilePage({ children }) {
  logErrorInDevMode(organizationProfilePageRenderedError);
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, children);
}
function OrganizationProfileLink({ children }) {
  logErrorInDevMode(organizationProfileLinkRenderedError);
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, children);
}
var _OrganizationProfile = withClerk(
  ({
    clerk,
    component,
    fallback,
    ...props
  }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    const { customPages, customPagesPortals } = useOrganizationProfileCustomPages(props.children);
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountOrganizationProfile,
        unmount: clerk.unmountOrganizationProfile,
        updateProps: clerk.__unstable__updateProps,
        props: { ...props, customPages },
        rootProps: rendererRootProps
      },
      /* @__PURE__ */ React6.createElement(CustomPortalsRenderer, { customPagesPortals })
    ));
  },
  { component: "OrganizationProfile", renderWhileLoading: true }
);
Object.assign(_OrganizationProfile, {
  Page: OrganizationProfilePage,
  Link: OrganizationProfileLink
});
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountCreateOrganization,
        unmount: clerk.unmountCreateOrganization,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "CreateOrganization", renderWhileLoading: true }
);
var OrganizationSwitcherContext = reactExports.createContext({
  mount: () => {
  },
  unmount: () => {
  },
  updateProps: () => {
  }
});
var _OrganizationSwitcher = withClerk(
  ({
    clerk,
    component,
    fallback,
    ...props
  }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    const { customPages, customPagesPortals } = useOrganizationProfileCustomPages(props.children, {
      allowForAnyChildren: !!props.__experimental_asProvider
    });
    const organizationProfileProps = { ...props.organizationProfileProps, customPages };
    const sanitizedChildren = useSanitizedChildren(props.children);
    const passableProps = {
      mount: clerk.mountOrganizationSwitcher,
      unmount: clerk.unmountOrganizationSwitcher,
      updateProps: clerk.__unstable__updateProps,
      props: { ...props, organizationProfileProps },
      rootProps: rendererRootProps,
      component
    };
    clerk.__experimental_prefetchOrganizationSwitcher();
    return /* @__PURE__ */ React6.createElement(OrganizationSwitcherContext.Provider, { value: passableProps }, /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        ...passableProps,
        hideRootHtmlElement: !!props.__experimental_asProvider
      },
      props.__experimental_asProvider ? sanitizedChildren : null,
      /* @__PURE__ */ React6.createElement(CustomPortalsRenderer, { customPagesPortals })
    )));
  },
  { component: "OrganizationSwitcher", renderWhileLoading: true }
);
function OrganizationSwitcherOutlet(outletProps) {
  const providerProps = reactExports.useContext(OrganizationSwitcherContext);
  const portalProps = {
    ...providerProps,
    props: {
      ...providerProps.props,
      ...outletProps
    }
  };
  return /* @__PURE__ */ React6.createElement(ClerkHostRenderer, { ...portalProps });
}
Object.assign(_OrganizationSwitcher, {
  OrganizationProfilePage,
  OrganizationProfileLink,
  __experimental_Outlet: OrganizationSwitcherOutlet
});
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountOrganizationList,
        unmount: clerk.unmountOrganizationList,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "OrganizationList", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        open: clerk.openGoogleOneTap,
        close: clerk.closeGoogleOneTap,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "GoogleOneTap", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountWaitlist,
        unmount: clerk.unmountWaitlist,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "Waitlist", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component, {
      // This attribute is added to the PricingTable root element after we've successfully fetched the plans asynchronously.
      selector: '[data-component-status="ready"]'
    });
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountPricingTable,
        unmount: clerk.unmountPricingTable,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "PricingTable", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountAPIKeys,
        unmount: clerk.unmountAPIKeys,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "ApiKeys", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountUserAvatar,
        unmount: clerk.unmountUserAvatar,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "UserAvatar", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountTaskChooseOrganization,
        unmount: clerk.unmountTaskChooseOrganization,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "TaskChooseOrganization", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountTaskResetPassword,
        unmount: clerk.unmountTaskResetPassword,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "TaskResetPassword", renderWhileLoading: true }
);
withClerk(
  ({ clerk, component, fallback, ...props }) => {
    const mountingStatus = useWaitForComponentMount(component);
    const shouldShowFallback = mountingStatus === "rendering" || !clerk.loaded;
    const rendererRootProps = {
      ...shouldShowFallback && fallback && { style: { display: "none" } }
    };
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, shouldShowFallback && fallback, clerk.loaded && /* @__PURE__ */ React6.createElement(
      ClerkHostRenderer,
      {
        component,
        mount: clerk.mountTaskSetupMFA,
        unmount: clerk.unmountTaskSetupMFA,
        updateProps: clerk.__unstable__updateProps,
        props,
        rootProps: rendererRootProps
      }
    ));
  },
  { component: "TaskSetupMFA", renderWhileLoading: true }
);

var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

//#region src/retry.ts
const defaultOptions = {
	initialDelay: 125,
	maxDelayBetweenRetries: 0,
	factor: 2,
	shouldRetry: (_, iteration) => iteration < 5,
	retryImmediately: false,
	jitter: true
};
const RETRY_IMMEDIATELY_DELAY = 100;
const sleep = async (ms) => new Promise((s) => setTimeout(s, ms));
const applyJitter = (delay, jitter) => {
	return jitter ? delay * (1 + Math.random()) : delay;
};
const createExponentialDelayAsyncFn = (opts) => {
	let timesCalled = 0;
	const calculateDelayInMs = () => {
		const constant = opts.initialDelay;
		const base = opts.factor;
		let delay = constant * Math.pow(base, timesCalled);
		delay = applyJitter(delay, opts.jitter);
		return Math.min(opts.maxDelayBetweenRetries || delay, delay);
	};
	return async () => {
		await sleep(calculateDelayInMs());
		timesCalled++;
	};
};
/**
* Retries a callback until it succeeds or the shouldRetry function returns false.
* See {@link RetryOptions} for the available options.
*/
const retry = async (callback, options = {}) => {
	let iterations = 0;
	const { shouldRetry, initialDelay, maxDelayBetweenRetries, factor, retryImmediately, jitter, onBeforeRetry } = {
		...defaultOptions,
		...options
	};
	const delay = createExponentialDelayAsyncFn({
		initialDelay,
		maxDelayBetweenRetries,
		factor,
		jitter
	});
	while (true) try {
		return await callback();
	} catch (e) {
		iterations++;
		if (!shouldRetry(e, iterations)) throw e;
		if (onBeforeRetry) await onBeforeRetry(iterations);
		if (retryImmediately && iterations === 1) await sleep(applyJitter(RETRY_IMMEDIATELY_DELAY, jitter));
		else await delay();
	}
};

//#region src/loadScript.ts
const NO_DOCUMENT_ERROR = "loadScript cannot be called when document does not exist";
const NO_SRC_ERROR = "loadScript cannot be called without a src";
async function loadScript(src = "", opts) {
	const { async, defer, beforeLoad, crossOrigin, nonce } = opts || {};
	const load = () => {
		return new Promise((resolve, reject) => {
			if (!src) reject(new Error(NO_SRC_ERROR));
			if (!document || !document.body) reject(new Error(NO_DOCUMENT_ERROR));
			const script = document.createElement("script");
			if (crossOrigin) script.setAttribute("crossorigin", crossOrigin);
			script.async = async || false;
			script.defer = defer || false;
			script.addEventListener("load", () => {
				script.remove();
				resolve(script);
			});
			script.addEventListener("error", (event) => {
				script.remove();
				reject(event.error ?? /* @__PURE__ */ new Error(`failed to load script: ${src}`));
			});
			script.src = src;
			script.nonce = nonce;
			beforeLoad?.(script);
			document.body.appendChild(script);
		});
	};
	return retry(load, { shouldRetry: (_, iterations) => iterations <= 5 });
}

//#region src/proxy.ts
function isValidProxyUrl(key) {
	if (!key) return true;
	return isHttpOrHttps(key) || isProxyUrlRelative(key);
}
function isHttpOrHttps(key) {
	return /^http(s)?:\/\//.test(key || "");
}
function isProxyUrlRelative(key) {
	return key.startsWith("/");
}
function proxyUrlToAbsoluteURL(url) {
	if (!url) return "";
	return isProxyUrlRelative(url) ? new URL(url, window.location.origin).toString() : url;
}

function addClerkPrefix(str) {
	if (!str) return "";
	let regex;
	if (str.match(/^(clerk\.)+\w*$/)) regex = /(clerk\.)*(?=clerk\.)/;
	else if (str.match(/\.clerk.accounts/)) return str;
	else regex = /^(clerk\.)*/gi;
	return `clerk.${str.replace(regex, "")}`;
}

//#region src/versionSelector.ts
/**
* This version selector is a bit complicated, so here is the flow:
* 1. Use the clerkJSVersion prop on the provider
* 2. Use the exact `@clerk/clerk-js` version if it is a `@snapshot` prerelease
* 3. Use the prerelease tag of `@clerk/clerk-js` or the packageVersion provided
* 4. Fallback to the major version of `@clerk/clerk-js` or the packageVersion provided
* @param clerkJSVersion - The optional clerkJSVersion prop on the provider
* @param packageVersion - The version of `@clerk/clerk-js` that will be used if an explicit version is not provided
* @returns The npm tag, version or major version to use
*/
const versionSelector = (clerkJSVersion, packageVersion = "5.128.0") => {
	if (clerkJSVersion) return clerkJSVersion;
	const prereleaseTag = getPrereleaseTag(packageVersion);
	if (prereleaseTag) {
		if (prereleaseTag === "snapshot") return "5.128.0";
		return prereleaseTag;
	}
	return getMajorVersion(packageVersion);
};
const getPrereleaseTag = (packageVersion) => packageVersion.trim().replace(/^v/, "").match(/-(.+?)(\.|$)/)?.[1];
const getMajorVersion = (packageVersion) => packageVersion.trim().replace(/^v/, "").split(".")[0];

//#region src/loadClerkJsScript.ts
const ERROR_CODE = "failed_to_load_clerk_js";
const ERROR_CODE_TIMEOUT = "failed_to_load_clerk_js_timeout";
const FAILED_TO_LOAD_ERROR = "Failed to load Clerk";
const { isDevOrStagingUrl } = createDevOrStagingUrlCache();
const errorThrower = buildErrorThrower({ packageName: "@clerk/shared" });
/**
* Sets the package name for error messages during ClerkJS script loading.
*
* @param packageName - The name of the package to use in error messages (e.g., '@clerk/clerk-react').
* @example
* ```typescript
* setClerkJsLoadingErrorPackageName('@clerk/clerk-react');
* ```
*/
function setClerkJsLoadingErrorPackageName(packageName) {
	errorThrower.setPackageName({ packageName });
}
/**
* Validates that window.Clerk exists and is properly initialized.
* This ensures we don't have false positives where the script loads but Clerk is malformed.
*
* @returns `true` if window.Clerk exists and has the expected structure with a load method.
*/
function isClerkProperlyLoaded() {
	if (typeof window === "undefined" || !window.Clerk) return false;
	const clerk = window.Clerk;
	return typeof clerk === "object" && typeof clerk.load === "function";
}
/**
* Checks if an existing script has a request error using Performance API.
*
* @param scriptUrl - The URL of the script to check.
* @returns True if the script has failed to load due to a network/HTTP error.
*/
function hasScriptRequestError(scriptUrl) {
	if (typeof window === "undefined" || !window.performance) return false;
	const entries = performance.getEntriesByName(scriptUrl, "resource");
	if (entries.length === 0) return false;
	const scriptEntry = entries[entries.length - 1];
	if (scriptEntry.transferSize === 0 && scriptEntry.decodedBodySize === 0) {
		if (scriptEntry.responseEnd === 0) return true;
		if (scriptEntry.responseEnd > 0 && scriptEntry.responseStart > 0) return true;
		if ("responseStatus" in scriptEntry) {
			if (scriptEntry.responseStatus >= 400) return true;
			if (scriptEntry.responseStatus === 0) return true;
		}
	}
	return false;
}
/**
* Waits for Clerk to be properly loaded with a timeout mechanism.
* Uses polling to check if Clerk becomes available within the specified timeout.
*
* @param timeoutMs - Maximum time to wait in milliseconds.
* @param existingScript - The existing script element to wait for. Optional, for existing scripts.
* @returns Promise that resolves with null if Clerk loads successfully, or rejects with an error if timeout is reached.
*/
function waitForClerkWithTimeout(timeoutMs, existingScript) {
	return new Promise((resolve, reject) => {
		let resolved = false;
		const cleanup = (timeoutId$1, pollInterval$1) => {
			clearTimeout(timeoutId$1);
			clearInterval(pollInterval$1);
		};
		existingScript?.addEventListener("error", () => {
			cleanup(timeoutId, pollInterval);
			reject(new ClerkRuntimeError(FAILED_TO_LOAD_ERROR, { code: ERROR_CODE }));
		});
		const checkAndResolve = () => {
			if (resolved) return;
			if (isClerkProperlyLoaded()) {
				resolved = true;
				cleanup(timeoutId, pollInterval);
				resolve(null);
			}
		};
		const handleTimeout = () => {
			if (resolved) return;
			resolved = true;
			cleanup(timeoutId, pollInterval);
			if (!isClerkProperlyLoaded()) reject(new ClerkRuntimeError(FAILED_TO_LOAD_ERROR, { code: ERROR_CODE_TIMEOUT }));
			else resolve(null);
		};
		const timeoutId = setTimeout(handleTimeout, timeoutMs);
		checkAndResolve();
		const pollInterval = setInterval(() => {
			if (resolved) {
				clearInterval(pollInterval);
				return;
			}
			checkAndResolve();
		}, 100);
	});
}
/**
* Hotloads the Clerk JS script with robust failure detection and retry logic.
*
* For existing scripts:
* - If no request error detected: waits for timeout, then retries with loadScript if timeout expires
* - If request error detected: immediately retries with loadScript.
*
* For new scripts: uses loadScript which has built-in retry logic via the retry utility.
*
* @param opts - The options used to build the Clerk JS script URL and load the script.
*               Must include a `publishableKey` if no existing script is found.
* @returns Promise that resolves with null if Clerk loads successfully, or rejects with an error.
*
* @example
* ```typescript
* try {
*   await loadClerkJsScript({ publishableKey: 'pk_test_...' });
*   console.log('Clerk loaded successfully');
* } catch (error) {
*   console.error('Failed to load Clerk:', error.message);
* }
* ```
*/
const loadClerkJsScript = async (opts) => {
	const timeout = opts?.scriptLoadTimeout ?? 15e3;
	if (isClerkProperlyLoaded()) return null;
	if (!opts?.publishableKey) {
		errorThrower.throwMissingPublishableKeyError();
		return null;
	}
	const scriptUrl = clerkJsScriptUrl(opts);
	const existingScript = document.querySelector("script[data-clerk-js-script]");
	if (existingScript) if (hasScriptRequestError(scriptUrl)) existingScript.remove();
	else try {
		await waitForClerkWithTimeout(timeout, existingScript);
		return null;
	} catch {
		existingScript.remove();
	}
	const loadPromise = waitForClerkWithTimeout(timeout);
	loadScript(scriptUrl, {
		async: true,
		crossOrigin: "anonymous",
		nonce: opts.nonce,
		beforeLoad: applyClerkJsScriptAttributes(opts)
	}).catch((error) => {
		throw new ClerkRuntimeError(FAILED_TO_LOAD_ERROR + (error.message ? `, ${error.message}` : ""), {
			code: ERROR_CODE,
			cause: error
		});
	});
	return loadPromise;
};
/**
* Generates a Clerk JS script URL based on the provided options.
*
* @param opts - The options to use when building the Clerk JS script URL.
* @returns The complete URL to the Clerk JS script.
*
* @example
* ```typescript
* const url = clerkJsScriptUrl({ publishableKey: 'pk_test_...' });
* // Returns: "https://example.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
* ```
*/
const clerkJsScriptUrl = (opts) => {
	const { clerkJSUrl, clerkJSVariant, clerkJSVersion, proxyUrl, domain, publishableKey } = opts;
	if (clerkJSUrl) return clerkJSUrl;
	let scriptHost = "";
	if (!!proxyUrl && isValidProxyUrl(proxyUrl)) scriptHost = proxyUrlToAbsoluteURL(proxyUrl).replace(/http(s)?:\/\//, "");
	else if (domain && !isDevOrStagingUrl(parsePublishableKey(publishableKey)?.frontendApi || "")) scriptHost = addClerkPrefix(domain);
	else scriptHost = parsePublishableKey(publishableKey)?.frontendApi || "";
	const variant = clerkJSVariant ? `${clerkJSVariant.replace(/\.+$/, "")}.` : "";
	const version = versionSelector(clerkJSVersion);
	return `https://${scriptHost}/npm/@clerk/clerk-js@${version}/dist/clerk.${variant}browser.js`;
};
/**
* Builds an object of Clerk JS script attributes based on the provided options.
*
* @param options - The options containing the values for script attributes.
* @returns An object containing data attributes to be applied to the script element.
*/
const buildClerkJsScriptAttributes = (options) => {
	const obj = {};
	if (options.publishableKey) obj["data-clerk-publishable-key"] = options.publishableKey;
	if (options.proxyUrl) obj["data-clerk-proxy-url"] = options.proxyUrl;
	if (options.domain) obj["data-clerk-domain"] = options.domain;
	if (options.nonce) obj.nonce = options.nonce;
	return obj;
};
/**
* Returns a function that applies Clerk JS script attributes to a script element.
*
* @param options - The options containing the values for script attributes.
* @returns A function that accepts a script element and applies the attributes to it.
*/
const applyClerkJsScriptAttributes = (options) => (script) => {
	const attributes = buildClerkJsScriptAttributes(options);
	for (const attribute in attributes) script.setAttribute(attribute, attributes[attribute]);
};

//#region src/browser.ts
/**
* Checks if the window object is defined. You can also use this to check if something is happening on the client side.
* @returns {boolean}
*/
function inBrowser() {
	return typeof window !== "undefined";
}

//#region src/eventBus.ts
/**
* @internal
*/
const _on = (eventToHandlersMap, latestPayloadMap, event, handler, opts) => {
	const { notify } = opts || {};
	let handlers = eventToHandlersMap.get(event);
	if (!handlers) {
		handlers = [];
		eventToHandlersMap.set(event, handlers);
	}
	handlers.push(handler);
	if (notify && latestPayloadMap.has(event)) handler(latestPayloadMap.get(event));
};
/**
* @internal
*/
const _dispatch = (eventToHandlersMap, event, payload) => (eventToHandlersMap.get(event) || []).map((h) => h(payload));
/**
* @internal
*/
const _off = (eventToHandlersMap, event, handler) => {
	const handlers = eventToHandlersMap.get(event);
	if (handlers) if (handler) handlers.splice(handlers.indexOf(handler) >>> 0, 1);
	else eventToHandlersMap.set(event, []);
};
/**
* A ES6/2015 compatible 300 byte event bus
*
* Creates a strongly-typed event bus that enables publish/subscribe communication between components.
*
* @template Events - A record type that maps event names to their payload types
* @returns An EventBus instance with the following methods:
* - `on`: Subscribe to an event
* - `onPreDispatch`: Subscribe to an event, triggered before regular subscribers
* - `emit`: Publish an event with payload
* - `off`: Unsubscribe from an event
* - `offPreDispatch`: Unsubscribe from a pre-dispatch event
*
* @example
* // Define event types
* const eventBus = createEventBus<{
*   'user-login': { userId: string; timestamp: number };
*   'data-updated': { records: any[] };
*   'error': Error;
* }>();
*
* // Subscribe to events
* eventBus.on('user-login', ({ userId, timestamp }) => {
*   console.log(`User ${userId} logged in at ${timestamp}`);
* });
*
* // Subscribe with immediate notification if event was already dispatched
* eventBus.on('user-login', (payload) => {
*   // This will be called immediately if 'user-login' was previously dispatched
* }, { notify: true });
*
* // Publish an event
* eventBus.emit('user-login', { userId: 'abc123', timestamp: Date.now() });
*
* // Unsubscribe from event
* const handler = (payload) => console.log(payload);
* eventBus.on('error', handler);
* // Later...
* eventBus.off('error', handler);
*
* // Unsubscribe all handlers for an event
* eventBus.off('data-updated');
*/
const createEventBus = () => {
	const eventToHandlersMap = /* @__PURE__ */ new Map();
	const latestPayloadMap = /* @__PURE__ */ new Map();
	const eventToPredispatchHandlersMap = /* @__PURE__ */ new Map();
	const emit = (event, payload) => {
		latestPayloadMap.set(event, payload);
		_dispatch(eventToPredispatchHandlersMap, event, payload);
		_dispatch(eventToHandlersMap, event, payload);
	};
	return {
		on: (...args) => _on(eventToHandlersMap, latestPayloadMap, ...args),
		prioritizedOn: (...args) => _on(eventToPredispatchHandlersMap, latestPayloadMap, ...args),
		emit,
		off: (...args) => _off(eventToHandlersMap, ...args),
		prioritizedOff: (...args) => _off(eventToPredispatchHandlersMap, ...args),
		internal: { retrieveListeners: (event) => eventToHandlersMap.get(event) || [] }
	};
};

//#region src/clerkEventBus.ts
const clerkEvents = { Status: "status" };
const createClerkEventBus = () => {
	return createEventBus();
};

if (typeof window !== "undefined" && !window.global) {
  window.global = typeof global === "undefined" ? window : global;
}
withClerk(
  ({ clerk, children, ...props }) => {
    const {
      // @ts-expect-error - appearance is a valid prop for SignInProps & SignInButtonPropsModal
      appearance,
      signUpFallbackRedirectUrl,
      forceRedirectUrl,
      fallbackRedirectUrl,
      signUpForceRedirectUrl,
      mode,
      initialValues,
      withSignUp,
      oauthFlow,
      ...rest
    } = props;
    children = normalizeWithDefaultValue(children, "Sign in");
    const child = assertSingleChild(children)("SignInButton");
    const clickHandler = () => {
      const opts = {
        forceRedirectUrl,
        fallbackRedirectUrl,
        signUpFallbackRedirectUrl,
        signUpForceRedirectUrl,
        initialValues,
        withSignUp,
        oauthFlow
      };
      if (mode === "modal") {
        return clerk.openSignIn({ ...opts, appearance });
      }
      return clerk.redirectToSignIn({
        ...opts,
        signInFallbackRedirectUrl: fallbackRedirectUrl,
        signInForceRedirectUrl: forceRedirectUrl
      });
    };
    const wrappedChildClickHandler = async (e) => {
      if (child && typeof child === "object" && "props" in child) {
        await safeExecute(child.props.onClick)(e);
      }
      return clickHandler();
    };
    const childProps = { ...rest, onClick: wrappedChildClickHandler };
    return React6.cloneElement(child, childProps);
  },
  { component: "SignInButton", renderWhileLoading: true }
);
withClerk(
  ({ clerk, children, ...props }) => {
    const { redirectUrl, ...rest } = props;
    children = normalizeWithDefaultValue(children, "Sign in with Metamask");
    const child = assertSingleChild(children)("SignInWithMetamaskButton");
    const clickHandler = async () => {
      async function authenticate() {
        await clerk.authenticateWithMetamask({ redirectUrl: redirectUrl || void 0 });
      }
      void authenticate();
    };
    const wrappedChildClickHandler = async (e) => {
      await safeExecute(child.props.onClick)(e);
      return clickHandler();
    };
    const childProps = { ...rest, onClick: wrappedChildClickHandler };
    return React6.cloneElement(child, childProps);
  },
  { component: "SignInWithMetamask", renderWhileLoading: true }
);
withClerk(
  ({ clerk, children, ...props }) => {
    const { redirectUrl = "/", signOutOptions, ...rest } = props;
    children = normalizeWithDefaultValue(children, "Sign out");
    const child = assertSingleChild(children)("SignOutButton");
    const clickHandler = () => clerk.signOut({ redirectUrl, ...signOutOptions });
    const wrappedChildClickHandler = async (e) => {
      await safeExecute(child.props.onClick)(e);
      return clickHandler();
    };
    const childProps = { ...rest, onClick: wrappedChildClickHandler };
    return React6.cloneElement(child, childProps);
  },
  { component: "SignOutButton", renderWhileLoading: true }
);
withClerk(
  ({ clerk, children, ...props }) => {
    const {
      // @ts-expect-error - appearance is a valid prop for SignUpProps & SignUpButtonPropsModal
      appearance,
      // @ts-expect-error - unsafeMetadata is a valid prop for SignUpProps & SignUpButtonPropsModal
      unsafeMetadata,
      fallbackRedirectUrl,
      forceRedirectUrl,
      signInFallbackRedirectUrl,
      signInForceRedirectUrl,
      mode,
      initialValues,
      oauthFlow,
      ...rest
    } = props;
    children = normalizeWithDefaultValue(children, "Sign up");
    const child = assertSingleChild(children)("SignUpButton");
    const clickHandler = () => {
      const opts = {
        fallbackRedirectUrl,
        forceRedirectUrl,
        signInFallbackRedirectUrl,
        signInForceRedirectUrl,
        initialValues,
        oauthFlow
      };
      if (mode === "modal") {
        return clerk.openSignUp({
          ...opts,
          appearance,
          unsafeMetadata
        });
      }
      return clerk.redirectToSignUp({
        ...opts,
        signUpFallbackRedirectUrl: fallbackRedirectUrl,
        signUpForceRedirectUrl: forceRedirectUrl
      });
    };
    const wrappedChildClickHandler = async (e) => {
      if (child && typeof child === "object" && "props" in child) {
        await safeExecute(child.props.onClick)(e);
      }
      return clickHandler();
    };
    const childProps = { ...rest, onClick: wrappedChildClickHandler };
    return React6.cloneElement(child, childProps);
  },
  { component: "SignUpButton", renderWhileLoading: true }
);
var defaultSignInErrors = () => ({
  fields: {
    identifier: null,
    password: null,
    code: null
  },
  raw: null,
  global: null
});
var defaultSignUpErrors = () => ({
  fields: {
    firstName: null,
    lastName: null,
    emailAddress: null,
    phoneNumber: null,
    password: null,
    username: null,
    code: null,
    captcha: null,
    legalAccepted: null
  },
  raw: null,
  global: null
});
var StateProxy = class {
  constructor(isomorphicClerk) {
    this.isomorphicClerk = isomorphicClerk;
    this.signInSignalProxy = this.buildSignInProxy();
    this.signUpSignalProxy = this.buildSignUpProxy();
  }
  signInSignal() {
    return this.signInSignalProxy;
  }
  signUpSignal() {
    return this.signUpSignalProxy;
  }
  buildSignInProxy() {
    const gateProperty = this.gateProperty.bind(this);
    const target = () => this.client.signIn.__internal_future;
    return {
      errors: defaultSignInErrors(),
      fetchStatus: "idle",
      signIn: {
        status: "needs_identifier",
        availableStrategies: [],
        isTransferable: false,
        get id() {
          return gateProperty(target, "id", void 0);
        },
        get supportedFirstFactors() {
          return gateProperty(target, "supportedFirstFactors", []);
        },
        get supportedSecondFactors() {
          return gateProperty(target, "supportedSecondFactors", []);
        },
        get secondFactorVerification() {
          return gateProperty(target, "secondFactorVerification", {
            status: null,
            error: null,
            expireAt: null,
            externalVerificationRedirectURL: null,
            nonce: null,
            attempts: null,
            message: null,
            strategy: null,
            verifiedAtClient: null,
            verifiedFromTheSameClient: () => false,
            __internal_toSnapshot: () => {
              throw new Error("__internal_toSnapshot called before Clerk is loaded");
            },
            pathRoot: "",
            reload: () => {
              throw new Error("__internal_toSnapshot called before Clerk is loaded");
            }
          });
        },
        get identifier() {
          return gateProperty(target, "identifier", null);
        },
        get createdSessionId() {
          return gateProperty(target, "createdSessionId", null);
        },
        get userData() {
          return gateProperty(target, "userData", {});
        },
        get firstFactorVerification() {
          return gateProperty(target, "firstFactorVerification", {
            status: null,
            error: null,
            expireAt: null,
            externalVerificationRedirectURL: null,
            nonce: null,
            attempts: null,
            message: null,
            strategy: null,
            verifiedAtClient: null,
            verifiedFromTheSameClient: () => false,
            __internal_toSnapshot: () => {
              throw new Error("__internal_toSnapshot called before Clerk is loaded");
            },
            pathRoot: "",
            reload: () => {
              throw new Error("__internal_toSnapshot called before Clerk is loaded");
            }
          });
        },
        create: this.gateMethod(target, "create"),
        password: this.gateMethod(target, "password"),
        sso: this.gateMethod(target, "sso"),
        finalize: this.gateMethod(target, "finalize"),
        emailCode: this.wrapMethods(() => target().emailCode, ["sendCode", "verifyCode"]),
        emailLink: this.wrapStruct(
          () => target().emailLink,
          ["sendLink", "waitForVerification"],
          ["verification"],
          { verification: null }
        ),
        resetPasswordEmailCode: this.wrapMethods(() => target().resetPasswordEmailCode, [
          "sendCode",
          "verifyCode",
          "submitPassword"
        ]),
        phoneCode: this.wrapMethods(() => target().phoneCode, ["sendCode", "verifyCode"]),
        mfa: this.wrapMethods(() => target().mfa, [
          "sendPhoneCode",
          "verifyPhoneCode",
          "verifyTOTP",
          "verifyBackupCode"
        ]),
        ticket: this.gateMethod(target, "ticket"),
        passkey: this.gateMethod(target, "passkey"),
        web3: this.gateMethod(target, "web3")
      }
    };
  }
  buildSignUpProxy() {
    const gateProperty = this.gateProperty.bind(this);
    const gateMethod = this.gateMethod.bind(this);
    const wrapMethods = this.wrapMethods.bind(this);
    const target = () => this.client.signUp.__internal_future;
    return {
      errors: defaultSignUpErrors(),
      fetchStatus: "idle",
      signUp: {
        get id() {
          return gateProperty(target, "id", void 0);
        },
        get requiredFields() {
          return gateProperty(target, "requiredFields", []);
        },
        get optionalFields() {
          return gateProperty(target, "optionalFields", []);
        },
        get missingFields() {
          return gateProperty(target, "missingFields", []);
        },
        get username() {
          return gateProperty(target, "username", null);
        },
        get firstName() {
          return gateProperty(target, "firstName", null);
        },
        get lastName() {
          return gateProperty(target, "lastName", null);
        },
        get emailAddress() {
          return gateProperty(target, "emailAddress", null);
        },
        get phoneNumber() {
          return gateProperty(target, "phoneNumber", null);
        },
        get web3Wallet() {
          return gateProperty(target, "web3Wallet", null);
        },
        get hasPassword() {
          return gateProperty(target, "hasPassword", false);
        },
        get unsafeMetadata() {
          return gateProperty(target, "unsafeMetadata", {});
        },
        get createdSessionId() {
          return gateProperty(target, "createdSessionId", null);
        },
        get createdUserId() {
          return gateProperty(target, "createdUserId", null);
        },
        get abandonAt() {
          return gateProperty(target, "abandonAt", null);
        },
        get legalAcceptedAt() {
          return gateProperty(target, "legalAcceptedAt", null);
        },
        get locale() {
          return gateProperty(target, "locale", null);
        },
        get status() {
          return gateProperty(target, "status", "missing_requirements");
        },
        get unverifiedFields() {
          return gateProperty(target, "unverifiedFields", []);
        },
        get isTransferable() {
          return gateProperty(target, "isTransferable", false);
        },
        create: gateMethod(target, "create"),
        update: gateMethod(target, "update"),
        sso: gateMethod(target, "sso"),
        password: gateMethod(target, "password"),
        ticket: gateMethod(target, "ticket"),
        web3: gateMethod(target, "web3"),
        finalize: gateMethod(target, "finalize"),
        verifications: wrapMethods(() => target().verifications, [
          "sendEmailCode",
          "verifyEmailCode",
          "sendPhoneCode",
          "verifyPhoneCode"
        ])
      }
    };
  }
  __internal_effect(_) {
    throw new Error("__internal_effect called before Clerk is loaded");
  }
  __internal_computed(_) {
    throw new Error("__internal_computed called before Clerk is loaded");
  }
  get client() {
    const c = this.isomorphicClerk.client;
    if (!c) {
      throw new Error("Clerk client not ready");
    }
    return c;
  }
  gateProperty(getTarget, key, defaultValue) {
    return (() => {
      if (!inBrowser() || !this.isomorphicClerk.loaded) {
        return defaultValue;
      }
      const t = getTarget();
      return t[key];
    })();
  }
  gateMethod(getTarget, key) {
    return (async (...args) => {
      if (!inBrowser()) {
        return errorThrower$1.throw(`Attempted to call a method (${key}) that is not supported on the server.`);
      }
      if (!this.isomorphicClerk.loaded) {
        await new Promise((resolve) => this.isomorphicClerk.addOnLoaded(resolve));
      }
      const t = getTarget();
      return t[key].apply(t, args);
    });
  }
  wrapMethods(getTarget, keys) {
    return Object.fromEntries(keys.map((k) => [k, this.gateMethod(getTarget, k)]));
  }
  wrapStruct(getTarget, methods, getters, fallbacks) {
    const out = {};
    for (const m of methods) {
      out[m] = this.gateMethod(getTarget, m);
    }
    for (const g of getters) {
      Object.defineProperty(out, g, {
        get: () => this.gateProperty(getTarget, g, fallbacks[g]),
        enumerable: true
      });
    }
    return out;
  }
};
if (typeof globalThis.__BUILD_DISABLE_RHC__ === "undefined") {
  globalThis.__BUILD_DISABLE_RHC__ = false;
}
var SDK_METADATA = {
  name: "@clerk/clerk-react",
  version: "5.61.11",
  environment: "production"
};
var _status, _domain, _proxyUrl, _publishableKey, _eventBus, _stateProxy, _instance, _IsomorphicClerk_instances, waitForClerkJS_fn;
var _IsomorphicClerk = class _IsomorphicClerk2 {
  constructor(options) {
    __privateAdd(this, _IsomorphicClerk_instances);
    this.clerkjs = null;
    this.preopenOneTap = null;
    this.preopenUserVerification = null;
    this.preopenEnableOrganizationsPrompt = null;
    this.preopenSignIn = null;
    this.preopenCheckout = null;
    this.preopenPlanDetails = null;
    this.preopenSubscriptionDetails = null;
    this.preopenSignUp = null;
    this.preopenUserProfile = null;
    this.preopenOrganizationProfile = null;
    this.preopenCreateOrganization = null;
    this.preOpenWaitlist = null;
    this.premountSignInNodes = /* @__PURE__ */ new Map();
    this.premountSignUpNodes = /* @__PURE__ */ new Map();
    this.premountUserAvatarNodes = /* @__PURE__ */ new Map();
    this.premountUserProfileNodes = /* @__PURE__ */ new Map();
    this.premountUserButtonNodes = /* @__PURE__ */ new Map();
    this.premountOrganizationProfileNodes = /* @__PURE__ */ new Map();
    this.premountCreateOrganizationNodes = /* @__PURE__ */ new Map();
    this.premountOrganizationSwitcherNodes = /* @__PURE__ */ new Map();
    this.premountOrganizationListNodes = /* @__PURE__ */ new Map();
    this.premountMethodCalls = /* @__PURE__ */ new Map();
    this.premountWaitlistNodes = /* @__PURE__ */ new Map();
    this.premountPricingTableNodes = /* @__PURE__ */ new Map();
    this.premountAPIKeysNodes = /* @__PURE__ */ new Map();
    this.premountOAuthConsentNodes = /* @__PURE__ */ new Map();
    this.premountTaskChooseOrganizationNodes = /* @__PURE__ */ new Map();
    this.premountTaskResetPasswordNodes = /* @__PURE__ */ new Map();
    this.premountTaskSetupMFANodes = /* @__PURE__ */ new Map();
    this.premountAddListenerCalls = /* @__PURE__ */ new Map();
    this.loadedListeners = [];
    __privateAdd(this, _status, "loading");
    __privateAdd(this, _domain);
    __privateAdd(this, _proxyUrl);
    __privateAdd(this, _publishableKey);
    __privateAdd(this, _eventBus, createClerkEventBus());
    __privateAdd(this, _stateProxy);
    this.buildSignInUrl = (opts) => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildSignInUrl(opts)) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildSignInUrl", callback);
      }
    };
    this.buildSignUpUrl = (opts) => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildSignUpUrl(opts)) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildSignUpUrl", callback);
      }
    };
    this.buildAfterSignInUrl = (...args) => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildAfterSignInUrl(...args)) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildAfterSignInUrl", callback);
      }
    };
    this.buildAfterSignUpUrl = (...args) => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildAfterSignUpUrl(...args)) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildAfterSignUpUrl", callback);
      }
    };
    this.buildAfterSignOutUrl = () => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildAfterSignOutUrl()) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildAfterSignOutUrl", callback);
      }
    };
    this.buildNewSubscriptionRedirectUrl = () => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildNewSubscriptionRedirectUrl()) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildNewSubscriptionRedirectUrl", callback);
      }
    };
    this.buildAfterMultiSessionSingleSignOutUrl = () => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildAfterMultiSessionSingleSignOutUrl()) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildAfterMultiSessionSingleSignOutUrl", callback);
      }
    };
    this.buildUserProfileUrl = () => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildUserProfileUrl()) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildUserProfileUrl", callback);
      }
    };
    this.buildCreateOrganizationUrl = () => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildCreateOrganizationUrl()) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildCreateOrganizationUrl", callback);
      }
    };
    this.buildOrganizationProfileUrl = () => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildOrganizationProfileUrl()) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildOrganizationProfileUrl", callback);
      }
    };
    this.buildWaitlistUrl = () => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildWaitlistUrl()) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildWaitlistUrl", callback);
      }
    };
    this.buildTasksUrl = () => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildTasksUrl()) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildTasksUrl", callback);
      }
    };
    this.buildUrlWithAuth = (to) => {
      const callback = () => {
        var _a;
        return ((_a = this.clerkjs) == null ? void 0 : _a.buildUrlWithAuth(to)) || "";
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("buildUrlWithAuth", callback);
      }
    };
    this.handleUnauthenticated = async () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.handleUnauthenticated();
      };
      if (this.clerkjs && this.loaded) {
        void callback();
      } else {
        this.premountMethodCalls.set("handleUnauthenticated", callback);
      }
    };
    this.on = (...args) => {
      var _a;
      if ((_a = this.clerkjs) == null ? void 0 : _a.on) {
        return this.clerkjs.on(...args);
      } else {
        __privateGet(this, _eventBus).on(...args);
      }
    };
    this.off = (...args) => {
      var _a;
      if ((_a = this.clerkjs) == null ? void 0 : _a.off) {
        return this.clerkjs.off(...args);
      } else {
        __privateGet(this, _eventBus).off(...args);
      }
    };
    this.addOnLoaded = (cb) => {
      this.loadedListeners.push(cb);
      if (this.loaded) {
        this.emitLoaded();
      }
    };
    this.emitLoaded = () => {
      this.loadedListeners.forEach((cb) => cb());
      this.loadedListeners = [];
    };
    this.beforeLoad = (clerkjs) => {
      if (!clerkjs) {
        throw new Error("Failed to hydrate latest Clerk JS");
      }
    };
    this.hydrateClerkJS = (clerkjs) => {
      var _a, _b;
      if (!clerkjs) {
        throw new Error("Failed to hydrate latest Clerk JS");
      }
      this.clerkjs = clerkjs;
      this.premountMethodCalls.forEach((cb) => cb());
      this.premountAddListenerCalls.forEach((listenerHandlers, listener) => {
        listenerHandlers.nativeUnsubscribe = clerkjs.addListener(listener);
      });
      (_a = __privateGet(this, _eventBus).internal.retrieveListeners("status")) == null ? void 0 : _a.forEach((listener) => {
        this.on("status", listener, { notify: true });
      });
      (_b = __privateGet(this, _eventBus).internal.retrieveListeners("queryClientStatus")) == null ? void 0 : _b.forEach((listener) => {
        this.on("queryClientStatus", listener, { notify: true });
      });
      if (this.preopenSignIn !== null) {
        clerkjs.openSignIn(this.preopenSignIn);
      }
      if (this.preopenCheckout !== null) {
        clerkjs.__internal_openCheckout(this.preopenCheckout);
      }
      if (this.preopenPlanDetails !== null) {
        clerkjs.__internal_openPlanDetails(this.preopenPlanDetails);
      }
      if (this.preopenSubscriptionDetails !== null) {
        clerkjs.__internal_openSubscriptionDetails(this.preopenSubscriptionDetails);
      }
      if (this.preopenSignUp !== null) {
        clerkjs.openSignUp(this.preopenSignUp);
      }
      if (this.preopenUserProfile !== null) {
        clerkjs.openUserProfile(this.preopenUserProfile);
      }
      if (this.preopenUserVerification !== null) {
        clerkjs.__internal_openReverification(this.preopenUserVerification);
      }
      if (this.preopenOneTap !== null) {
        clerkjs.openGoogleOneTap(this.preopenOneTap);
      }
      if (this.preopenOrganizationProfile !== null) {
        clerkjs.openOrganizationProfile(this.preopenOrganizationProfile);
      }
      if (this.preopenCreateOrganization !== null) {
        clerkjs.openCreateOrganization(this.preopenCreateOrganization);
      }
      if (this.preOpenWaitlist !== null) {
        clerkjs.openWaitlist(this.preOpenWaitlist);
      }
      if (this.preopenEnableOrganizationsPrompt) {
        clerkjs.__internal_openEnableOrganizationsPrompt(this.preopenEnableOrganizationsPrompt);
      }
      this.premountSignInNodes.forEach((props, node) => {
        clerkjs.mountSignIn(node, props);
      });
      this.premountSignUpNodes.forEach((props, node) => {
        clerkjs.mountSignUp(node, props);
      });
      this.premountUserProfileNodes.forEach((props, node) => {
        clerkjs.mountUserProfile(node, props);
      });
      this.premountUserAvatarNodes.forEach((props, node) => {
        clerkjs.mountUserAvatar(node, props);
      });
      this.premountUserButtonNodes.forEach((props, node) => {
        clerkjs.mountUserButton(node, props);
      });
      this.premountOrganizationListNodes.forEach((props, node) => {
        clerkjs.mountOrganizationList(node, props);
      });
      this.premountWaitlistNodes.forEach((props, node) => {
        clerkjs.mountWaitlist(node, props);
      });
      this.premountPricingTableNodes.forEach((props, node) => {
        clerkjs.mountPricingTable(node, props);
      });
      this.premountAPIKeysNodes.forEach((props, node) => {
        clerkjs.mountAPIKeys(node, props);
      });
      this.premountOAuthConsentNodes.forEach((props, node) => {
        clerkjs.__internal_mountOAuthConsent(node, props);
      });
      this.premountTaskChooseOrganizationNodes.forEach((props, node) => {
        clerkjs.mountTaskChooseOrganization(node, props);
      });
      this.premountTaskResetPasswordNodes.forEach((props, node) => {
        clerkjs.mountTaskResetPassword(node, props);
      });
      this.premountTaskSetupMFANodes.forEach((props, node) => {
        clerkjs.mountTaskSetupMFA(node, props);
      });
      if (typeof this.clerkjs.status === "undefined") {
        __privateGet(this, _eventBus).emit(clerkEvents.Status, "ready");
      }
      this.emitLoaded();
      return this.clerkjs;
    };
    this.__experimental_checkout = (...args) => {
      var _a;
      return (_a = this.clerkjs) == null ? void 0 : _a.__experimental_checkout(...args);
    };
    this.__unstable__updateProps = async (props) => {
      const clerkjs = await __privateMethod(this, _IsomorphicClerk_instances, waitForClerkJS_fn).call(this);
      if (clerkjs && "__unstable__updateProps" in clerkjs) {
        return clerkjs.__unstable__updateProps(props);
      }
    };
    this.setActive = (params) => {
      if (this.clerkjs) {
        return this.clerkjs.setActive(params);
      } else {
        return Promise.reject();
      }
    };
    this.openSignIn = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.openSignIn(props);
      } else {
        this.preopenSignIn = props;
      }
    };
    this.closeSignIn = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.closeSignIn();
      } else {
        this.preopenSignIn = null;
      }
    };
    this.__internal_openCheckout = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_openCheckout(props);
      } else {
        this.preopenCheckout = props;
      }
    };
    this.__internal_closeCheckout = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_closeCheckout();
      } else {
        this.preopenCheckout = null;
      }
    };
    this.__internal_openPlanDetails = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_openPlanDetails(props);
      } else {
        this.preopenPlanDetails = props;
      }
    };
    this.__internal_closePlanDetails = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_closePlanDetails();
      } else {
        this.preopenPlanDetails = null;
      }
    };
    this.__internal_openSubscriptionDetails = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_openSubscriptionDetails(props);
      } else {
        this.preopenSubscriptionDetails = props != null ? props : null;
      }
    };
    this.__internal_closeSubscriptionDetails = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_closeSubscriptionDetails();
      } else {
        this.preopenSubscriptionDetails = null;
      }
    };
    this.__internal_openReverification = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_openReverification(props);
      } else {
        this.preopenUserVerification = props;
      }
    };
    this.__internal_closeReverification = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_closeReverification();
      } else {
        this.preopenUserVerification = null;
      }
    };
    this.__internal_openEnableOrganizationsPrompt = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_openEnableOrganizationsPrompt(props);
      } else {
        this.preopenEnableOrganizationsPrompt = props;
      }
    };
    this.__internal_closeEnableOrganizationsPrompt = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_closeEnableOrganizationsPrompt();
      } else {
        this.preopenEnableOrganizationsPrompt = null;
      }
    };
    this.openGoogleOneTap = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.openGoogleOneTap(props);
      } else {
        this.preopenOneTap = props;
      }
    };
    this.closeGoogleOneTap = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.closeGoogleOneTap();
      } else {
        this.preopenOneTap = null;
      }
    };
    this.openUserProfile = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.openUserProfile(props);
      } else {
        this.preopenUserProfile = props;
      }
    };
    this.closeUserProfile = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.closeUserProfile();
      } else {
        this.preopenUserProfile = null;
      }
    };
    this.openOrganizationProfile = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.openOrganizationProfile(props);
      } else {
        this.preopenOrganizationProfile = props;
      }
    };
    this.closeOrganizationProfile = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.closeOrganizationProfile();
      } else {
        this.preopenOrganizationProfile = null;
      }
    };
    this.openCreateOrganization = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.openCreateOrganization(props);
      } else {
        this.preopenCreateOrganization = props;
      }
    };
    this.closeCreateOrganization = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.closeCreateOrganization();
      } else {
        this.preopenCreateOrganization = null;
      }
    };
    this.openWaitlist = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.openWaitlist(props);
      } else {
        this.preOpenWaitlist = props;
      }
    };
    this.closeWaitlist = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.closeWaitlist();
      } else {
        this.preOpenWaitlist = null;
      }
    };
    this.openSignUp = (props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.openSignUp(props);
      } else {
        this.preopenSignUp = props;
      }
    };
    this.closeSignUp = () => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.closeSignUp();
      } else {
        this.preopenSignUp = null;
      }
    };
    this.mountSignIn = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountSignIn(node, props);
      } else {
        this.premountSignInNodes.set(node, props);
      }
    };
    this.unmountSignIn = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountSignIn(node);
      } else {
        this.premountSignInNodes.delete(node);
      }
    };
    this.mountSignUp = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountSignUp(node, props);
      } else {
        this.premountSignUpNodes.set(node, props);
      }
    };
    this.unmountSignUp = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountSignUp(node);
      } else {
        this.premountSignUpNodes.delete(node);
      }
    };
    this.mountUserAvatar = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountUserAvatar(node, props);
      } else {
        this.premountUserAvatarNodes.set(node, props);
      }
    };
    this.unmountUserAvatar = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountUserAvatar(node);
      } else {
        this.premountUserAvatarNodes.delete(node);
      }
    };
    this.mountUserProfile = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountUserProfile(node, props);
      } else {
        this.premountUserProfileNodes.set(node, props);
      }
    };
    this.unmountUserProfile = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountUserProfile(node);
      } else {
        this.premountUserProfileNodes.delete(node);
      }
    };
    this.mountOrganizationProfile = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountOrganizationProfile(node, props);
      } else {
        this.premountOrganizationProfileNodes.set(node, props);
      }
    };
    this.unmountOrganizationProfile = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountOrganizationProfile(node);
      } else {
        this.premountOrganizationProfileNodes.delete(node);
      }
    };
    this.mountCreateOrganization = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountCreateOrganization(node, props);
      } else {
        this.premountCreateOrganizationNodes.set(node, props);
      }
    };
    this.unmountCreateOrganization = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountCreateOrganization(node);
      } else {
        this.premountCreateOrganizationNodes.delete(node);
      }
    };
    this.mountOrganizationSwitcher = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountOrganizationSwitcher(node, props);
      } else {
        this.premountOrganizationSwitcherNodes.set(node, props);
      }
    };
    this.unmountOrganizationSwitcher = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountOrganizationSwitcher(node);
      } else {
        this.premountOrganizationSwitcherNodes.delete(node);
      }
    };
    this.__experimental_prefetchOrganizationSwitcher = () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.__experimental_prefetchOrganizationSwitcher();
      };
      if (this.clerkjs && this.loaded) {
        void callback();
      } else {
        this.premountMethodCalls.set("__experimental_prefetchOrganizationSwitcher", callback);
      }
    };
    this.mountOrganizationList = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountOrganizationList(node, props);
      } else {
        this.premountOrganizationListNodes.set(node, props);
      }
    };
    this.unmountOrganizationList = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountOrganizationList(node);
      } else {
        this.premountOrganizationListNodes.delete(node);
      }
    };
    this.mountUserButton = (node, userButtonProps) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountUserButton(node, userButtonProps);
      } else {
        this.premountUserButtonNodes.set(node, userButtonProps);
      }
    };
    this.unmountUserButton = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountUserButton(node);
      } else {
        this.premountUserButtonNodes.delete(node);
      }
    };
    this.mountWaitlist = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountWaitlist(node, props);
      } else {
        this.premountWaitlistNodes.set(node, props);
      }
    };
    this.unmountWaitlist = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountWaitlist(node);
      } else {
        this.premountWaitlistNodes.delete(node);
      }
    };
    this.mountPricingTable = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountPricingTable(node, props);
      } else {
        this.premountPricingTableNodes.set(node, props);
      }
    };
    this.unmountPricingTable = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountPricingTable(node);
      } else {
        this.premountPricingTableNodes.delete(node);
      }
    };
    this.mountAPIKeys = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountAPIKeys(node, props);
      } else {
        this.premountAPIKeysNodes.set(node, props);
      }
    };
    this.unmountAPIKeys = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountAPIKeys(node);
      } else {
        this.premountAPIKeysNodes.delete(node);
      }
    };
    this.__internal_mountOAuthConsent = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_mountOAuthConsent(node, props);
      } else {
        this.premountOAuthConsentNodes.set(node, props);
      }
    };
    this.__internal_unmountOAuthConsent = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.__internal_unmountOAuthConsent(node);
      } else {
        this.premountOAuthConsentNodes.delete(node);
      }
    };
    this.mountTaskChooseOrganization = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountTaskChooseOrganization(node, props);
      } else {
        this.premountTaskChooseOrganizationNodes.set(node, props);
      }
    };
    this.unmountTaskChooseOrganization = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountTaskChooseOrganization(node);
      } else {
        this.premountTaskChooseOrganizationNodes.delete(node);
      }
    };
    this.mountTaskResetPassword = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountTaskResetPassword(node, props);
      } else {
        this.premountTaskResetPasswordNodes.set(node, props);
      }
    };
    this.unmountTaskResetPassword = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountTaskResetPassword(node);
      } else {
        this.premountTaskResetPasswordNodes.delete(node);
      }
    };
    this.mountTaskSetupMFA = (node, props) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.mountTaskSetupMFA(node, props);
      } else {
        this.premountTaskSetupMFANodes.set(node, props);
      }
    };
    this.unmountTaskSetupMFA = (node) => {
      if (this.clerkjs && this.loaded) {
        this.clerkjs.unmountTaskSetupMFA(node);
      } else {
        this.premountTaskSetupMFANodes.delete(node);
      }
    };
    this.addListener = (listener) => {
      if (this.clerkjs) {
        return this.clerkjs.addListener(listener);
      } else {
        const unsubscribe = () => {
          var _a;
          const listenerHandlers = this.premountAddListenerCalls.get(listener);
          if (listenerHandlers) {
            (_a = listenerHandlers.nativeUnsubscribe) == null ? void 0 : _a.call(listenerHandlers);
            this.premountAddListenerCalls.delete(listener);
          }
        };
        this.premountAddListenerCalls.set(listener, { unsubscribe, nativeUnsubscribe: void 0 });
        return unsubscribe;
      }
    };
    this.navigate = (to) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.navigate(to);
      };
      if (this.clerkjs && this.loaded) {
        void callback();
      } else {
        this.premountMethodCalls.set("navigate", callback);
      }
    };
    this.redirectWithAuth = async (...args) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectWithAuth(...args);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectWithAuth", callback);
        return;
      }
    };
    this.redirectToSignIn = async (opts) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToSignIn(opts);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectToSignIn", callback);
        return;
      }
    };
    this.redirectToSignUp = async (opts) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToSignUp(opts);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectToSignUp", callback);
        return;
      }
    };
    this.redirectToUserProfile = async () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToUserProfile();
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectToUserProfile", callback);
        return;
      }
    };
    this.redirectToAfterSignUp = () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToAfterSignUp();
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectToAfterSignUp", callback);
      }
    };
    this.redirectToAfterSignIn = () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToAfterSignIn();
      };
      if (this.clerkjs && this.loaded) {
        callback();
      } else {
        this.premountMethodCalls.set("redirectToAfterSignIn", callback);
      }
    };
    this.redirectToAfterSignOut = () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToAfterSignOut();
      };
      if (this.clerkjs && this.loaded) {
        callback();
      } else {
        this.premountMethodCalls.set("redirectToAfterSignOut", callback);
      }
    };
    this.redirectToOrganizationProfile = async () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToOrganizationProfile();
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectToOrganizationProfile", callback);
        return;
      }
    };
    this.redirectToCreateOrganization = async () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToCreateOrganization();
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectToCreateOrganization", callback);
        return;
      }
    };
    this.redirectToWaitlist = async () => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToWaitlist();
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectToWaitlist", callback);
        return;
      }
    };
    this.redirectToTasks = async (opts) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.redirectToTasks(opts);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("redirectToTasks", callback);
        return;
      }
    };
    this.handleRedirectCallback = async (params) => {
      var _a;
      const callback = () => {
        var _a2;
        return (_a2 = this.clerkjs) == null ? void 0 : _a2.handleRedirectCallback(params);
      };
      if (this.clerkjs && this.loaded) {
        void ((_a = callback()) == null ? void 0 : _a.catch(() => {
        }));
      } else {
        this.premountMethodCalls.set("handleRedirectCallback", callback);
      }
    };
    this.handleGoogleOneTapCallback = async (signInOrUp, params) => {
      var _a;
      const callback = () => {
        var _a2;
        return (_a2 = this.clerkjs) == null ? void 0 : _a2.handleGoogleOneTapCallback(signInOrUp, params);
      };
      if (this.clerkjs && this.loaded) {
        void ((_a = callback()) == null ? void 0 : _a.catch(() => {
        }));
      } else {
        this.premountMethodCalls.set("handleGoogleOneTapCallback", callback);
      }
    };
    this.handleEmailLinkVerification = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.handleEmailLinkVerification(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("handleEmailLinkVerification", callback);
      }
    };
    this.authenticateWithMetamask = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.authenticateWithMetamask(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("authenticateWithMetamask", callback);
      }
    };
    this.authenticateWithCoinbaseWallet = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.authenticateWithCoinbaseWallet(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("authenticateWithCoinbaseWallet", callback);
      }
    };
    this.authenticateWithBase = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.authenticateWithBase(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("authenticateWithBase", callback);
      }
    };
    this.authenticateWithOKXWallet = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.authenticateWithOKXWallet(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("authenticateWithOKXWallet", callback);
      }
    };
    this.authenticateWithSolana = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.authenticateWithSolana(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("authenticateWithSolana", callback);
      }
    };
    this.authenticateWithWeb3 = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.authenticateWithWeb3(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("authenticateWithWeb3", callback);
      }
    };
    this.authenticateWithGoogleOneTap = async (params) => {
      const clerkjs = await __privateMethod(this, _IsomorphicClerk_instances, waitForClerkJS_fn).call(this);
      return clerkjs.authenticateWithGoogleOneTap(params);
    };
    this.__internal_loadStripeJs = async () => {
      const clerkjs = await __privateMethod(this, _IsomorphicClerk_instances, waitForClerkJS_fn).call(this);
      return clerkjs.__internal_loadStripeJs();
    };
    this.createOrganization = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.createOrganization(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("createOrganization", callback);
      }
    };
    this.getOrganization = async (organizationId) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.getOrganization(organizationId);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("getOrganization", callback);
      }
    };
    this.joinWaitlist = async (params) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.joinWaitlist(params);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("joinWaitlist", callback);
      }
    };
    this.signOut = async (...args) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.signOut(...args);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("signOut", callback);
      }
    };
    this.__internal_attemptToEnableEnvironmentSetting = (options2) => {
      const callback = () => {
        var _a;
        return (_a = this.clerkjs) == null ? void 0 : _a.__internal_attemptToEnableEnvironmentSetting(options2);
      };
      if (this.clerkjs && this.loaded) {
        return callback();
      } else {
        this.premountMethodCalls.set("__internal_attemptToEnableEnvironmentSetting", callback);
      }
    };
    const { Clerk = null, publishableKey } = options || {};
    __privateSet(this, _publishableKey, publishableKey);
    __privateSet(this, _proxyUrl, options == null ? void 0 : options.proxyUrl);
    __privateSet(this, _domain, options == null ? void 0 : options.domain);
    this.options = options;
    this.Clerk = Clerk;
    this.mode = inBrowser() ? "browser" : "server";
    __privateSet(this, _stateProxy, new StateProxy(this));
    if (!this.options.sdkMetadata) {
      this.options.sdkMetadata = SDK_METADATA;
    }
    __privateGet(this, _eventBus).emit(clerkEvents.Status, "loading");
    __privateGet(this, _eventBus).prioritizedOn(clerkEvents.Status, (status) => __privateSet(this, _status, status));
    if (__privateGet(this, _publishableKey)) {
      void this.loadClerkJS();
    }
  }
  get publishableKey() {
    return __privateGet(this, _publishableKey);
  }
  get loaded() {
    var _a;
    return ((_a = this.clerkjs) == null ? void 0 : _a.loaded) || false;
  }
  get status() {
    var _a;
    if (!this.clerkjs) {
      return __privateGet(this, _status);
    }
    return ((_a = this.clerkjs) == null ? void 0 : _a.status) || /**
    * Support older clerk-js versions.
    * If clerk-js is available but `.status` is missing it we need to fallback to `.loaded`.
    * Since "degraded" an "error" did not exist before,
    * map "loaded" to "ready" and "not loaded" to "loading".
    */
    (this.clerkjs.loaded ? "ready" : "loading");
  }
  static getOrCreateInstance(options) {
    if (!inBrowser() || !__privateGet(this, _instance) || options.Clerk && __privateGet(this, _instance).Clerk !== options.Clerk || // Allow hot swapping PKs on the client
    __privateGet(this, _instance).publishableKey !== options.publishableKey) {
      __privateSet(this, _instance, new _IsomorphicClerk2(options));
    }
    return __privateGet(this, _instance);
  }
  static clearInstance() {
    __privateSet(this, _instance, null);
  }
  get domain() {
    if (typeof window !== "undefined" && window.location) {
      return handleValueOrFn(__privateGet(this, _domain), new URL(window.location.href), "");
    }
    if (typeof __privateGet(this, _domain) === "function") {
      return errorThrower$1.throw(unsupportedNonBrowserDomainOrProxyUrlFunction);
    }
    return __privateGet(this, _domain) || "";
  }
  get proxyUrl() {
    if (typeof window !== "undefined" && window.location) {
      return handleValueOrFn(__privateGet(this, _proxyUrl), new URL(window.location.href), "");
    }
    if (typeof __privateGet(this, _proxyUrl) === "function") {
      return errorThrower$1.throw(unsupportedNonBrowserDomainOrProxyUrlFunction);
    }
    return __privateGet(this, _proxyUrl) || "";
  }
  /**
   * Accesses private options from the `Clerk` instance and defaults to
   * `IsomorphicClerk` options when in SSR context.
   *  @internal
   */
  __internal_getOption(key) {
    var _a, _b;
    return ((_a = this.clerkjs) == null ? void 0 : _a.__internal_getOption) ? (_b = this.clerkjs) == null ? void 0 : _b.__internal_getOption(key) : this.options[key];
  }
  get sdkMetadata() {
    var _a;
    return ((_a = this.clerkjs) == null ? void 0 : _a.sdkMetadata) || this.options.sdkMetadata || void 0;
  }
  get instanceType() {
    var _a;
    return (_a = this.clerkjs) == null ? void 0 : _a.instanceType;
  }
  get frontendApi() {
    var _a;
    return ((_a = this.clerkjs) == null ? void 0 : _a.frontendApi) || "";
  }
  get isStandardBrowser() {
    var _a;
    return ((_a = this.clerkjs) == null ? void 0 : _a.isStandardBrowser) || this.options.standardBrowser || false;
  }
  get __internal_queryClient() {
    var _a;
    return (_a = this.clerkjs) == null ? void 0 : _a.__internal_queryClient;
  }
  get isSatellite() {
    if (typeof window !== "undefined" && window.location) {
      return handleValueOrFn(this.options.isSatellite, new URL(window.location.href), false);
    }
    if (typeof this.options.isSatellite === "function") {
      return errorThrower$1.throw(unsupportedNonBrowserDomainOrProxyUrlFunction);
    }
    return false;
  }
  async loadClerkJS() {
    var _a;
    if (this.mode !== "browser" || this.loaded) {
      return;
    }
    if (typeof window !== "undefined") {
      window.__clerk_publishable_key = __privateGet(this, _publishableKey);
      window.__clerk_proxy_url = this.proxyUrl;
      window.__clerk_domain = this.domain;
    }
    try {
      if (this.Clerk) {
        let c;
        if (isConstructor(this.Clerk)) {
          c = new this.Clerk(__privateGet(this, _publishableKey), {
            proxyUrl: this.proxyUrl,
            domain: this.domain
          });
          this.beforeLoad(c);
          await c.load(this.options);
        } else {
          c = this.Clerk;
          if (!c.loaded) {
            this.beforeLoad(c);
            await c.load(this.options);
          }
        }
        global.Clerk = c;
      } else if (!__BUILD_DISABLE_RHC__) {
        if (!global.Clerk) {
          await loadClerkJsScript({
            ...this.options,
            publishableKey: __privateGet(this, _publishableKey),
            proxyUrl: this.proxyUrl,
            domain: this.domain,
            nonce: this.options.nonce
          });
        }
        if (!global.Clerk) {
          throw new Error("Failed to download latest ClerkJS. Contact support@clerk.com.");
        }
        this.beforeLoad(global.Clerk);
        await global.Clerk.load(this.options);
      }
      if ((_a = global.Clerk) == null ? void 0 : _a.loaded) {
        return this.hydrateClerkJS(global.Clerk);
      }
      return;
    } catch (err) {
      const error = err;
      __privateGet(this, _eventBus).emit(clerkEvents.Status, "error");
      console.error(error.stack || error.message || error);
      return;
    }
  }
  get version() {
    var _a;
    return (_a = this.clerkjs) == null ? void 0 : _a.version;
  }
  get client() {
    if (this.clerkjs) {
      return this.clerkjs.client;
    } else {
      return void 0;
    }
  }
  get session() {
    if (this.clerkjs) {
      return this.clerkjs.session;
    } else {
      return void 0;
    }
  }
  get user() {
    if (this.clerkjs) {
      return this.clerkjs.user;
    } else {
      return void 0;
    }
  }
  get organization() {
    if (this.clerkjs) {
      return this.clerkjs.organization;
    } else {
      return void 0;
    }
  }
  get telemetry() {
    if (this.clerkjs) {
      return this.clerkjs.telemetry;
    } else {
      return void 0;
    }
  }
  get __unstable__environment() {
    if (this.clerkjs) {
      return this.clerkjs.__unstable__environment;
    } else {
      return void 0;
    }
  }
  get isSignedIn() {
    if (this.clerkjs) {
      return this.clerkjs.isSignedIn;
    } else {
      return false;
    }
  }
  get billing() {
    var _a;
    return (_a = this.clerkjs) == null ? void 0 : _a.billing;
  }
  get __internal_state() {
    return this.loaded && this.clerkjs ? this.clerkjs.__internal_state : __privateGet(this, _stateProxy);
  }
  get apiKeys() {
    var _a;
    return (_a = this.clerkjs) == null ? void 0 : _a.apiKeys;
  }
  __unstable__setEnvironment(...args) {
    if (this.clerkjs && "__unstable__setEnvironment" in this.clerkjs) {
      this.clerkjs.__unstable__setEnvironment(args);
    } else {
      return void 0;
    }
  }
};
_status = /* @__PURE__ */ new WeakMap();
_domain = /* @__PURE__ */ new WeakMap();
_proxyUrl = /* @__PURE__ */ new WeakMap();
_publishableKey = /* @__PURE__ */ new WeakMap();
_eventBus = /* @__PURE__ */ new WeakMap();
_stateProxy = /* @__PURE__ */ new WeakMap();
_instance = /* @__PURE__ */ new WeakMap();
_IsomorphicClerk_instances = /* @__PURE__ */ new WeakSet();
waitForClerkJS_fn = function() {
  return new Promise((resolve) => {
    this.addOnLoaded(() => resolve(this.clerkjs));
  });
};
__privateAdd(_IsomorphicClerk, _instance);
setErrorThrowerOptions({ packageName: "@clerk/clerk-react" });
setClerkJsLoadingErrorPackageName("@clerk/clerk-react");

const FIRST_COLLECTION_NAME = "My components";
function findSavedIn(collections, item) {
  return collections.find(
    (c) => c.collection_items?.some((i) => i.component_type === item.type && i.component_path === item.path)
  );
}
let queue = Promise.resolve();
function saveComponent(api, token, item, known) {
  const run = queue.then(() => saveNow(api, token, item, known));
  queue = run.catch(() => {
  });
  return run;
}
function whenSavesSettled() {
  return queue.then(() => void 0);
}
async function saveNow(api, token, item, known) {
  const collections = known?.length ? known : await api.list(token);
  const existing = findSavedIn(collections, item);
  if (existing) return { status: "already", collection: existing };
  if (collections.length === 0) {
    const created = await api.create(token, FIRST_COLLECTION_NAME);
    const added2 = await api.addItem(token, created.id, item);
    return { status: "first", collection: { ...created, collection_items: [added2] } };
  }
  const target = collections[0];
  const added = await api.addItem(token, target.id, item);
  return { status: "added", collection: { ...target, collection_items: [...target.collection_items ?? [], added] } };
}
function myComponentsUrl(collectionId) {
  return collectionId ? `/my-components?collection=${encodeURIComponent(collectionId)}` : "/my-components";
}
const COLLECTIONS_CHANGED_EVENT = "aitmpl:collections-changed";

function ClerkIsland() {
  reactExports.useEffect(() => {
  }, []);
  return null;
}

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _b;
const $$Astro = createAstro("https://www.aitmpl.com");
const $$DashboardLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$DashboardLayout;
  const {
    title = "Claude Code Templates",
    description = "Browse and install 1000+ components for Claude Code: AI agents, slash commands, MCP integrations, hooks, settings, and skills. Free, open-source CLI tool.",
    ogImage = "/og/site.png",
    ogImageAlt
  } = Astro2.props;
  const ogImageSized = ogImage.startsWith("/og/");
  const canonicalURL = new URL(Astro2.url.pathname, Astro2.site);
  const gaId = "";
  const ogImageURL = new URL(ogImage, Astro2.site).href;
  const schemaData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://www.aitmpl.com/#website",
        "url": "https://www.aitmpl.com/",
        "name": "Claude Code Templates",
        "description": "Marketplace for Claude Code components: agents, commands, skills, settings, hooks, and MCPs",
        "publisher": { "@id": "https://www.aitmpl.com/#organization" }
      },
      {
        "@type": "Organization",
        "@id": "https://www.aitmpl.com/#organization",
        "name": "Claude Code Templates",
        "url": "https://www.aitmpl.com/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.aitmpl.com/logo.png"
        },
        "sameAs": [
          "https://github.com/davila7/claude-code-templates",
          "https://www.npmjs.com/package/claude-code-templates"
        ],
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "technical support",
          "email": "daniel@aitmpl.com",
          "url": "https://github.com/davila7/claude-code-templates/issues",
          "availableLanguage": ["English", "Spanish"]
        }
      }
    ]
  });
  return renderTemplate(_b || (_b = __template(['<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>', '</title><meta name="description"', '><link rel="canonical"', '><link rel="service-desc" type="application/vnd.oai.openapi+json" href="/openapi.json"><!-- Open Graph --><meta property="og:type" content="website"><meta property="og:url"', '><meta property="og:title"', '><meta property="og:description"', '><meta property="og:image"', ">", "", "", '<meta property="og:site_name" content="Claude Code Templates"><!-- Twitter Card --><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', ">", '<!-- Structured Data --><script type="application/ld+json">', '</script><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><!-- Preload LCP image (sidebar logo, visible on every page above the fold) --><link rel="preload" href="/logo.webp" as="image" type="image/webp"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>', '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">', `</head> <body class="bg-[var(--color-surface-0)] text-[var(--color-text-primary)] transition-colors duration-200 overflow-x-hidden"> <script>
      // Initialize theme on page load (prevent flash)
      (function() {
        var stored = localStorage.getItem('claude-theme');
        var theme = (stored === 'light' || stored === 'dark') ? stored
          : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        var html = document.documentElement;
        html.classList.remove('light', 'dark');
        html.classList.add(theme);
      })();
    </script> <div class="flex h-screen overflow-hidden"> <!-- Mobile sidebar overlay --> <div id="sidebar-overlay" class="hidden md:hidden fixed inset-0 bg-black/50 z-30"></div> <!-- Sidebar (fixed and out of flow — width/position must not affect
           the flex layout below, or it pushes main content off-screen) --> <aside id="sidebar" class="w-[220px] flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-0)] fixed inset-y-0 left-0 z-40 -translate-x-full md:translate-x-0 transition-all duration-300 ease-in-out" data-collapsed="false" data-mobile-open="false"> `, ' </aside> <!-- Main content --> <main id="main-content" class="flex-1 min-w-0 md:ml-[220px] overflow-y-auto bg-[var(--color-surface-0)] transition-all duration-300 ease-in-out"> ', ' <footer class="border-t border-[var(--color-border)] mt-12 py-6 px-6 text-center text-sm text-[var(--color-text-secondary)]"> <nav aria-label="Site" class="flex items-center justify-center gap-4 flex-wrap mb-4 text-[12px]"> <a href="/about" class="hover:text-[var(--color-text-primary)] transition-colors">About</a> <a href="/privacy" class="hover:text-[var(--color-text-primary)] transition-colors">Privacy</a> <a href="https://docs.aitmpl.com" class="hover:text-[var(--color-text-primary)] transition-colors">Docs</a> <a href="/llms.txt" class="hover:text-[var(--color-text-primary)] transition-colors">llms.txt</a> <a href="/developers/catalog-api" class="hover:text-[var(--color-text-primary)] transition-colors">API</a> <a href="https://github.com/davila7/claude-code-templates" class="hover:text-[var(--color-text-primary)] transition-colors">GitHub</a> </nav> <p class="mb-3">Supported by</p> <div class="flex items-center justify-center gap-6 flex-wrap"> ', ' </div> <p class="mt-3 text-[12px]"><a href="/supporters" class="underline hover:text-[var(--color-text-primary)] transition-colors">All supporters</a></p> </footer> </main> </div> ', " ", " <!-- Single Clerk island for auth — idle so it doesn't block first paint --> ", " </body></html>"])), title, addAttribute(description, "content"), addAttribute(canonicalURL.href, "href"), addAttribute(canonicalURL.href, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImageURL, "content"), ogImageSized && renderTemplate`<meta property="og:image:width" content="1200">`, ogImageSized && renderTemplate`<meta property="og:image:height" content="630">`, ogImageAlt && renderTemplate`<meta property="og:image:alt"${addAttribute(ogImageAlt, "content")}>`, addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImageURL, "content"), ogImageAlt && renderTemplate`<meta name="twitter:image:alt"${addAttribute(ogImageAlt, "content")}>`, unescapeHTML(schemaData), gaId, renderHead(), renderComponent($$result, "Sidebar", $$Sidebar, {}), renderSlot($$result, $$slots["default"]), SUPPORT_PROGRAMS.filter((p) => p.footerLabel).map((p) => renderTemplate`<a${addAttribute(p.url, "href")} target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 hover:text-[var(--color-text-primary)] transition-colors"> ${p.icon && renderTemplate`<img${addAttribute(p.icon, "src")} alt=""${addAttribute(["h-5 w-5", p.monochrome && "oss-icon"], "class:list")}>`} <span>${p.footerLabel}</span> </a>`), renderScript($$result, "/home/user/claude-code-templates/dashboard/src/layouts/DashboardLayout.astro?astro&type=script&index=0&lang.ts"), renderScript($$result, "/home/user/claude-code-templates/dashboard/src/layouts/DashboardLayout.astro?astro&type=script&index=1&lang.ts"), renderComponent($$result, "ClerkIsland", ClerkIsland, { "client:idle": true, "client:component-hydration": "idle", "client:component-path": "/home/user/claude-code-templates/dashboard/src/components/ClerkIsland.tsx", "client:component-export": "default" }));
}, "/home/user/claude-code-templates/dashboard/src/layouts/DashboardLayout.astro", void 0);

function TypeIcon({ type, size = 16, className = "" }) {
  const svg = ICONS[type];
  if (!svg) return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className });
  const sized = svg.replace(/width="16"/, `width="${size}"`).replace(/height="16"/, `height="${size}"`);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className, dangerouslySetInnerHTML: { __html: sized } });
}

const CONTENT_BASE = "/component-content";
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1e3;
async function fetchComponents() {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }
  let url = COMPONENTS_JSON_URL;
  if (typeof window === "undefined" && url.startsWith("/")) {
    const base = "https://www.aitmpl.com";
    url = `${base}${url}`;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15e3);
  try {
    const res = await fetch(url, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedData = data;
    cacheTimestamp = now;
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (cachedData) return cachedData;
    throw err;
  }
}
const COMPONENTS_BASE = "/components";
const SEARCH_INDEX_URL = "/search-index.json";
const typeCache = /* @__PURE__ */ new Map();
let searchIndexCache = null;
function toAbsolute(pathUrl) {
  if (typeof window === "undefined" && pathUrl.startsWith("/")) {
    const base = "https://www.aitmpl.com";
    return `${base}${pathUrl}`;
  }
  return pathUrl;
}
async function fetchComponentsByType(type) {
  const now = Date.now();
  const cached = typeCache.get(type);
  if (cached && now - cached.ts < CACHE_TTL) {
    return cached.data;
  }
  const urlPath = `${COMPONENTS_BASE}/${type}.json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15e3);
  try {
    const res = await fetch(toAbsolute(urlPath), { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    typeCache.set(type, { data, ts: now });
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (cached) return cached.data;
    return [];
  }
}
async function fetchSearchIndex() {
  const now = Date.now();
  if (searchIndexCache && now - searchIndexCache.ts < CACHE_TTL) {
    return searchIndexCache.data;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15e3);
  try {
    const res = await fetch(toAbsolute(SEARCH_INDEX_URL), { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    searchIndexCache = { data, ts: now };
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (searchIndexCache) return searchIndexCache.data;
    return [];
  }
}
async function fetchComponentContentData(type, slug) {
  const typePlural = type.endsWith("s") ? type : type + "s";
  const urlPath = `${CONTENT_BASE}/${typePlural}/${slug}.json`;
  let url = urlPath;
  if (typeof window === "undefined" && urlPath.startsWith("/")) {
    const base = "https://www.aitmpl.com";
    url = `${base}${urlPath}`;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1e4);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { content: data.content ?? "", files: data.files, meta: data.meta, usedByLoops: data.usedByLoops };
  } catch {
    clearTimeout(timeoutId);
    return { content: "" };
  }
}
function getInstallCommand(component) {
  const typeFlag = {
    agent: "--agent",
    command: "--command",
    mcp: "--mcp",
    setting: "--setting",
    hook: "--hook",
    skill: "--skill",
    loop: "--loop",
    mod: "--mod",
    plugin: "--plugin",
    template: "--template"
  };
  const flag = typeFlag[component.type] ?? "--agent";
  const cleanPath = component.path?.replace(/\.(md|json)$/, "") ?? component.name;
  return `npx claude-code-templates@latest ${flag} ${cleanPath}`;
}

async function fetchActiveAds() {
  return [];
}
function pluralType(type) {
  return type.endsWith("s") ? type : type + "s";
}
function matchesAd(ad, type, path) {
  return ad.component_type === pluralType(type) && ad.component_path === path;
}
function findSponsoredIndex(ads, items) {
  for (const ad of ads) {
    const idx = items.findIndex((item) => matchesAd(ad, item.type, item.path));
    if (idx !== -1) return idx;
  }
  return -1;
}

function formatName(name) {
  if (!name) return "";
  return name.replace(/\.(md|json)$/, "").replace(/[-_]/g, " ").split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function SearchModal() {
  const [open, setOpen] = reactExports.useState(false);
  const [query, setQuery] = reactExports.useState("");
  const [data, setData] = reactExports.useState(null);
  const [ads, setAds] = reactExports.useState([]);
  const [selectedIndex, setSelectedIndex] = reactExports.useState(0);
  const [isAnimating, setIsAnimating] = reactExports.useState(false);
  const inputRef = reactExports.useRef(null);
  const resultsRef = reactExports.useRef(null);
  const closeTimeoutRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!open || data) return;
    fetchSearchIndex().then((entries) => setData(entries)).catch(() => {
    });
  }, [open, data]);
  reactExports.useEffect(() => {
    if (!open) return;
    fetchActiveAds().then((activeAds) => setAds(activeAds)).catch(() => {
    });
  }, [open]);
  reactExports.useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          closeModal();
        } else {
          openModal();
        }
      }
      if (e.key === "Escape" && open) closeModal();
    }
    const handleTriggerClick = (e) => {
      e.preventDefault();
      openModal();
    };
    window.addEventListener("keydown", handleKey);
    let observer = null;
    let timeoutId = null;
    const trigger = document.getElementById("searchTrigger");
    if (trigger) {
      trigger.addEventListener("click", handleTriggerClick);
    } else {
      observer = new MutationObserver(() => {
        const btn = document.getElementById("searchTrigger");
        if (btn) {
          btn.addEventListener("click", handleTriggerClick);
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      timeoutId = window.setTimeout(() => {
        observer?.disconnect();
        observer = null;
      }, 5e3);
    }
    return () => {
      window.removeEventListener("keydown", handleKey);
      const trigger2 = document.getElementById("searchTrigger");
      trigger2?.removeEventListener("click", handleTriggerClick);
      if (observer) {
        observer.disconnect();
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [open]);
  function openModal() {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
    setIsAnimating(true);
  }
  function closeModal() {
    setIsAnimating(false);
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 200);
  }
  reactExports.useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);
  const { results, totalMatches } = reactExports.useMemo(() => {
    if (!data || !query.trim()) return { results: [], totalMatches: 0 };
    const q = query.toLowerCase();
    const matched = data.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q)
    );
    const top = matched.slice(0, 20);
    const adIdx = findSponsoredIndex(ads, matched);
    if (adIdx !== -1) {
      const sponsored = { ...matched[adIdx], sponsored: true };
      const inTop = top.findIndex((c) => c.path === sponsored.path && c.type === sponsored.type);
      if (inTop !== -1) top.splice(inTop, 1);
      else if (top.length >= 20) top.pop();
      top.unshift(sponsored);
    }
    return { results: top, totalMatches: matched.length };
  }, [data, ads, query]);
  const matchesRef = reactExports.useRef(0);
  matchesRef.current = totalMatches;
  reactExports.useEffect(() => {
    if (!open || !data || !query.trim()) return;
    const timer = setTimeout(() => track("search", { results_count: matchesRef.current, scope: "modal" }), 1e3);
    return () => clearTimeout(timer);
  }, [open, data, query]);
  const prevResultsRef = reactExports.useRef([]);
  const lastQueryRef = reactExports.useRef(query);
  reactExports.useEffect(() => {
    const prev = prevResultsRef.current;
    prevResultsRef.current = results;
    if (lastQueryRef.current !== query) {
      lastQueryRef.current = query;
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((i) => {
      const selected = prev[i];
      if (!selected) return 0;
      const newIndex = results.findIndex((r) => r.path === selected.path && r.type === selected.type);
      return newIndex === -1 ? 0 : newIndex;
    });
  }, [query, results]);
  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      const c = results[selectedIndex];
      navigate(c);
    }
  }
  function navigate(component) {
    closeModal();
    window.location.href = componentPath(component.type, component.path ?? component.name);
  }
  reactExports.useEffect(() => {
    const container = resultsRef.current;
    const selected = container?.children[selectedIndex];
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);
  if (!open) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-start justify-center pt-[20vh]",
      onClick: closeModal,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: `absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${isAnimating ? "opacity-100" : "opacity-0"}`
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: `relative w-full max-w-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden transition-all duration-200 ${isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`,
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] transition-all duration-200 delay-[75ms] ${isAnimating ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}`, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-5 h-5 text-[var(--color-text-tertiary)] shrink-0", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    ref: inputRef,
                    type: "text",
                    placeholder: "Search all components...",
                    value: query,
                    onChange: (e) => setQuery(e.target.value),
                    onKeyDown: handleKeyDown,
                    className: "flex-1 bg-transparent text-base sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("kbd", { className: "px-1.5 py-0.5 text-[10px] bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded text-[var(--color-text-tertiary)]", children: "ESC" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: resultsRef, className: `max-h-80 overflow-y-auto transition-all duration-200 delay-100 ${isAnimating ? "opacity-100" : "opacity-0"}`, children: [
                query.trim() && results.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center justify-center px-4 py-12", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-16 h-16 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-8 h-8 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[14px] font-medium text-[var(--color-text-primary)] mb-1", children: "No results found" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[13px] text-[var(--color-text-secondary)] text-center max-w-xs", children: [
                    `We couldn't find any components for "`,
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-[var(--color-text-primary)]", children: query }),
                    '". Try different keywords.'
                  ] })
                ] }),
                results.map((component, i) => {
                  const typePlural = component.type.endsWith("s") ? component.type : component.type + "s";
                  const config = TYPE_CONFIG[typePlural];
                  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "button",
                    {
                      onClick: () => navigate(component),
                      className: `w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${component.sponsored ? "border-l-2 border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/5" : ""} ${i === selectedIndex ? "bg-[var(--color-primary-500)]/10" : "hover:bg-[var(--color-surface-2)]"}`,
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(TypeIcon, { type: typePlural, size: 16, className: "w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4 text-[var(--color-text-tertiary)]" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-[var(--color-text-primary)]", children: formatName(component.name) }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-[var(--color-text-tertiary)] ml-2", children: config?.label ?? component.type })
                        ] }),
                        component.sponsored && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[var(--color-primary-500)]/40 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-500)] shrink-0", children: "Sponsored" }),
                        component.category && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] shrink-0", children: component.category })
                      ]
                    },
                    component.path ?? `${component.name}-${i}`
                  );
                })
              ] }),
              query.trim() && results.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `flex items-center gap-4 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)] transition-all duration-200 delay-[150ms] ${isAnimating ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "↑↓ navigate" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "↵ open" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "esc close" })
              ] })
            ]
          }
        )
      ]
    }
  );
}

export { $$DashboardLayout as $, COLLECTIONS_CHANGED_EVENT as C, ICONS as I, SearchModal as S, TYPE_CONFIG as T, VALID_TYPES as V, componentPath as a, fetchComponentContentData as b, componentRef as c, findSponsoredIndex as d, TypeIcon as e, fetchComponents as f, getInstallCommand as g, fetchActiveAds as h, fetchComponentsByType as i, jsxRuntimeExports as j, SUPPORT_PROGRAMS as k, myComponentsUrl as m, openSignIn as o, pluralType$1 as p, reactDomExports as r, saveComponent as s, track as t, whenSavesSettled as w };

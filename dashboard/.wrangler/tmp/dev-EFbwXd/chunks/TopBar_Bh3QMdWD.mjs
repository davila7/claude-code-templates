globalThis.process ??= {}; globalThis.process.env ??= {};
import { f as createComponent, m as maybeRenderHead, h as addAttribute, k as renderComponent, l as renderScript, r as renderTemplate } from './astro/server_OwOTC5bf.mjs';
import { j as jsxRuntimeExports } from './SearchModal_DgLldkrh.mjs';
import { a as reactExports } from './_@astro-renderers_BvXjVE0w.mjs';

const THEME_KEY = "claude-theme";
function getTheme() {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}
function setTheme(theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}
function toggleTheme() {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("light", "dark");
  html.classList.add(theme);
}

function ThemeToggle() {
  const [theme, setTheme] = reactExports.useState("dark");
  const [mounted, setMounted] = reactExports.useState(false);
  reactExports.useEffect(() => {
    setMounted(true);
    setTheme(getTheme());
  }, []);
  const handleToggle = () => {
    const newTheme = toggleTheme();
    setTheme(newTheme);
  };
  if (!mounted) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      onClick: handleToggle,
      className: "relative group p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-2)] active:scale-95 flex items-center justify-center",
      "aria-label": `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
      title: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative w-5 h-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "svg",
          {
            className: `absolute inset-0 w-5 h-5 transition-all duration-300 ease-out ${theme === "light" ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-75"}`,
            style: { color: "var(--color-text-primary)" },
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "12", cy: "12", r: "4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "svg",
          {
            className: `absolute inset-0 w-5 h-5 transition-all duration-300 ease-out ${theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"}`,
            style: { color: "var(--color-text-primary)" },
            fill: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73 8.15 8.15 0 01-8.14-8.1 8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1014 11.69 1 1 0 00-.36-1.05z" })
          }
        )
      ] })
    }
  );
}

const GITHUB_REPO = "davila7/claude-code-templates";
const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
const FALLBACK_STARS = 30809;
function formatStars(count) {
  if (!Number.isFinite(count) || count < 0) return "";
  {
    const k = count / 1e3;
    return `${trimZero(k.toFixed(1))}k` ;
  }
}
function trimZero(value) {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

const $$TopBar = createComponent(($$result, $$props, $$slots) => {
  const fallbackStars = formatStars(FALLBACK_STARS);
  return renderTemplate`${maybeRenderHead()}<header class="sticky top-0 z-20 bg-[var(--color-surface-0)] border-b border-[var(--color-border)] transition-all duration-200"> <div class="flex items-center gap-2 sm:gap-3 justify-between px-4 sm:px-6 h-14"> <!-- Mobile menu button --> <button class="md:hidden shrink-0 p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-all duration-150 flex items-center justify-center" onclick="toggleSidebar()" aria-label="Toggle menu"> <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"></path> </svg> </button> <!-- Search trigger — terminal style --> <button id="searchTrigger" class="flex items-center gap-2 px-3 sm:px-4 py-2 border border-[var(--color-border)] rounded text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-1)] transition-all duration-150 flex-1 min-w-0 max-w-md whitespace-nowrap group font-ui-mono"> <span class="terminal-prompt text-[13px]">&gt;</span> <span class="truncate text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]">Search<span class="hidden sm:inline"> components</span>...</span> <kbd class="hidden sm:inline-flex ml-auto items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold border border-[var(--color-border)] rounded bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] group-hover:border-[var(--color-accent)] transition-all"> <span class="text-[11px]">⌘</span>K
</kbd> </button> <!-- Right actions --> <div class="flex items-center gap-1.5 sm:gap-2 shrink-0 sm:ml-4"> <a${addAttribute(GITHUB_REPO_URL, "href")} target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded border border-[var(--color-border)] text-[13px] font-ui-mono font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-1)] transition-all duration-150 group" aria-label="View on GitHub"> <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"> <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path> </svg> <span class="hidden sm:inline">GitHub</span> <span class="flex items-center gap-1 pl-2 border-l border-[var(--color-border)] text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] group-hover:border-[var(--color-accent)] transition-all duration-150" title="Stars on GitHub"> <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"> <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.31l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"></path> </svg> <span id="github-star-count"${addAttribute(String(FALLBACK_STARS), "data-stars")}>${fallbackStars}</span> </span> </a> ${renderComponent($$result, "ThemeToggle", ThemeToggle, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/home/user/claude-code-templates/dashboard/src/components/ThemeToggle.tsx", "client:component-export": "default" })} <div id="cart-button-mount"></div> </div> </div> </header> ${renderScript($$result, "/home/user/claude-code-templates/dashboard/src/components/TopBar.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/user/claude-code-templates/dashboard/src/components/TopBar.astro", void 0);

export { $$TopBar as $ };

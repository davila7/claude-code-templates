globalThis.process ??= {}; globalThis.process.env ??= {};
import { j as jsxRuntimeExports, T as TYPE_CONFIG, t as track } from './SearchModal_DgLldkrh.mjs';
import { a as reactExports } from './_@astro-renderers_BvXjVE0w.mjs';

const EMPTY_CART = {
  agents: [],
  commands: [],
  settings: [],
  hooks: [],
  mcps: [],
  skills: [],
  loops: [],
  mods: [],
  templates: []
};
const TYPE_FLAGS = {
  agents: "--agent",
  commands: "--command",
  settings: "--setting",
  hooks: "--hook",
  mcps: "--mcp",
  skills: "--skill",
  loops: "--loop",
  mods: "--mod",
  templates: "--template"
};
function cleanPath(path) {
  return path?.replace(/\.(md|json)$/, "") ?? "";
}
function formatName(name) {
  if (!name) return "";
  return name.replace(/\.(md|json)$/, "").replace(/[-_]/g, " ").split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function CartSidebar() {
  const [open, setOpen] = reactExports.useState(false);
  const [cart, setCart] = reactExports.useState(EMPTY_CART);
  const [copied, setCopied] = reactExports.useState(false);
  reactExports.useEffect(() => {
    function migrate(saved) {
      const { "function-hooks": legacy, ...rest } = saved;
      const cart2 = { ...EMPTY_CART, ...rest };
      if (Array.isArray(legacy) && legacy.length > 0) cart2.mods = [...cart2.mods ?? [], ...legacy];
      return cart2;
    }
    function loadCart() {
      try {
        const saved = localStorage.getItem("claudeCodeCart");
        if (saved) setCart(migrate(JSON.parse(saved)));
      } catch {
      }
    }
    loadCart();
    window.addEventListener("cart-updated", ((e) => {
      setCart(migrate(e.detail));
    }));
    window.addEventListener("storage", loadCart);
    return () => window.removeEventListener("storage", loadCart);
  }, []);
  const totalItems = Object.values(cart).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
  function generateCommand() {
    let cmd = "npx claude-code-templates@latest";
    for (const [type, items] of Object.entries(cart)) {
      if (items?.length > 0) {
        const flag = TYPE_FLAGS[type];
        if (flag) {
          const paths = items.map((i) => cleanPath(i.path)).join(",");
          cmd += ` ${flag} ${paths}`;
        }
      }
    }
    return cmd;
  }
  function removeItem(path, type) {
    setCart((prev) => {
      const next = { ...prev, [type]: prev[type]?.filter((i) => i.path !== path) ?? [] };
      localStorage.setItem("claudeCodeCart", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("cart-updated", { detail: next }));
      return next;
    });
  }
  function clearAll() {
    if (!confirm("Clear your entire stack?")) return;
    const empty = { ...EMPTY_CART };
    setCart(empty);
    localStorage.setItem("claudeCodeCart", JSON.stringify(empty));
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: empty }));
  }
  function copyCommand() {
    navigator.clipboard.writeText(generateCommand());
    track("copy_stack_command", { item_count: totalItems, source: "stack" });
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  }
  function shareTwitter() {
    const cmd = generateCommand();
    const text = `Check out my Claude Code stack!

${cmd}

Build yours at https://aitmpl.com`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    totalItems > 0 && !open && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => setOpen(true),
        className: "fixed bottom-6 right-6 z-40 flex items-center gap-2.5 pl-4 pr-3 py-3 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/80 hover:from-[var(--color-accent)]/90 hover:to-[var(--color-accent)]/70 text-white rounded-full shadow-lg shadow-[var(--color-accent)]/30 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-[var(--color-accent)]/40 active:scale-95",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[13px] font-semibold", children: "Stack" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-5 h-5 px-1.5 rounded-full bg-white/25 backdrop-blur-sm text-white text-[11px] font-bold flex items-center justify-center border border-white/20", children: totalItems })
        ]
      }
    ),
    open && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200",
        onClick: () => setOpen(false)
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 z-50 overflow-hidden pointer-events-none", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: `absolute top-0 right-0 h-full w-96 max-w-[90vw] bg-[var(--color-surface-0)] border-l border-[var(--color-border)] transform transition-[transform,visibility] duration-300 ease-out flex flex-col pointer-events-auto ${open ? "translate-x-0 shadow-2xl" : "translate-x-full invisible"}`,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface-1)] to-[var(--color-surface-0)] shrink-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/70 flex items-center justify-center shadow-md shadow-[var(--color-accent)]/20", children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4.5 h-4.5 text-white", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" }) }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-[15px] font-semibold text-[var(--color-text-primary)] leading-none", children: "Stack Builder" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[11px] text-[var(--color-text-tertiary)] mt-1", children: [
                  totalItems,
                  " ",
                  totalItems === 1 ? "component" : "components"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
              totalItems > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: clearAll,
                  className: "text-xs text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-red-400/10 px-3 py-1.5 rounded-lg transition-all font-medium",
                  children: "Clear All"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: () => setOpen(false),
                  className: "p-2 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors",
                  "aria-label": "Close sidebar",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-surface-3)] scrollbar-track-transparent min-h-0", children: totalItems === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center px-6", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-surface-3)] border border-[var(--color-border)] flex items-center justify-center mb-5 shadow-sm", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-12 h-12 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]/30 flex items-center justify-center backdrop-blur-sm", children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5 text-[var(--color-accent)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4v16m8-8H4" }) }) })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-base font-semibold text-[var(--color-text-primary)] mb-2", children: "Your stack is empty" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[13px] text-[var(--color-text-secondary)] max-w-xs leading-relaxed", children: [
              "Browse components and click the ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center justify-center w-4 h-4 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[10px] font-bold mx-0.5", children: "+" }),
              " button to add them to your stack for easy installation."
            ] })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-3 py-4", children: Object.entries(cart).filter(([, items]) => items?.length > 0).map(([type, items], idx, arr) => {
            const config = TYPE_CONFIG[type];
            const isLast = idx === arr.length - 1;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: !isLast ? "mb-4 pb-3 border-b border-[var(--color-border)]" : "mb-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5 py-2 px-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] mb-2 shadow-sm", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4 shrink-0", style: { color: config?.color ?? "var(--color-text-tertiary)" }, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[13px] font-semibold text-[var(--color-text-primary)]", children: config?.label ?? type }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] font-semibold tabular-nums border border-[var(--color-border)]", children: items.length })
              ] }),
              items.map((item, i) => {
                const isLastItem = i === items.length - 1;
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "flex items-center group pl-2 pr-1.5 py-0.5 hover:bg-[var(--color-surface-1)] rounded-md transition-all duration-150",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[var(--color-border)] text-[13px] font-mono w-7 shrink-0 select-none", children: isLastItem ? "└─" : "├─" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "w-3.5 h-3.5 shrink-0 mr-2.5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] transition-colors", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "14 2 14 8 20 8" })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[12px] text-[var(--color-text-primary)] flex-1 truncate py-2 font-medium", children: formatName(item.name) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: () => removeItem(item.path, type),
                          className: "opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-400/10 text-[var(--color-text-tertiary)] hover:text-red-400 transition-all shrink-0",
                          title: "Remove from stack",
                          "aria-label": `Remove ${formatName(item.name)}`,
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
                        }
                      )
                    ]
                  },
                  item.path
                );
              })
            ] }, type);
          }) }) }),
          totalItems > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-[var(--color-border)] bg-gradient-to-t from-[var(--color-surface-1)] to-[var(--color-surface-0)] p-4 space-y-3 shadow-[0_-8px_16px_rgba(0,0,0,0.08)] shrink-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] text-[var(--color-text-tertiary)] font-semibold uppercase tracking-wide", children: "Installation Command" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-[var(--color-surface-2)] rounded-lg p-3 text-[11px] font-mono text-[var(--color-text-secondary)] break-all max-h-20 overflow-y-auto border border-[var(--color-border)] shadow-inner hover:border-[var(--color-accent)]/30 transition-colors", children: generateCommand() })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: copyCommand,
                  className: "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/80 hover:from-[var(--color-accent)]/90 hover:to-[var(--color-accent)]/70 text-white rounded-lg text-sm font-semibold transition-all duration-200 shadow-md shadow-[var(--color-accent)]/20 hover:shadow-lg hover:shadow-[var(--color-accent)]/30 active:scale-95",
                  children: copied ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) }),
                    "Copied!"
                  ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" }) }),
                    "Copy Command"
                  ] })
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: shareTwitter,
                  className: "px-3.5 py-2.5 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-4)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:shadow-sm active:scale-95",
                  title: "Share on Twitter",
                  "aria-label": "Share on Twitter",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" }) })
                }
              )
            ] })
          ] })
        ]
      }
    ) })
  ] });
}

export { CartSidebar as C };

globalThis.process ??= {}; globalThis.process.env ??= {};
import { f as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_OwOTC5bf.mjs';
import { $ as $$DashboardLayout, S as SearchModal } from '../chunks/SearchModal_DgLldkrh.mjs';
import { $ as $$TopBar } from '../chunks/TopBar_Bh3QMdWD.mjs';
export { r as renderers } from '../chunks/_@astro-renderers_BvXjVE0w.mjs';

const prerender = false;
const $$404 = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Page not found | Claude Code Templates", "description": "This page does not exist on aitmpl.com. Browse the Claude Code Templates catalog of agents, commands, skills, hooks, MCPs and settings." }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "TopBar", $$TopBar, {})} ${maybeRenderHead()}<div class="flex flex-col items-center justify-center py-32 px-6"> <div class="w-24 h-24 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-6 shadow-lg"> <svg class="w-12 h-12 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"> <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path> </svg> </div> <h1 class="text-lg font-bold text-[var(--color-text-primary)] mb-2">Page not found</h1> <p class="text-[14px] text-[var(--color-text-secondary)] text-center max-w-md mb-8 leading-relaxed">
There is nothing at this address. The component may have been renamed or removed. Search the catalog or start from the home page.
</p> <a href="/" class="px-5 py-2.5 text-[13px] font-semibold rounded-lg bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] hover:shadow-lg transition-all duration-150 active:scale-95">
Browse components
</a> </div> ${renderComponent($$result2, "SearchModal", SearchModal, { "client:idle": true, "client:component-hydration": "idle", "client:component-path": "/home/user/claude-code-templates/dashboard/src/components/SearchModal.tsx", "client:component-export": "default" })} ` })}`;
}, "/home/user/claude-code-templates/dashboard/src/pages/404.astro", void 0);

const $$file = "/home/user/claude-code-templates/dashboard/src/pages/404.astro";
const $$url = "/404";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$404,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

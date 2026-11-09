globalThis.process ??= {}; globalThis.process.env ??= {};
import { f as createComponent, p as renderHead, l as renderScript, r as renderTemplate } from '../chunks/astro/server_OwOTC5bf.mjs';
/* empty css                                           */
export { r as renderers } from '../chunks/_@astro-renderers_BvXjVE0w.mjs';

const $$GithubCallback = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`<html data-astro-cid-epyfty3b> <head><title>Connecting GitHub...</title>${renderHead()}</head> <body style="background:#0a0a0a;color:#ccc;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0" data-astro-cid-epyfty3b> <div id="status" style="text-align:center" data-astro-cid-epyfty3b> <div style="width:24px;height:24px;border:2px solid #333;border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;margin:0 auto 12px" data-astro-cid-epyfty3b></div> <p data-astro-cid-epyfty3b>Connecting to GitHub...</p> </div>  ${renderScript($$result, "/home/user/claude-code-templates/dashboard/src/pages/github-callback.astro?astro&type=script&index=0&lang.ts")} </body> </html>`;
}, "/home/user/claude-code-templates/dashboard/src/pages/github-callback.astro", void 0);

const $$file = "/home/user/claude-code-templates/dashboard/src/pages/github-callback.astro";
const $$url = "/github-callback";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$GithubCallback,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

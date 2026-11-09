globalThis.process ??= {}; globalThis.process.env ??= {};
import { j as jsonResponse, c as corsResponse } from '../../../chunks/cors_BtEn6YS3.mjs';
import '../../../chunks/index_DI36L5AI.mjs';
export { r as renderers } from '../../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const prerender = false;
const OPTIONS = async () => corsResponse();
const GET = async () => {
  return jsonResponse({ ads: [] });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  OPTIONS,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

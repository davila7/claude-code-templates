globalThis.process ??= {}; globalThis.process.env ??= {};
import { j as jsonResponse, c as corsResponse } from '../../chunks/cors_BtEn6YS3.mjs';
export { r as renderers } from '../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const prerender = false;
const notFound = ({ url }) => jsonResponse(
  {
    error: {
      code: "not_found",
      message: `No API endpoint at ${url.pathname}.`,
      hint: "The catalog data API is a set of static JSON files; see /openapi.json for the endpoints and /llms.txt for an overview.",
      docs: "https://www.aitmpl.com/openapi.json"
    }
  },
  404
);
const GET = notFound;
const POST = notFound;
const PUT = notFound;
const PATCH = notFound;
const DELETE = notFound;
const OPTIONS = () => corsResponse();

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  DELETE,
  GET,
  OPTIONS,
  PATCH,
  POST,
  PUT,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

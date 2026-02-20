import type { APIRoute } from 'astro';

const UPSTREAM = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://www.aitmpl.com';

/** Proxy all /api/* requests to aitmpl.com in both dev and production */
export const ALL: APIRoute = async ({ request, params }) => {
  const url = new URL(request.url);
  const target = `${UPSTREAM}/api/${params.path}${url.search}`;

  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (key.toLowerCase() === 'host') continue;
    headers.set(key, value);
  }

  const res = await fetch(target, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined,
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};

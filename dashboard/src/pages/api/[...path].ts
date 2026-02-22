import type { APIRoute } from 'astro';

const UPSTREAM = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://www.aitmpl.com';

/** Proxy all /api/* requests to aitmpl.com in both dev and production */
export const ALL: APIRoute = async ({ request, params }) => {
  const url = new URL(request.url);
  const target = `${UPSTREAM}/api/${params.path}${url.search}`;

  try {
    const headers = new Headers();
    for (const [key, value] of request.headers) {
      const lower = key.toLowerCase();
      if (lower === 'host' || lower === 'accept-encoding') continue;
      headers.set(key, value);
    }

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.text()
        : undefined,
    });

    // Consume body as text to avoid double-compression issues.
    // fetch() auto-decompresses, so we get clean text here.
    const body = await res.text();

    const responseHeaders = new Headers(res.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    return new Response(body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

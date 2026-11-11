import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../lib/api/cors';

export const prerender = false;

// Unknown /api/* routes answer with JSON instead of the HTML 404 page.
// The public, read-only data API is the static catalog described in /openapi.json.
const notFound: APIRoute = ({ url }) =>
  jsonResponse(
    {
      error: {
        code: 'not_found',
        message: `No API endpoint at ${url.pathname}.`,
        hint: 'The catalog data API is a set of static JSON files; see /openapi.json for the endpoints and /llms.txt for an overview.',
        docs: 'https://www.aitmpl.com/openapi.json',
      },
    },
    404,
  );

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS: APIRoute = () => corsResponse();

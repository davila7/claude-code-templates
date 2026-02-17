import { verifyToken as clerkVerifyToken } from '@clerk/backend';

/**
 * Verify Clerk JWT from Authorization header.
 * Returns { authenticated: true, userId } or { authenticated: false, error }.
 */
export async function verifyAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      return { authenticated: false, error: 'Missing CLERK_SECRET_KEY' };
    }
    const { sub: userId } = await clerkVerifyToken(token, { secretKey });
    if (!userId) {
      return { authenticated: false, error: 'Invalid token' };
    }
    return { authenticated: true, userId };
  } catch (err) {
    console.error('Clerk token verification failed:', err.message);
    return { authenticated: false, error: 'Token verification failed' };
  }
}

const ALLOWED_ORIGINS = [
  'https://app.aitmpl.com',
  'https://aitmpl.com',
  'https://www.aitmpl.com',
];

/**
 * Set standard CORS headers on response.
 */
export function setCorsHeaders(res, req) {
  const origin = req?.headers?.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

import { createClerkClient } from '@clerk/backend';

let clerkClient;

function getClerkClient() {
  if (!clerkClient) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Missing CLERK_SECRET_KEY');
    }
    clerkClient = createClerkClient({ secretKey });
  }
  return clerkClient;
}

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
    const clerk = getClerkClient();
    const { sub: userId } = await clerk.verifyToken(token);
    if (!userId) {
      return { authenticated: false, error: 'Invalid token' };
    }
    return { authenticated: true, userId };
  } catch (err) {
    console.error('Clerk token verification failed:', err.message);
    return { authenticated: false, error: 'Token verification failed' };
  }
}

/**
 * Set standard CORS headers on response.
 */
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

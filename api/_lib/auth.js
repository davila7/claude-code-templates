import { verifyToken } from '@clerk/backend';

/**
 * Extract and verify Clerk JWT from Authorization header.
 * Returns the userId on success, or sends an error response and returns null.
 */
export async function authenticateRequest(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload.sub;
  } catch (err) {
    console.error('Clerk token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

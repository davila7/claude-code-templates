import { verifyToken } from '@clerk/backend';

export async function authenticateRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: import.meta.env.CLERK_SECRET_KEY,
    });
    return payload.sub;
  } catch (err) {
    console.error('Clerk token verification failed:', (err as Error).message);
    return null;
  }
}

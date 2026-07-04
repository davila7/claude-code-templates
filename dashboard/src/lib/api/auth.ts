import { verifyToken, createClerkClient } from '@clerk/backend';

export async function authenticateRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: (import.meta.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY),
    });
    return payload.sub;
  } catch (err) {
    console.error('Clerk token verification failed:', (err as Error).message);
    return null;
  }
}

/**
 * Authenticates and returns the user's primary email address.
 * Returns null if unauthenticated or email cannot be resolved.
 */
export async function authenticateAndGetEmail(request: Request): Promise<{ userId: string; email: string } | null> {
  const userId = await authenticateRequest(request);
  if (!userId) return null;

  try {
    const clerk = createClerkClient({ secretKey: (import.meta.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY) });
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;

    if (!email) return null;
    return { userId, email };
  } catch (err) {
    console.error('Failed to resolve user email:', (err as Error).message);
    return null;
  }
}

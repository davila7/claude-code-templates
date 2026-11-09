globalThis.process ??= {}; globalThis.process.env ??= {};
import { verifyToken as verifyToken2 } from './index_BRJRoD4-.mjs';

async function authenticateRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken2(token, {
      secretKey: process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY
    });
    return payload.sub;
  } catch (err) {
    console.error("Clerk token verification failed:", err.message);
    return null;
  }
}

export { authenticateRequest as a };

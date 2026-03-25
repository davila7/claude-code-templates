import { neon } from '@neondatabase/serverless';

export function getNeonClient() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  return neon(connectionString);
}

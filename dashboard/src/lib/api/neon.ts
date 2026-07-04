import { neon } from '@neondatabase/serverless';

export function getNeonClient() {
  const connectionString = import.meta.env.NEON_DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  return neon(connectionString);
}

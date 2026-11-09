globalThis.process ??= {}; globalThis.process.env ??= {};
import { c as cs } from './index_DI36L5AI.mjs';

function getNeonClient() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL not configured");
  }
  return cs(connectionString);
}

export { getNeonClient as g };

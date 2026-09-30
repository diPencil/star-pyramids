// Backend core — environment-neutral (Next.js server runtime AND trusted
// Node CLI scripts such as scripts/bootstrap-admin.ts).
//
// SECURITY BOUNDARY: server/CLI only. NEVER import from client components.
// Next.js code must consume this through lib/server/* (which enforces
// `server-only`); CLI scripts import it directly. Importing bcrypt into a
// client bundle would leak hashing internals and bloat the client —
// code review must reject any `components|app/**/page` import of lib/core.
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (!password || !passwordHash) return false;
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}

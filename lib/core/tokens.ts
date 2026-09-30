// Backend core — environment-neutral (Next.js server runtime AND trusted
// Node CLI scripts). Same boundary rules as lib/core/password.ts —
// server/CLI only, never client components.
//
// Opaque token helpers. Raw tokens are shown to the owner exactly once
// (cookie value / bootstrap output); only SHA-256 hashes are persisted.
// Uses Node crypto primitives — no custom cryptography.
import { createHash, randomBytes } from 'node:crypto';

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

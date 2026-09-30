// Minimal CSRF guard for cookie-authenticated mutations.
// SameSite=Lax blocks most cross-site writes; this additionally requires a
// matching Origin (or Referer fallback) for non-GET API requests.
// Same-origin navigations and fetch calls always send Origin/Referer.
import 'server-only';

export function isSameOriginRequest(request: Request): boolean {
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    '';
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

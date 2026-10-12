import type { ReactNode } from 'react';

import '../account/account.css';

/**
 * Guest booking layout.
 *
 * The guest booking view (`GuestBookingSection` in
 * `components/account-portal.tsx`) reuses the exact same `customer-*`
 * presentational classes as the account booking detail so guests and
 * customers read the same booking identically. Those classes live in
 * `app/account/account.css`, which the `/account` layout loads — but
 * this route sits outside that layout, so the page rendered unstyled.
 *
 * This layout loads the same stylesheet here. It is safe to share:
 * `account.css` is fully class-scoped (plus `html[dir]` RTL helpers) —
 * no bare-element or body rules leak onto other routes — and nothing
 * about the page structure, metadata (`noindex`/`no-store` on the
 * page), or token handling changes. Private-link access still resolves
 * exclusively through the access-token API.
 */
export default function BookingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

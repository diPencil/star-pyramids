# STAR PYRAMIDS — Backend Setup (Phase 1A)

P0 foundation: Next.js Node runtime + MySQL (Prisma) + opaque-session auth.
Frontend prototype stores are untouched and remain the display layer until
later migration phases.

## 1. Architecture change (read this first)

- OLD: `output: 'export'` static export → HTML in `out/`, hostable anywhere,
  but NO API routes, NO sessions, NO database access.
- NEW: standard Next.js server build (`.next/` + `next start`). Production
  needs a persistent Node.js runtime.
- Deployment implication: Hostinger **shared** hosting cannot run this.
  Production requires a VPS (or Node-capable host) running `next start`
  (or standalone output) with `DATABASE_URL` pointing at MySQL.

## 2. Requirements

- Node.js 20+ (dev runs Node v24), pnpm via Corepack (`corepack pnpm …`).
- MySQL 8+ / MariaDB 10.4+. Local dev uses XAMPP MariaDB on `127.0.0.1:3306`.

## 3. Environment

`.env` is gitignored (a local dev file exists for XAMPP defaults).
`.env.example` documents the shape — placeholders only:

```text
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
BOOTSTRAP_ADMIN_EMAIL=""
BOOTSTRAP_ADMIN_PASSWORD=""   # optional; script prompts when empty
```

Local XAMPP URL: `mysql://root:@127.0.0.1:3306/star_pyramids`

## 4. Database workflow

```powershell
corepack pnpm db:generate    # regenerate Prisma Client
corepack pnpm db:migrate     # prisma migrate dev (creates prisma/migrations/*)
corepack pnpm db:deploy      # production: apply committed migrations
corepack pnpm db:seed        # SAFE system data only (roles + tech defaults)
```

Seed contents: roles `SUPER_ADMIN/ADMIN/STAFF/CUSTOMER`, settings
`app.defaultLocale/defaultCurrency/timezone`, anchor rate USD→USD = 1.
It NEVER creates users, customers, bookings, requests, payments, or fixtures.

## 5. First Super Admin (explicit owner action)

```powershell
corepack pnpm db:seed
corepack pnpm db:bootstrap --email owner@example.com
```

(The older `pnpm db:bootstrap -- --email …` form also works — a bare
`--` forwarded by pnpm is ignored by the argument parser.)

- Email via `--email` or `BOOTSTRAP_ADMIN_EMAIL`; password via `--password`,
  `BOOTSTRAP_ADMIN_PASSWORD`, or secure prompt. Length policy: 6–8 characters.
- Interactive prompt masks input with `*` in TTY environments (Windows
  PowerShell / Windows Terminal / conhost). Non-TTY fallback disables echo.
- Idempotent: existing user is activated + granted SUPER_ADMIN.
- Refuses invalid email / weak password / missing SUPER_ADMIN role.
- Never prints passwords or hashes. No admin is created by this repo pass.

## 6. Auth model

- Opaque server sessions (`sessions` table, SHA-256 token hashes only).
- Cookie `sp_session`: HttpOnly, `SameSite=Lax`, `Secure` in production,
  30-day rolling expiry. Logout deletes the row immediately.
- Passwords: bcrypt cost 12 (bcryptjs, no native deps). Argon2id deferred
  until the production runtime is fixed — see `lib/server/password.ts`.
- Mutations additionally require a same-origin `Origin`/`Referer`
  (`lib/server/csrf.ts`). Nothing auth-related lives in localStorage.
- Endpoints: `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`, `GET /api/health` (no secrets, no stack traces).

## 7. Server boundaries (`lib/server/*` + `lib/core/*`, enforced `server-only`)

`db` (HMR-safe singleton) · `password` · `tokens` · `session` · `csrf` ·
`validation` (pure: email, password strength, currency, slug, YYYY-MM-DD) ·
`users` (public projection drops `passwordHash`) · `auth` · `settings` · `fx`
(DECIMAL(18,8), unique currency pairs; browser rates are never trusted).

Layering: `lib/core/*` (`password`, `validation`, `tokens`) is
environment-neutral and shared by the Next.js runtime AND trusted Node CLI
scripts (`scripts/`, `prisma/`). `lib/server/*` adds the Next.js-bound
pieces (`db`, `session`, `auth`, `users`, `settings`, `fx`, `csrf`) and
enforces `server-only`, so client components can never import Prisma,
sessions, or hashing. `lib/core` must likewise never be imported from
`components/` or `app/` pages — code review must reject it.

## 8. Run / build

```powershell
corepack pnpm dev     # port 3000, needs DATABASE_URL for /api/*
corepack pnpm build   # server build (no `out/` anymore)
corepack pnpm start   # production runtime
```

## 9. What is NOT done yet (later phases)

Catalogue/request/booking/payment migration, frontend login wiring,
rate limiting, email sending, permission matrix, dashboard metrics.

## 10. Admin settings foundation

- Canonical settings layer: `lib/server/settings.ts` (public keys +
  server-only secret keys + strict per-key validation) with currency rates
  in `FxRate` (USD anchor, manual source).
- Endpoint `GET|PATCH /api/admin/settings`: staff-readable, writable only
  by `SUPER_ADMIN`/`ADMIN` (STAFF is read-only), same-origin guarded, every
  write recorded in `staff_action_audit` (key names only — never values).
- GET returns public values plus `{ configured: boolean }` for secrets;
  stored secret values never leave the server. Empty secret input keeps the
  stored value. No migration was needed (`site_settings` is key-value).
- The admin UI (`app/admin/settings/page.tsx`) loads/saves through this
  endpoint, uses `SharedSelect` for every dropdown, and marks provider
  connectivity (WhatsApp/Maps/SMTP/OAuth) honestly as not verified —
  "configuration saved" is never presented as "connection verified".
- Public storefront readers (`localStorage` brand/social/currency/l10n)
  are kept as a compatibility mirror written on successful admin save;
  MySQL is the source of truth. Full storefront migration is a later phase.

## 11. Phase 2B — trip requests (Make Your Trip end-to-end)

- Model: `TripRequest` (`reference` unique `SP-TR-XXXXXX`, nullable `userId`
  → registered CUSTOMER or guest `NULL`, contact snapshot frozen at
  submit/edit, slug/date/traveler/budget fields, `TripRequestStatus` +
  `TripRequestTimeMode` enums) + `TripRequestActivity` (actor role, action,
  optional note, `isInternal`) + `TripRequestAttempt` (submission
  rate-limit, 10/hour per email-or-IP). Migration
  `20261004235840_add_trip_requests`.
- Reference: server-minted from an unambiguous alphabet, unique index +
  retry on collision; DB ids never exposed.
- Endpoints: `POST /api/trip-requests` (public, CSRF, rate-limited;
  links CUSTOMER session, guests stay unlinked); `GET|PATCH`
  `/api/account/trip-requests[/ref]` (owner-only safe projection,
  edit/cancel while new/reviewing); `GET|PATCH`
  `/api/admin/trip-requests[/ref]` (staff, transitions per shared map,
  internal notes, `StaffActionAudit`).
- Customer serializers strip internal notes; internal activity rows
  surface action-only so status changes stay visible without leaking
  staff discussion.
- Removed trip-request browser mocks only (`lib/trip-customers.ts`,
  `components/trip-pending-account.tsx`, localStorage store in
  `lib/trip-request.ts`, now a neutral shared contract). Bookings,
  payments, messages, quotations remain prototype (later phases).
- Still TODO: quotation/proposal documents, booking+payment conversion,
  email/WhatsApp notifications, retroactive guest→account linking.

## 12. P0 Fix 03 — server-side media storage (real uploaded files)

Uploads are stored as files on disk and referenced by URL. Base64 data
URLs are no longer produced by any upload flow.

- **Registry**: `MediaAsset` (`prisma/migrations/20261010120000_media_assets`).
  Additive `CREATE TABLE` only — no column was altered, dropped or
  backfilled, so no existing image or record was touched. Existing
  `data:` URLs and `https://` URLs keep working untouched.
- **Storage**: `lib/server/media.ts` (disk I/O) + `lib/core/media-signature.ts`
  (environment-neutral format detection, same rules as `lib/core/validation.ts`).
  Files land at `<MEDIA_STORAGE_DIR>/<yyyy>/<mm>/<32 hex>.<ext>`; the
  registry row stores the key and the public URL `/media/<key>`.
- **Validation**: the format is decided from the file's magic bytes, never
  from `File.type` or the filename. JPEG/PNG/WEBP/GIF only. The declared MIME
  type and extension are cross-checked and rejected when they contradict the
  real bytes. SVG, HTML, PDF and every other payload is refused.
- **Filenames**: 128 bits of `node:crypto` randomness, generated server-side.
  No user-supplied characters ever reach a path, so traversal, overwrite and
  collision are structurally impossible. Writes are atomic (temp file +
  rename), and a failed DB write deletes the file so nothing is orphaned.
- **Serving**: `GET /media/[...path]` streams the file with the MIME type
  recorded at upload, `X-Content-Type-Options: nosniff`, a stable `ETag` and
  `Cache-Control: public, max-age=31536000, immutable` (safe because keys are
  never reused — replacing an image stores a new file).
- **Upload**: `POST /api/media` (authenticated, same-origin, per-scope
  permissions, 120 uploads/hour per user) and `POST /api/avatar`
  (multipart, sets the caller's own avatar).
- **Scope permissions**: `avatar` = any signed-in user; `brand` =
  `settings.edit`; `catalogue` = any tours/cars/destinations/offers/blogs/
  events/categories create-or-edit grant.

### Hosting requirements (important)

- `MEDIA_STORAGE_DIR` **must** be a persistent, writable directory that
  survives process restarts and redeploys. Default:
  `<project>/storage/media`. The process user needs write access.
- **Backup `MEDIA_STORAGE_DIR` together with the database.** The database
  holds the references; the directory holds the bytes. Losing either side
  breaks every uploaded image.
- **Deploys must not clear it.** On a container platform mount a persistent
  volume and point `MEDIA_STORAGE_DIR` at it.
- **Horizontal scaling requires shared storage.** With more than one Node
  instance, each replica needs the same directory (NFS/shared volume), or
  the media route must be swapped for object storage (S3/R2). Local disk is
  correct for the current single-VPS `next start` deployment this project
  targets.
- **Read-only or ephemeral filesystems do not work** (Vercel/Netlify-style
  serverless). Those hosts need an object-storage driver.
- Set `MEDIA_MAX_UPLOAD_BYTES` to raise/lower the server-side per-file
  ceiling (default 5 MB). Admin image fields additionally cap at 1.5 MB and
  avatars at 2 MB in the UI.

## 13. P0 Fix 04 — guest booking access

Guests who check out without an account can read their own booking
confirmation and details without registering. The booking reference alone is
**not** a credential and never grants access.

- **Model**: `BookingAccessToken` + `BookingAccessAttempt`
  (`prisma/migrations/20261010150000_guest_booking_access`). Additive only —
  no booking row, column, or value was altered.
- **Tokens**: `lib/server/booking-access.ts`. 256 bits of CSPRNG entropy
  (`lib/core/tokens.ts`), base64url. Only the SHA-256 hash is persisted — the
  same contract as `sessions` and `account_setup_tokens`.
- **Scope**: tokens are issued for guest bookings only (`userId` NULL).
  Account bookings keep the existing session-owned flow unchanged, so no
  second credential widens their attack surface.
- **Expiring and revocable**: default TTL 90 days
  (`BOOKING_ACCESS_TOKEN_TTL_DAYS`). Tokens are bound to one booking
  reference and can be revoked without touching the booking.
- **Endpoint**: `GET /api/bookings/access/[token]`. There is deliberately no
  reference-based variant, so a reference can never be sufficient. Read-only:
  a leaked link can never cancel, pay, or mutate. Responses are
  `Cache-Control: no-store`.
- **Uniform failure**: wrong, expired and revoked tokens all return the same
  404 body, so the endpoint is not an oracle for "did this token once exist".
- **Brute-force budget**: failed lookups are counted per IP (30/hour). The
  token's entropy is the primary control; this is defence in depth.
- **Rotation**: each guest email mints a fresh token and revokes the previous
  one, so exactly one link is live — the newest email wins (same model as
  password reset).
- **UI**: `GET /booking/[token]` renders a read-only confirmation reusing the
  account booking presentation. `noindex`/`nocache` metadata; the token is read
  from the router client-side so it is never serialized into the RSC payload.
- **Emails**: `booking_created`, `booking_confirmed`, `booking_completed` and
  `booking_cancelled` accept `{{accessNote}}` and `{{detailUrl}}`. Guests get
  a private link plus an explanatory sentence; account bookings render exactly
  as before (empty note, account detail URL).
- **Not covered**: payment emails still point at the account payment page.
  Guests have no payment history page, so that link is account-only today.
  Guest payment emails are a follow-up, not a payment-logic change.

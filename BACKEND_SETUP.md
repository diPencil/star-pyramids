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

# Persistent Live Chat integration

The public Live Chat widget now uses the existing SupportConversation / SupportMessage store. Local browser transcripts are not imported or deleted. They are untrusted legacy data, not server-delivered messages.

## Ownership and delivery

- `/api/live-chat/session` bootstraps a 30-day HttpOnly, SameSite=Strict cookie, Secure with a `__Host-` prefix in production. Only the SHA-256 token hash is stored. Bootstrap finishes before any message is sent.
- `/api/live-chat` derives ownership from the customer server session or the guest cookie on every request. It accepts no conversation or sender IDs. Staff preview cannot send as a customer. Login switches to account-owned history; guest history is not automatically merged into an account.
- First submission creates or reuses an open owner thread. An owner-row lock and transaction serialize simultaneous first messages and persist the greeting, visitor message, and deterministic bot answer together. Stable request IDs plus payload fingerprints make retries idempotent, including after closure.
- The inline agent form requires name and mobile/WhatsApp number. It updates the same thread. Contact fields are returned only through permission-protected staff endpoints, never the public transcript contract. Once a human conversation begins, automated replies stop.
- The widget polls every 10 seconds while open and visible. Owner-scoped ETags return 304 using a metadata-only query when unchanged, avoiding repeated transcript downloads. The support inbox list and selected history refresh every 15 seconds while visible. Reopening restores server history. Draft text is retained during an in-page failure, but is not persisted across reloads. Session storage contains only retry IDs and fingerprints.
- Guest cookies expire after 30 days or can be cleared by the browser; without the credential there is no guest recovery by reference alone. The UI never asserts that staff are online or have read a message.

## Inbox

Bot threads remain visible. `needsStaffReply=false` excludes them from the unanswered/open-attention statistic and unread staff badge. Agent requests expose contact details and the request timestamp to authorized staff. Staff responses retain the existing support.edit permission and notification behavior for account customers; guest replies are recovered through the same website transcript. Bot messages are explicitly labelled.

## Connection failure diagnosis

The transport binds its injected/native fetch function to `globalThis`. Calling a stored native fetch as `transport.request(...)` with the transport as its receiver can throw `Illegal invocation` before any HTTP request. Receiver-sensitive regression tests cover history loading, bootstrap, delivery and polling; Node's native fetch and ordinary mocks do not expose this browser constraint. This code defect does not establish the cause of an uninspected production failure.

Expected browser requests (all same-origin, uncached, with a 10-second client timeout):

| Request | Expected response | Failure interpretation |
| --- | --- | --- |
| `GET /api/live-chat` on opening/reopening and every 10 seconds while visible | `200 {thread:null}` for a new visitor; `200 {thread:...}` for saved history; `304` only for unchanged owner-scoped history with an ETag | `403` staff preview; `429` shared rate limit; `503` caught backend failure |
| `POST /api/live-chat/session` before each message/handoff | `200 {ok:true}`; a new production guest gets `__Host-sp-chat` | `403` Origin/forwarded-host mismatch or staff preview; `429` rate limit; `503` caught backend failure |
| `POST /api/live-chat` after bootstrap | `201 {thread:...}` only after persistence; same request ID on a retry | `401` missing/expired cookie; `403` origin/staff restriction; `400/413` invalid/oversized input; `409` replay conflict; `429` rate limit; `503` caught backend failure |

The guest credential is HttpOnly, Secure in production, host-only (no Domain), Path=/, SameSite=Strict, valid for 30 days. Do not weaken these settings to debug deployment. Serve the widget and APIs on the same canonical HTTPS host; a cookie issued on the apex domain is not sent to a separate www/API host. The proxy must preserve the public host/Origin and overwrite forwarded headers. The session route uses the default Node.js runtime; the message/history route explicitly uses Node.js. Neither requires WebSockets or a background worker.

Before a separately approved Hostinger release, verify the app root is `web-source`, runtime supports Next.js's installed Node >=20.9 requirement, build executes the existing `prisma generate && next build --webpack` script, and the server runs `next start` rather than static export. Generate Prisma on the deployment platform; do not upload a Windows-generated engine. Verify the runtime DATABASE_URL points at the database actually imported, with correctly URL-encoded credentials. Do not paste its value into tickets or logs. No additional chat-specific environment variable is required.

SQL-file upload is not evidence of import. An authorized operator can verify the intended remote database using only `SELECT DATABASE(), VERSION()`, the completed `20261107073000_guest_live_chat` entry in `_prisma_migrations`, and `information_schema` metadata (or `SHOW CREATE TABLE`) for `chat_guest_sessions`, `chat_rate_buckets`, `support_conversations` and `support_messages`. Compare columns, nullable customer/sender IDs, indexes and guest foreign key with the checked-in migration. Do not select message bodies, contacts or session tokens. This review did not connect to the remote database.

If a failure remains, collect the failing request's method, path, timestamp, HTTP status, content type and sanitized Response. Report cookie presence/flags only, never values. If no request is emitted, pause on caught exceptions and record the exception name and stack. For Hostinger, collect the matching runtime/startup error class, Prisma error code and stack location, plus build lines showing Prisma generation and successful Next.js compilation. Redact URLs with credentials, SQL parameters, messages and contacts. P1000/P1001 indicate authentication/connectivity; P2021/P2022 indicate a missing table/column; a Prisma engine-load error indicates a platform/client artifact issue. These are diagnostic possibilities, not observed production errors. The handlers deliberately hide ORM details and do not log caught errors, so a generic 503 alone cannot identify the database fault. Note that even GET updates the rate-budget table: do not use live API probes as a read-only database check.

## Reviewed migration and local application

`prisma/migrations/20261107073000_guest_live_chat/migration.sql` was generated with a schema-to-schema Prisma diff, then applied through Prisma's normal migration workflow to the explicitly authorized local imported database `localhost:3306/star_pyramids_production` on 7 November 2026:

- Makes existing customer/sender relations nullable, preserving their existing foreign keys and all rows.
- Adds guest ownership, contact, channel, handoff timestamp, attention state and nullable request-ID/fingerprint fields.
- Adds credential-hash and rate-budget tables plus indexes. Existing conversations default to account channel and staff attention.
- Contains no DROP TABLE, DELETE, seed or rewrite of existing record values.

The missing `car_price_passenger_range_check` was restored separately using its exact definition from `20261027170000_car_passenger_pricing`. All 44 migration records are completed and their raw SHA-256 checksums match the repository files. No applied migration was rerun, no migration status was forced, and no remote database was contacted.

## Safe activation, to be executed separately by the owner

1. Review the migration against the deployed MySQL version and existing migration history. Confirm all earlier migrations are present. Take a verified database backup under the normal operations procedure.
2. Apply this migration to a disposable staging database first. Verify the nullable foreign-key alterations, existing account histories, two isolated guest sessions, replay after a lost response, bot rollback, agent request and real staff response. Do not use production customer records.
3. Ensure the reverse proxy overwrites X-Forwarded-For and forwarded host headers. Never expose Node directly with client-controlled forwarding headers. Check multi-worker rate limits and HTTPS cookie behavior; configure edge request limits as additional protection.
4. Review operational retention for expired chat_guest_sessions / chat_rate_buckets and guest contacts. No maintenance job is installed by this change. Removing an expired credential must not remove conversation history.
5. In an approved deployment window, run `prisma migrate deploy` only against the explicitly verified intended database, then `prisma generate` and the application release. This document does not authorize those operations. Old binaries can run on the expanded schema; new binaries require it.
6. Verify the inbox and guest flow using designated nonproduction records before activation. Keep expanded columns/tables when rolling application code back; do not reverse the migration by dropping data.

Local verification now includes both mocked tests and an opt-in real MariaDB test. The database test creates only synthetic records within one deliberately rolled-back transaction; notifications and emails are mocked. Hashes of every pre-existing record across the 58 original tables remained unchanged, excluding only the additional migration-history entry and new columns. No production-derived record was edited, and no booking, email, remote database operation or deployment was performed. The owner will test the browser UI online; no browser testing was performed here.

## Changed files

Paths are relative to `web-source/`:

```text
app/admin/inbox/page.tsx
app/api/admin/conversations/[ref]/messages/route.ts
app/api/admin/conversations/[ref]/route.ts
app/api/live-chat/route.ts
app/api/live-chat/session/route.ts
components/account-portal.tsx
components/support/live-chat.tsx
components/support/live-chat.module.css
docs/guest-live-chat-integration.md
lib/support/live-chat-bot.ts
lib/support/live-chat-client.ts
lib/support/live-chat-contract.ts
lib/server/db.ts
lib/server/support/live-chat-session.ts
lib/server/support/live-chat.ts
lib/server/support/support-chat.ts
lib/support/support-chat.ts
prisma/schema.prisma
prisma/migrations/20261107073000_guest_live_chat/migration.sql
tests/live-chat-client.test.ts
tests/live-chat-local-database.test.ts
tests/live-chat-polling.test.ts
tests/live-chat-route.test.ts
tests/live-chat-service.test.ts
tests/live-chat-session.test.ts
tests/live-chat-staff-route.test.ts
tests/live-chat-widget.test.ts
```

## Initial offline verification (before local migration)

- 203 tests passed in 17 focused suites: new chat service/session/API/client/widget/polling tests; existing chat presentation, localization and account-link tests; consent, tracking, page measurement, booking funnel and checkout safety regressions. Database calls and notification/email side effects were mocked.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed.
- Prisma validation passed and the Prisma Client was regenerated locally with a dummy localhost database URL. Schema-to-schema migration generation did not connect to a database.
- `git diff --check` passed. The index is empty, HEAD is unchanged, and all 130 unrelated pre-existing working-tree entries retain their original statuses and SHA-256 hashes.
- No production build or browser QA was run: builds may execute application data collection, and browser use is prohibited by project instructions. No disposable-database integration or migration execution was attempted.

The new code requires the expanded schema. The authorized local imported database now has it; remote database state was not inspected or changed. Application commands used a temporary process-level DATABASE_URL override, without changing .env files.

## Final local verification

- Full pre-migration SQL backup: `D:/Development/star-pyramids-nodejs/project-history/database-backups/star_pyramids_production-before-final-guest-chat-2026-11-07T19-23-34-450Z.sql`.
- Backup SHA-256: `cee9df62b679488f497dae31052eef00467bec014ad6786621c4cd7b014a6c99`; all 58 tables and 932 records were verified against dump coverage and row counts. No restore test was performed.
- Actual local server: MariaDB 10.4.32. Passenger CHECK restoration and Guest Live Chat migration completed successfully.
- 210 focused automated tests passed. The additional real-database rollback test passed separately; it is intentionally skipped in the default test batch.
- The real-database test is gated by `LIVE_CHAT_LOCAL_DATABASE_VERIFY=STAR_PYRAMIDS_LOCAL_ROLLBACK_ONLY` and validates the exact localhost database before any synthetic writes.
- Prisma validation, TypeScript without emit, and the complete production webpack build passed. The build completed static-page generation for 245 routes and included both Live Chat API routes.
- Guest session/rate tables and support history contained no leftover synthetic test records after rollback.
- Final post-migration SQL export: `D:/Development/star-pyramids-nodejs/project-history/database-backups/star_pyramids_production-ready-guest-chat-2026-11-07T19-37-55-805Z.sql`.
- Export SHA-256: `d1099ad7ae31ece5ec80c7ea5655b445cae7e7436591c664dd456df0fab78373`; all 60 tables and 933 records, including 44 completed migration records, were verified. The export contains no DROP statements. The owner reports that the updated SQL has now been uploaded to Hostinger; remote import and remote schema state were not independently inspected by this release task.

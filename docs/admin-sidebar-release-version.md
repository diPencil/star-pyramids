# Admin sidebar release label

The sidebar footer uses the existing useBrandSettings hook, whose companyName
comes from General → Company name (site.name). Only the first two whitespace-
separated words appear; a one-word name stays intact. No new settings, storage,
database access or authentication rules are introduced.

The agreed counter is commits included in published main, not push operations:
Git cannot reliably reconstruct historical push counts. Every commit adds
0.01: 10 → v0.10, 50 → v0.50, 100 → v1.00, 150 → v1.50, 165 → v1.65,
200 → v2.00, 1000 → v10.00.

At Next configuration/build time, scripts/release-version.cjs reads the full
history of the built HEAD using a bounded, read-only Git command. Release builds
must use the main commit being shipped. The resulting public version string is
embedded into client/server bundles; neither browser Git access nor runtime
database reads are added. A running deployment changes its version on rebuild,
not merely because another commit was pushed.

Source uploads without .git, unavailable Git, shallow history and command errors
use RECORDED_MAIN_COMMIT_COUNT in that script. The initial recorded main snapshot
is 164 commits (7993c03), giving v1.64. Refresh that snapshot during subsequent
release preparation when full history is available; otherwise a Git-less build
will intentionally retain the last recorded number. Do not report a shallow
clone's count as the total release history. All reachable commits are counted,
including merged commits; repeated pushes of the same history do not increment it.

The full sidebar shows the short company name and version underneath the user
card; the collapsed sidebar shows the version with the full short label in its
accessible name/title. CSS uses existing sidebar typography/color and flex/ellipsis
constraints without modifying global layout or navigation behavior.

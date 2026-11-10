# Customer account ownership

`account-portal.tsx` remains the public compatibility entry and section dispatcher. Its existing `AccountShell` is implemented in `shared/account-shell.tsx` and re-exported unchanged; keep its state, provider placement, route wrappers and public contracts stable.

| Folder | Responsibility |
| --- | --- |
| shared/ | Existing account shell/navigation, per-call hooks, shared UI and notification presentation |
| bookings/ | Booking APIs/hooks, cards/list, documents and owner/guest detail sections |
| cars/ | Customer car-request list/detail/cancel sections |
| favorites/ | Saved trips and compact tour presentation |
| overview/ | Account overview and completion notice |
| payments/ | Customer payment list/detail sections |
| support/ | Customer messages, support history and draft handling |
| profile/ | Profile/settings/password-change forms |

Existing custom-trip/event-request pages and confirmation dialog remain at their prior paths. Request pages import the shared shell, UI and confirmation dialog directly to avoid a cycle through the dispatcher. Public password recovery and legacy account pages from Phase 5B are unchanged. Internal sections import shared feature modules directly; do not add reverse imports to the portal.

See [exact extraction and verification details](../../docs/account-portal-modularization-phase5c.md).

# Phase 4F Inbox workflow QA

Website Enquiries now has its own two-panel presentation under `/admin/inbox?view=enquiries`. Support Conversations retains its existing message, assignment, close/reopen, unread and composer behavior. Both views continue to use their existing server APIs.

Enquiry edits are staged locally. **Save Changes** saves status, staff assignment and internal notes together. Saving does not send email. The server permits assignment only to active non-customer staff accounts with `enquiries.manage` (or SUPER_ADMIN), including custom staff roles. The picker and PATCH use the same eligibility rule. A stale `updatedAt` causes HTTP 409 instead of overwriting a newer save. No schema change or new migration is needed.

## Verification performed

- Prisma validation passed; all 29 migrations are applied.
- Production build passed (the configured build skips TypeScript checking).
- Standalone TypeScript checking still reports six unrelated errors in blogs, cars, offers and bookings. No errors were reported in the changed enquiry files.
- Unauthenticated list, staff-picker and detail requests returned JSON 401.
- A separate QA enquiry passed direct MySQL status transitions, authorized staff assignment, notes, unassignment, stale-version rejection and reads through fresh Prisma clients.
- Both original Phase 4F QA enquiries were compared against complete pre-test snapshots and remain unchanged.
- Independent source review findings were addressed. No automated test framework was added.

The new QA enquiry reference is `caeec3f8-afc8-431e-8e07-1ac5b24a5ade` (`phase4f-inbox-lifecycle@example.invalid`). It remains available for owner testing. Do not use the two original QA records for mutation tests.

## Authenticated browser QA results

Owner sign-in enabled browser QA on port 3000. Status changes from New to In Progress and then Resolved saved successfully; staff assignment, internal notes and unassignment saved through the real API. MySQL reads confirmed these values, and browser refresh restored the selected reference and saved fields. The dedicated lifecycle QA record is now Resolved and unassigned, with the browser QA notes retained.

Search empty state and In Progress filtering passed. Desktop (1440px), tablet (768px) and mobile (375px) showed no horizontal overflow; mobile detail/back navigation passed. Browser QA found public footer styles leaking onto enquiry metadata and the save area. Replacing those incidental footer elements with scoped containers removed the dark blocks and excess padding; layouts were checked again.

Cancelling the unsaved tab-switch prompt retained the draft. A sidebar navigation warning appeared, but browser dialog handling interrupted the test; its cancel outcome is inconclusive. Support Conversations loaded its existing thread and history, showed assignment and close controls, and expanded a four-line composer draft to 107px. The draft was cleared and no message was sent to the existing customer. Support send/assignment/close/reopen mutations were not exercised on that live conversation.

No browser console errors were captured. Prisma validation and production build passed after the visual fix; the same six unrelated TypeScript errors remain. Both original QA enquiry records were compared against their snapshots and remain unchanged. No commit or push.

## Owner follow-up checklist

The remaining scenarios below include stale-version conflict UI, restricted-role UI, locale QA, sidebar discard cancellation and Support mutation testing on a designated test conversation.

1. Sign in with an authorized admin account and open Website Enquiries. Verify that Support and enquiry data have distinct presentations.
2. Open the new lifecycle QA record. Review full name, email, phone when present, reference, trip type, full message, source, submission time, status, staff and notes.
3. Change status, select an authorized staff account and edit notes. Confirm the unsaved indicator. Cancel switching records, tabs, and sidebar navigation; edits should remain.
4. Save once. Check success feedback and disabled saving controls. Refresh and confirm the same record, status, assignee and notes load from MySQL.
5. Unassign the saved assignment and save again. Refresh and confirm it is unassigned. A previously unassigned record should offer Assign Staff without an Unassign action.
6. Open the same record in another admin tab, save a change there, then try saving a stale draft. Confirm HTTP 409 and reload guidance.
7. Verify search by name, email, reference and message; status filters; pagination; empty and error states; staff-loading retry; read-only users; keyboard selection.
8. Inspect desktop, tablet and mobile layouts, including long names and email addresses. Verify EN/ES/IT translations and preserve dormant AR/RTL behavior.
9. Recheck Support Conversations, including multiline composer growth, message send, unread count, assignment, close/reopen and notification deep links.

No commit or push. Phase 4G is outside this change.

## Unsaved changes UX verification — 8 October 2026

The enquiry workflow now explicitly compares status, assigned staff public ID, and notes against the last successful server response. The neutral text with an orange dot appears only for different values; Save Updates is disabled otherwise. Success feedback expires after four seconds. Failed requests preserve the draft and permit retry.

The existing AdminConfirmDialog replaces native confirmation calls for enquiry selection, detail reload, Support tab switching, and sidebar/site links. Keep editing preserves the draft; Discard changes performs the pending action. No browser-default alert/confirmation is used. Browser Back/Forward, hard refresh and tab close are not intercepted: browsers cannot show the custom application modal during unloading. Owner QA should account for this limitation.

Authenticated browser checks passed for notes and assignment edit/revert, status edit/save/revert, persistence after refresh, clean tab switching without warning, custom tab/sidebar cancellation, mobile return-to-list discard, and opening another enquiry. A deliberate timestamp conflict on the dedicated lifecycle QA record produced the expected error, retained the draft and enabled retry; restoring the test timestamp allowed retry to save successfully. Dedicated record final state: Resolved, unassigned, previous notes restored. Both original QA records were compared field-by-field with the saved snapshot and remain unchanged. Support history loaded; no real customer message or support workflow mutation was performed.

TypeScript reports the same six pre-existing errors in blogs, cars, offers and bookings. Production build and git diff whitespace checks passed. No official automated test runner exists. Independent code review found no blockers; it identified the browser-control navigation limitation above. 21st CLI search/review unavailable because the executable is not installed; reused existing admin dialog and tokens. No commit or push.


## Finalization results supersede earlier check status

See phase-4f-finalization.md for the final zero-error TypeScript run, passing build, worktree inventory, migration checksum audit and authenticated browser verification. Older references to six unresolved errors are historical. Exact dirty copy and custom-only in-app confirmation are restored. Contact/source labels and remaining punctuation leftovers were corrected. Both original enquiries remain unchanged.

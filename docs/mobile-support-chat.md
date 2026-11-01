# Mobile support conversations

Live Chat and the existing WhatsApp handoff widget open as full-screen conversations at widths up to 1024px. Desktop keeps the existing floating panels. This is a presentation change to the current widgets, not a new chat service or URL.

## Behavior and ownership

- `components/support-chat-panel.tsx` owns responsive presentation and portals the mobile panel into `document.body`. `PublicAppearancePortal` preserves the published appearance tokens. Conversation state stays in the existing widget owner.
- `lib/mobile-chat-screen.ts` tracks VisualViewport resize/scroll and window resize/orientation changes. The panel follows the visible viewport, including keyboard panning; window dimensions are the fallback.
- `app/mobile-shell.css` scopes the full-screen treatment to the existing mobile/tablet breakpoint. Messages scroll, the composer stays last, safe areas receive padding, and 16px input text avoids iOS input zoom.
- The mobile header uses 4px vertical spacing, a 28px avatar, a 13px brand name and a 10.5px status line. Without safe-area insets or wrapped text, the 44px Back target makes it approximately 52px tall. Message bubbles use 13px text and smaller padding; the composer retains 16px text and 44px controls. These compact rules affect both chat channels only inside the mobile breakpoint; desktop stays unchanged.
- Back closes the conversation and restores the page scroll and previous focus. Escape and focus trapping are supported. Opening focuses Back rather than summoning the keyboard. There is no new history entry or browser Back interception.
- The page behind the conversation becomes inert and its floating controls are hidden. Cleanup restores previous body styles and inert states, including across breakpoint changes and repeated mounting.
- The first viewport sync shows the latest message; subsequent keyboard resizing preserves an intentional scroll into older messages.
- EN/ES/IT Back labels use the existing localization owner. Arabic is not enabled.

## Preserved behavior

The existing Live Chat response behavior, message limits, storage, timers and WhatsApp handoff remain in their original widgets. WhatsApp still opens the configured external WhatsApp destination when sending; this change does not add an embedded WhatsApp service. Desktop retains composer autofocus and floating panel styles.

No database operation, pricing/booking change, route, configuration change or dependency installation is involved.

## Verification

The focused automated suite covers viewport geometry during keyboard resizing/panning, fallback dimensions, message scrolling, inert restoration, focus, Escape/IME handling, repeated lifecycle cleanup, localized widget rendering, desktop semantics, and mobile CSS boundaries. It also checks that the shared presentation owner has no messaging/storage/navigation effects. Widget open/send handlers were compared with their pre-change SHA-256 baselines and remain identical.

Commands: local Vitest for `mobile-chat-screen`, `support-chat-panel-render`, `mobile-css`, `mobile-public-controls`, `mobile-drawer` and `whatsapp-pro-additions` (30 tests); TypeScript without emit; Next.js webpack compile-only build. Compile-only avoids prerendering database-backed pages.

Browser automation and physical-device keyboard testing were not performed. Final manual verification should cover iOS Safari and Android Chrome: open both conversations, type with the keyboard visible, scroll older messages, close/reopen, rotate, and check desktop floating panels. No real WhatsApp message was sent during verification.

Rollback is limited to the shared panel/helper, their tests, the mobile-only CSS block and the widget presentation wiring. Preserve unrelated pending changes in those files.

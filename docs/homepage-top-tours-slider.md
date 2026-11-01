# Top Tours horizontal slider

Owner request, 2 November 2026: Explore Egypt's Top Tours must be a moving horizontal slider on desktop and mobile instead of multiple card rows.

The homepage reuses the existing HorizontalSlider and TourCard. Scoped styles show four cards on large screens, two at widths up to 1024px, and 86% cards with a next-card hint at up to 760px. Native touch/trackpad scrolling and scroll snapping work without cloning records. Cards, links, prices, favorites and image galleries retain their existing owners. Other homepage sections remain unchanged; CMS selection, limits, ordering, visibility and the View All link remain authoritative.

An overflowing track advances one scroll position every five seconds and wraps to the first position. Previous/next and a pause/play control have EN/ES/IT labels and 44px targets. The position counter counts distinct scroll positions, not tours. The focused track supports Left/Right/Home/End without intercepting keys from card controls. No navigation is displayed when everything fits; an empty source creates no empty carousel region.

The shared slider now tracks pointer hover, keyboard focus and touch independently. Leaving the pointer does not restart motion while focus remains inside. Rotation waits during interaction, after wheel/touch/key navigation, on hidden tabs, offscreen and while reduced motion is enabled. Manual navigation uses instant scrolling for reduced motion. Resize observers/window resize remeasure the track; timers and listeners are cleaned up. Existing related-tour/video sliders retain their default interval, appearance and dot controls while receiving these interaction safeguards. Pause/play and the numeric counter are opt-in for Top Tours.

Verification uses mocked component effects/geometry, real homepage server markup in EN/ES/IT, CSS breakpoint contracts and existing tour discovery/recommendation/template regressions. No browser/device testing, database writes, schema, pricing, dependency installation or deployment is involved. The 21st UI Build instructions and existing design context were consulted; no 21st CLI/connector was available. Reused the installed project component instead of downloading a new one.

Rollback: remove the featured section slider wrapper/import/styles and restore its grid; revert the shared slider interaction changes if required. No data rollback is necessary.

# Top Tours horizontal slider

Owner request, 2 November 2026: Explore Egypt's Top Tours must be a moving horizontal slider on desktop and mobile instead of multiple card rows.

The homepage reuses the existing HorizontalSlider and TourCard. Scoped styles show four cards on large screens, two at widths up to 1024px, and 86% cards with a next-card hint at up to 760px. Native touch/trackpad scrolling and scroll snapping work without cloning records. Cards, links, prices, favorites and image galleries retain their existing owners. Other homepage sections remain unchanged.

Owner revision, 2 November: Top Tours always includes the full published database catalogue, without applying the legacy featured selection/limit. Drafts remain excluded by the shared resolver. CMS title, subtitle, visibility, order and View All link remain authoritative; other sections retain their existing selection/limit rules. The old number represented scroll positions rather than tour count.

An overflowing track advances one scroll position every five seconds and wraps to the first position. Two EN/ES/IT-labeled, 44px arrows sit on the left of one footer row, with the CMS View All action on the right. There is no counter, dot navigation, playback button or visible scrollbar for this section. The focused track supports Left/Right/Home/End without intercepting keys from card controls. When everything fits, View All remains right aligned without unnecessary arrows; an empty source creates no empty carousel region.

The shared slider tracks pointer hover, keyboard focus and touch independently. Leaving the pointer does not restart motion while focus remains inside. Rotation waits during interaction, after wheel/touch/key navigation, on hidden tabs, offscreen and while reduced motion is enabled. Manual navigation uses instant scrolling for reduced motion. Resize observers/window resize remeasure the track; timers and listeners are cleaned up. Existing related-tour/video sliders retain their default interval, appearance and dot controls. The combined footer and arrows-only controls are opt-in for Top Tours; other callers still support the previous optional playback control.

Verification uses mocked component effects/geometry, real homepage server markup in EN/ES/IT, CSS breakpoint contracts and existing tour discovery/recommendation/template regressions. No browser/device testing, database writes, schema, pricing, dependency installation or deployment is involved. The 21st UI Build instructions and existing design context were consulted; no 21st CLI/connector was available. Reused the installed project component instead of downloading a new one.

Rollback: remove the featured section slider wrapper/import/styles and restore its grid; revert the shared slider interaction changes if required. No data rollback is necessary.

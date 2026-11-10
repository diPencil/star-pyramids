# Documentation index

Use the root [README](../README.md) and [backend setup](../BACKEND_SETUP.md) for application setup, and the root [design system](../DESIGN_SYSTEM.md) for visual conventions. Agent instructions remain at their existing root paths.

## Current implementation documentation

The existing documents directly in `docs/` describe feature contracts, security reviews, and development checkpoints. Consult the relevant document together with the current source and tests; a dated report is not a claim of current production verification.

- Booking and checkout: [cart safety review](booking-cart-safety-review.md), [checkout hardening](booking-checkout-final-hardening.md), [account enrollment](checkout-account-enrollment.md), and [enrollment verification](checkout-enrollment-verification.md).
- Customers and reporting: [guest CRM and multi-trip reporting](admin-guest-crm-multitrip-reporting.md) and [customer profile review](customer-profile-dual-surface-review.md).
- Trip Builder: [rich text](trip-builder-rich-text.md) and [translations](trip-builder-translations.md).

## Organized root reports

`features/` groups feature descriptions and progress records. `audits/` groups assessments. `history/` retains implementation, incident, and tooling reports. These categories organize existing documents; their contents and verification claims remain historical and must be checked against current source before use.

All 27 relocated reports retain their original filenames and exact bytes. Source paths and commands inside them retain their original application-root or historical meaning; do not execute historical commands from a document's new directory.

| Category | Reports |
| --- | --- |
| `history/tooling/` | [AGENT_SKILLS_INSTALLATION_REPORT.md](history/tooling/AGENT_SKILLS_INSTALLATION_REPORT.md) |
| `history/incidents/` | [APPLE_LOADING_INCIDENT.md](history/incidents/APPLE_LOADING_INCIDENT.md) |
| `history/implementation/` | [BRANDING_REFRESH_VERIFICATION.md](history/implementation/BRANDING_REFRESH_VERIFICATION.md), [CURRENCY_PHASE10_VERIFICATION.md](history/implementation/CURRENCY_PHASE10_VERIFICATION.md), [DESTINATION_BUILDER_PARITY_VERIFICATION.md](history/implementation/DESTINATION_BUILDER_PARITY_VERIFICATION.md), [DESTINATIONS_PHASE5_COMPLETION.md](history/implementation/DESTINATIONS_PHASE5_COMPLETION.md), [GALLERY_PHASE7_VERIFICATION.md](history/implementation/GALLERY_PHASE7_VERIFICATION.md), [NAVIGATION_MANAGER_VERIFICATION.md](history/implementation/NAVIGATION_MANAGER_VERIFICATION.md), [PHASE_2F_B_FINALIZATION_REPORT.md](history/implementation/PHASE_2F_B_FINALIZATION_REPORT.md), [RENT_CAR_DUAL_PRICING_PHASE1.md](history/implementation/RENT_CAR_DUAL_PRICING_PHASE1.md), [RENT_CAR_DUAL_PRICING_PHASE3.md](history/implementation/RENT_CAR_DUAL_PRICING_PHASE3.md), [RENT_CAR_FINAL_VERIFICATION.md](history/implementation/RENT_CAR_FINAL_VERIFICATION.md), [REVENUE_TREND_FIX_REPORT.md](history/implementation/REVENUE_TREND_FIX_REPORT.md), [REVIEWS_PHASE6_VERIFICATION.md](history/implementation/REVIEWS_PHASE6_VERIFICATION.md), [SUSTAINABILITY_PHASE9_VERIFICATION.md](history/implementation/SUSTAINABILITY_PHASE9_VERIFICATION.md), [TRIP_BUILDER_PHASE8_VERIFICATION.md](history/implementation/TRIP_BUILDER_PHASE8_VERIFICATION.md), [WEBSITE_CMS_VALIDATION.md](history/implementation/WEBSITE_CMS_VALIDATION.md) |
| `audits/` | [CMS_PUBLIC_CONTENT_INTEGRATION_AUDIT.md](audits/CMS_PUBLIC_CONTENT_INTEGRATION_AUDIT.md), [FINAL_INTEGRATION_AUDIT.md](audits/FINAL_INTEGRATION_AUDIT.md), [PAYMENT_INTEGRATION_READINESS.md](audits/PAYMENT_INTEGRATION_READINESS.md) |
| `features/` | [LOCALIZATION_PROGRESS.md](features/LOCALIZATION_PROGRESS.md), [MOBILE_UX_PROGRESS.md](features/MOBILE_UX_PROGRESS.md), [OFFERS_NOTIFICATIONS_AND_CREATION_TIMELINES.md](features/OFFERS_NOTIFICATIONS_AND_CREATION_TIMELINES.md), [PAYMENT_GATEWAY_FOUNDATION.md](features/PAYMENT_GATEWAY_FOUNDATION.md), [SEO_IMPLEMENTATION_PROGRESS.md](features/SEO_IMPLEMENTATION_PROGRESS.md), [WEBSITE_APPEARANCE_PROGRESS.md](features/WEBSITE_APPEARANCE_PROGRESS.md), [WEBSITE_CMS_PROGRESS.md](features/WEBSITE_CMS_PROGRESS.md) |

## Historical cross-reference resolution

Plain filename citations in the preserved reports resolve through the links below. No existing Markdown hyperlinks to relocated reports required rewriting. This table updates navigation without altering the original report hashes.

| Referencing report | Cited report at its new path |
| --- | --- |
| [FINAL_INTEGRATION_AUDIT.md](audits/FINAL_INTEGRATION_AUDIT.md) | [CMS_PUBLIC_CONTENT_INTEGRATION_AUDIT.md](audits/CMS_PUBLIC_CONTENT_INTEGRATION_AUDIT.md) |
| [PHASE_2F_B_FINALIZATION_REPORT.md](history/implementation/PHASE_2F_B_FINALIZATION_REPORT.md) | [PAYMENT_GATEWAY_FOUNDATION.md](features/PAYMENT_GATEWAY_FOUNDATION.md) |
| [RENT_CAR_FINAL_VERIFICATION.md](history/implementation/RENT_CAR_FINAL_VERIFICATION.md) | [RENT_CAR_DUAL_PRICING_PHASE1.md](history/implementation/RENT_CAR_DUAL_PRICING_PHASE1.md) |
| [RENT_CAR_FINAL_VERIFICATION.md](history/implementation/RENT_CAR_FINAL_VERIFICATION.md) | [RENT_CAR_DUAL_PRICING_PHASE3.md](history/implementation/RENT_CAR_DUAL_PRICING_PHASE3.md) |
| [WEBSITE_CMS_PROGRESS.md](features/WEBSITE_CMS_PROGRESS.md) | [WEBSITE_CMS_VALIDATION.md](history/implementation/WEBSITE_CMS_VALIDATION.md) |
| [WEBSITE_CMS_VALIDATION.md](history/implementation/WEBSITE_CMS_VALIDATION.md) | [WEBSITE_CMS_PROGRESS.md](features/WEBSITE_CMS_PROGRESS.md) |

## Relocation record and boundaries

The [relocation manifest](relocation-manifest.json) records original and destination paths, original SHA-256 values, and skipped outer-root candidates. Historical preservation manifests remain unchanged; use the relocation record to interpret their original paths.

At the time of Phase 1, the ten outer-root historical documentation/tooling candidates remained in place because archive privacy and deployment exclusion could not be verified. The later owner-authorized root cleanup moved historical reports and retired tools into the private, local-only [project archive](../../project-archive/README.md), outside this application repository. Its [cleanup manifest](../../project-archive/cleanup-manifest.json) supersedes the current-location information only; the original Phase 1 manifest and all 27 relocated reports remain unchanged. These workspace links require the outer local workspace and are not application-deployment dependencies.

Lighthouse reports, operational packages, test fixtures, agent instructions, application source, persistent assets, and generated output were outside Phase 1. The later cleanup archived root Lighthouse captures, diagnostics and ad hoc tools unchanged; import sources without active consumers moved to [data-imports](../../data-imports/README.md). Active operational packages, test fixtures, application source and persistent assets remain in place.

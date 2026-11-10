# Admin component ownership

| Folder | Responsibility |
| --- | --- |
| cms/ | Page/hero/appearance/navigation editors, CMS dashboard and preview/pickers |
| seo/ | Global/page/record SEO editors and Tracking Health UI |
| cars/ | Fleet vehicle form and pricing editor with paired CSS |
| destinations/ | Destination preview and section/cover editors |
| tours/ | Tour CTA picker and trip-builder preview with paired CSS |
| marketing/ | Campaign and promo-bar field groups |
| gallery/ | Gallery editor fields and localized gallery text |

Root files remain deliberate: admin shell/locale/currency/toast/table primitives are shared entry points; image/language/rich-text/timeline controls are cross-feature editor dependencies. The main trip-builder.tsx remains pinned by external REAL_TOURS source-reader tooling. Standalone small feature screens (blog, reviews, revenue, notifications and enquiries) do not need single-file subfolders. No barrel modules or component rewrites were introduced.

See [Phase 4 before/after trees, exact moves and retained issues](../../docs/source-organization-phase4.md).

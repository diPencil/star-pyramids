// DEPRECATED — faulty Phase 3A scraper retired.
// This file previously scraped `slug:` via regex and fabricated placeholder
// Tour rows, which produced catalogue integrity violations (MultiDayCategory
// and cruise-type slugs imported as Tour rows).
// Canonical importer is now `prisma/import-tours.ts`, which uses the actual
// runtime `tours` export from `data/tours.ts` and preserves every Tour field.
// Run: corepack pnpm exec tsx prisma/import-tours.ts
throw new Error(
  "prisma/import-tours.js is retired. Use: corepack pnpm exec tsx prisma/import-tours.ts"
);

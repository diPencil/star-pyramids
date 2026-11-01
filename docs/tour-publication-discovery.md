# Published tours and catalogue counts

Public discovery must include published database tours with newly created slugs. Resolving only the bootstrap slug list hid real database records even though `/api/tours?full=1` returned them.

The existing `useDbTours` resolver and shared `isTourPublished` rule remain the owners. Category directories, destination discovery, multi-day categories and the search engine now opt into `includeNew`, with a category restriction wherever the base catalogue represents one category. Draft records remain excluded by both the existing API and resolver.

The homepage automatic popular selection includes published records absent from the original popular/catalogue arrays. Explicit CMS record selections and limits still apply. Seasonal selections remain curated. Publication is an editorial action; inserting a Draft record does not publish it or make it bookable.

The four admin Trips statistics show the total followed by the published count (for example `26 / 11 published`). Both counts are calculated from the loaded authoritative admin catalogue, separately for each category and independently of the table search/filter/page. Publish/unpublish operations update the same rows and therefore update the counts on render. No fixed counts or database queries were added.

`/trips` intentionally uses nine cards per page. Eleven published records appear as nine on page one and two on page two, with total/result range and pagination controls. This behavior remains unchanged.

An important distinction: `All trips 9` together with `9 trips found` and `Showing 1–9 of 9` means that the loaded catalogue contains nine records, not that pagination is hiding two. The original shared client cache had no expiry and returned its first successful response indefinitely. Returning from an admin tab after publishing could therefore keep an earlier count. The catalogue now revalidates on window focus/visible-tab transitions, and an expired cache is revalidated when a consumer mounts (30-second freshness window). Requests bypass the browser HTTP cache. Concurrent consumers share the request and one foreground subscription; the last consumer removes the event listeners. Existing records remain available while a background refresh runs or fails. This is not continuous polling or a guarantee of immediate cross-device updates without navigation/focus/refresh.

During the read-only investigation, the live public API returned twelve published records. An offline check of that captured response confirmed all twelve survive the actual client decoding, with zero discarded rows. The cache regression reproduced an initial nine-record result remaining nine after the source increased to twelve, then passed with the revalidation fix. The public server and database were not changed.

Regression coverage renders the actual homepage, day-tour directory, all four category listings and `/trips` with new database slugs. It verifies Draft exclusion, category isolation, CMS manual selection, and eleven-record pagination. Tests use in-memory data and do not access a database, API, or browser. No production writes or publishing are part of this change.

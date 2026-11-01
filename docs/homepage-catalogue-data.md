# Homepage catalogue data

- **Explore Egypt's Top Tours** uses the published database catalogue, including new slugs of every tour type. The original seasonal references can retain their relative priority, but no longer exclude newly created records. Manual CMS selections and section limits still apply. Cards use canonical slug keys, independent of title changes or duplicate titles.
- **Special offers for you** uses offer records, not an automatic offer for every new tour. Publication, validity dates, homepage placement and linked-tour publication rules remain unchanged. Its existing default is four cards unless configured otherwise.
- **Highlights of Egypt** uses published destination records eligible for directory display. Creating a tour does not create or publish a destination.
- **Our Travel Blogs** uses published blog records. The homepage no longer substitutes bootstrap articles while the database response is unavailable. Creating a tour does not create a blog post.

All four sections preserve their CMS manual/automatic modes, visibility, limits, layout and localization owners. No schema, database, pricing, booking, publication or offer-placement writes are involved.

## Cache freshness

Public offers, blogs, destinations and category lists revalidate on window focus or return to a visible tab. A newly mounted consumer also revalidates a cache older than 30 seconds. Requests bypass browser HTTP caching; concurrent consumers share the pending request and one foreground subscription per catalogue. The last consumer removes its listeners. Successful empty responses are valid empty lists; background failures retain the last loaded data. No polling is added.

Generation guards discard pre-invalidation responses so a late response cannot resurrect unpublished/deleted data. Initial private data requests remain isolated from public caches. Admin editor snapshots do not receive automatic focus/age refreshes; explicit save/invalidation/retry/refresh behavior remains available. A background public request finishing after navigation into an editor is discarded rather than replacing the editor's snapshot.

Regression tests render the real homepage Top Tours with newly published slugs across all four categories and with manual CMS selection. Cache lifecycle tests cover all three affected content domains, foreground refresh, request deduplication, stale mounting, failed refreshes, stale-response races, and editor protection. Tests use mocked responses and no browser or database. Actual browser rendering was not tested, per project rules.

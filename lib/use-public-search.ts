'use client'

import { useDbTours, useDbToursStatus } from './tours-client'
import { usePublicDestinationsStatus } from './catalogue-client'
import { useDbEvents, useDbEventsStatus } from './events-cars-client'
import { useDbBlogs, useDbOffers, useDbOffersStatus, usePublicBlogsStatus } from './offers-blogs-client'
import { searchPublishedContent } from './site-search'

/** Shared authoritative collections for the full page and lazy header suggestions. */
export function usePublicSearch(query: string) {
  const tours = useDbTours([], { includeNew: true })
  const tourStatus = useDbToursStatus([], { includeNew: true })
  // Reopening a suggestion list must share the warm cache/in-flight request,
  // not force a second request on every focus or keystroke.
  const destinations = usePublicDestinationsStatus({ revalidateOnMount: false })
  const events = useDbEvents([])
  const eventStatus = useDbEventsStatus()
  const offers = useDbOffers([])
  const offerStatus = useDbOffersStatus()
  const blogs = useDbBlogs([])
  const blogStatus = usePublicBlogsStatus()
  const statuses = [tourStatus, destinations, eventStatus, offerStatus, blogStatus]
  const failed = statuses.filter(status => status.error)
  return {
    results: searchPublishedContent({ tours, destinations: destinations.data ?? [], events, offers, blogs }, query),
    loading: statuses.some(status => status.loading || status.data === null && !status.error),
    failed,
    retry: () => failed.forEach(status => status.retry()),
  }
}

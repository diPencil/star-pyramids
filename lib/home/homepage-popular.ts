import type { Tour } from '@/data/types'
import { selectPageRecords, type PageSection } from '../cms/page-sections'
import { isTourPublished } from '../tours/tour-publish'
import { RECOMMENDED_CARD_LIMIT, sessionRecommendedOrder, type RecommendationSession } from './homepage-recommendation-session'

/** Recommended has an eight-card ceiling. Other tabs keep their own selection. */
export function selectHomepagePopular(category: string, section: PageSection | undefined, popular: readonly Tour[], catalogue: readonly Tour[], selected: readonly Tour[], session: RecommendationSession = { seed: 0, slugs: [] }): Tour[] {
  const automatic = category === 'All'
    ? sessionRecommendedOrder(popular.filter(isTourPublished), session)
    : catalogue.filter(tour => isTourPublished(tour) && tour.category === category).slice(0, 8)
  const records = section?.selectionMode === 'selected'
    ? selectPageRecords(section, selected.filter(isTourPublished)).filter(tour => category === 'All' || tour.category === category)
    : selectPageRecords(section, automatic)
  return category === 'All' ? records.slice(0, RECOMMENDED_CARD_LIMIT) : records
}

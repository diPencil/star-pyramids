import { cars } from '@/data/content'
import { VehicleDetailContent } from './content'

/**
 * Static-export route: canonical slugs are known at build time (same pattern
 * as customers/[key] and car-requests/[id]). Runtime-created custom vehicles
 * resolve through client-side navigation from the fleet list, like the
 * existing customers module.
 */
export function generateStaticParams() {
  return cars.map((car) => ({ slug: car.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <VehicleDetailContent vehicleSlug={slug} />
}

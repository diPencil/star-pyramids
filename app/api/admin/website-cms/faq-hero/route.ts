import { readEditorialHeroApi, updateEditorialHeroApi } from '@/lib/server/editorial-hero-api'
export function GET() { return readEditorialHeroApi('faq') }
export function PATCH(request: Request) { return updateEditorialHeroApi(request, 'faq') }

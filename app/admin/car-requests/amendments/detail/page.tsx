'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AmendmentReviewContent } from './content'

function AmendmentReviewFromQuery() {
  const params = useSearchParams()
  return <AmendmentReviewContent amendmentRef={params.get('ref') ?? ''} />
}

export default function Page() {
  return <Suspense><AmendmentReviewFromQuery /></Suspense>
}

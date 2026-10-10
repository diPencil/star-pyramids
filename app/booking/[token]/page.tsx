import type { Metadata } from 'next';

import { GuestBookingPage } from '@/components/account-portal';

// Personal booking data lives in this URL, so it must never be indexed,
// cached, or prerendered.
export const metadata: Metadata = {
  title: 'Your booking | Star Pyramids',
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = 'force-dynamic';

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/**
 * Thin route wrapper. The token is deliberately NOT read here and NOT passed
 * down as a prop: the client view reads it from the router, so the credential
 * is never serialized into the server-rendered HTML.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ print?: string | string[] }>
}) {
  const { print } = await searchParams
  return <GuestBookingPage autoPrint={first(print) === '1'} />
}
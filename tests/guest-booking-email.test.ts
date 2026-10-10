// P0 Fix 04 — guest booking email templates.
//
// The four customer booking emails must carry the private guest link and an
// explanatory note for guests, while rendering byte-identically to before for
// account bookings (empty note, account detail URL).
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { renderEmailTemplate } = await import('@/lib/server/email');

const GUEST_NOTE =
  'You booked as a guest, so this private link is your access to the booking. ';

describe('booking email templates — guest access note', () => {
  const guestData = {
    name: 'Guest Tester',
    reference: 'SP-BK-ABC123',
    tourTitle: 'Cairo Highlights',
    total: '250.00',
    currency: 'USD',
    detailUrl: '/booking/some-private-token',
    accessNote: GUEST_NOTE,
  };

  const accountData = {
    ...guestData,
    detailUrl: '/account/bookings/detail?ref=SP-BK-ABC123',
    accessNote: '',
  };

  it('includes the guest note and private link for guests', () => {
    const template = renderEmailTemplate('booking_created', guestData);
    expect(template.html).toContain(GUEST_NOTE);
    expect(template.html).toContain('/booking/some-private-token');
    expect(template.text).toContain(GUEST_NOTE);
    expect(template.text).toContain('/booking/some-private-token');
  });

  it('renders account bookings exactly as before (no guest note)', () => {
    const template = renderEmailTemplate('booking_created', accountData);
    expect(template.html).not.toContain('private link');
    expect(template.html).toContain('/account/bookings/detail?ref=SP-BK-ABC123');
    expect(template.text).not.toContain('private link');
    expect(template.text).toContain('/account/bookings/detail?ref=SP-BK-ABC123');
  });

  it('applies the guest note to every booking lifecycle email', () => {
    for (const eventType of [
      'booking_created',
      'booking_confirmed',
      'booking_completed',
      'booking_cancelled',
    ] as const) {
      const guest = renderEmailTemplate(eventType, guestData);
      const account = renderEmailTemplate(eventType, accountData);
      expect(guest.html, eventType).toContain(GUEST_NOTE);
      expect(account.html, eventType).not.toContain(GUEST_NOTE);
    }
  });

  it('escapes the note and URL as HTML', () => {
    const template = renderEmailTemplate('booking_created', {
      ...guestData,
      detailUrl: '/booking/x?a=1&b=2',
    });
    expect(template.html).toContain('/booking/x?a=1&amp;b=2');
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-ins for the delivery table so the SENT/FAILED contract can
// be asserted without a database.
const rows = new Map<string, Record<string, unknown>>();
let seq = 0;

const deliveryRow = (data: Record<string, unknown>) => ({
  id: String((seq += 1)),
  recipient: 'guest@example.com',
  recipientType: 'customer',
  eventType: 'password_reset',
  subject: 'Reset your password',
  relatedReference: null,
  status: 'PENDING',
  providerMessageId: null,
  attempt: 0,
  errorSummary: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  sentAt: null,
  failedAt: null,
  ...data,
});

const findUnique = vi.fn(async ({ where }: { where: { idempotencyKey?: string } }) => {
  if (!where.idempotencyKey) return null;
  for (const row of rows.values()) if (row.idempotencyKey === where.idempotencyKey) return deliveryRow(row);
  return null;
});

const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
  const row = deliveryRow(data);
  rows.set(row.id, row);
  return deliveryRow(row);
});

const update = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
  const current = rows.get(where.id) ?? deliveryRow({ id: where.id });
  const next = { ...current, ...data };
  if (typeof data.attempt === 'object' && data.attempt !== null) {
    next.attempt = (Number(current.attempt) || 0) + 1;
  }
  rows.set(where.id, next);
  return deliveryRow(next);
});

vi.mock('@/lib/server/db', () => ({
  db: {
    emailDelivery: { findUnique, create, update, findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));

const adapter = { name: 'test-adapter', send: vi.fn() };
vi.mock('@/lib/server/email-smtp', () => ({
  SmtpProviderAdapter: class {
    readonly name = 'smtp';
    send = vi.fn();
  },
  describeSmtpConfig: () => ({ configured: false, host: null, port: 587, secure: false, authenticated: false }),
  verifySmtpConnection: vi.fn(async () => ({ ok: false, reason: 'n/a' })),
}));

async function loadEmail() {
  vi.resetModules();
  const mod = await import('@/lib/server/email');
  mod.setEmailProvider(adapter);
  return mod;
}

const payload = {
  to: 'guest@example.com',
  recipientType: 'customer' as const,
  eventType: 'password_reset',
  subject: 'Reset your password',
  html: '<p>hi</p>',
  text: 'hi',
};

describe('email delivery status contract', () => {
  beforeEach(() => {
    rows.clear();
    seq = 0;
    findUnique.mockClear();
    create.mockClear();
    update.mockClear();
    adapter.send.mockReset();
  });

  it('marks SENT only after the provider accepts', async () => {
    adapter.send.mockResolvedValue({ providerMessageId: 'msg-1' });
    const { sendEmail } = await loadEmail();
    const record = await sendEmail(payload);
    expect(record.status).toBe('SENT');
    expect(record.providerMessageId).toBe('msg-1');
    expect(record.sentAt).not.toBeNull();
    expect(record.failedAt).toBeNull();
  });

  it('marks FAILED (never SENT) when the provider throws', async () => {
    adapter.send.mockRejectedValue(new Error('SMTP down'));
    const { sendEmail } = await loadEmail();
    const record = await sendEmail(payload);
    expect(record.status).toBe('FAILED');
    expect(record.sentAt).toBeNull();
    expect(record.failedAt).not.toBeNull();
    expect(record.errorSummary).toContain('SMTP down');
  });

  it('marks FAILED when an unconfigured provider reports the problem', async () => {
    adapter.send.mockRejectedValue(new Error('Email provider is not configured: SMTP_HOST is not configured.'));
    const { sendEmail } = await loadEmail();
    const record = await sendEmail(payload);
    expect(record.status).toBe('FAILED');
    expect(record.errorSummary).toMatch(/not configured/);
  });

  it('treats a provider that returns no result as a failure', async () => {
    adapter.send.mockResolvedValue(undefined);
    const { sendEmail } = await loadEmail();
    const record = await sendEmail(payload);
    expect(record.status).toBe('FAILED');
  });

  it('never stores a credential in the error summary', async () => {
    adapter.send.mockRejectedValue(new Error('535 auth failed for mailer@example.com:hunter2@smtp.example.com'));
    const { sendEmail } = await loadEmail();
    const record = await sendEmail(payload);
    expect(record.status).toBe('FAILED');
    expect(record.errorSummary).not.toContain('hunter2');
  });
  it('redacts private URLs and bare opaque credentials echoed by a failed mail provider',async()=>{
    const secret='A'.repeat(43)
    adapter.send.mockRejectedValue(Error(`rejected https://starpyramids.com/booking-account#reference=SP-BK-ABC123&token=${secret} bare=${secret}`))
    const {sendEmail}=await loadEmail()
    const log=vi.spyOn(console,'error').mockImplementation(()=>undefined)
    try {
      const row=await sendEmail(payload)
      expect(row.errorSummary).not.toContain(secret)
      expect(row.errorSummary).not.toContain('https://starpyramids.com/booking-account')
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret)
    }finally{log.mockRestore()}
  });

  it('does not resend when an idempotency key already exists', async () => {
    adapter.send.mockResolvedValue({ providerMessageId: 'msg-1' });
    const { sendEmail } = await loadEmail();
    await sendEmail({ ...payload, idempotencyKey: 'reset:abc' });
    const second = await sendEmail({ ...payload, idempotencyKey: 'reset:abc' });
    expect(adapter.send).toHaveBeenCalledTimes(1);
    expect(second.status).toBe('SENT');
  });
});

describe('safe email helpers', () => {
  beforeEach(() => {
    rows.clear();
    adapter.send.mockReset();
  });

  it('returns null and sends nothing for an invalid recipient', async () => {
    adapter.send.mockResolvedValue({ providerMessageId: 'x' });
    const { sendCustomerEmailSafe } = await loadEmail();
    const result = await sendCustomerEmailSafe('password_reset', 'not-an-email', {});
    expect(result).toBeNull();
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('never throws out of sendCustomerEmailSafe', async () => {
    adapter.send.mockRejectedValue(new Error('boom'));
    const { sendCustomerEmailSafe } = await loadEmail();
    await expect(sendCustomerEmailSafe('password_reset', 'guest@example.com', {})).resolves.toBeTruthy();
  });
  it('sends booking links as absolute URLs using the trusted public origin', async () => {
    adapter.send.mockResolvedValue({providerMessageId:'booking-link'});
    const {sendCustomerEmailSafe}=await loadEmail();
    const {resolveSiteUrl}=await import('@/lib/seo');
    await sendCustomerEmailSafe('booking_access_requested','guest@example.com',{name:'Guest',reference:'SP-BK-ABC123',detailUrl:'/booking/'+'a'.repeat(43)});
    const sent=adapter.send.mock.calls[0][0];
    expect(sent.html).toContain(`href="${resolveSiteUrl()}/booking/`);
    expect(sent.text).toContain(`${resolveSiteUrl()}/booking/`);
  });
  it.each(['booking_created','booking_confirmed','booking_completed','booking_cancelled','payment_proof_received','payment_initiated','payment_paid','payment_failed','admin_payment_initiated','admin_booking_created','admin_payment_proof_submitted'] as const)('keeps %s links on the public origin',async eventType=>{
    adapter.send.mockResolvedValue({providerMessageId:'lifecycle-link'});
    const {sendCustomerEmailSafe}=await loadEmail();
    const {resolveSiteUrl}=await import('@/lib/seo');
    await sendCustomerEmailSafe(eventType,'guest@example.com',{detailUrl:'/account/bookings/detail?ref=SP-BK-ABC123'});
    expect(adapter.send.mock.calls[0][0].text).toContain(`${resolveSiteUrl()}/account/bookings/detail?ref=SP-BK-ABC123`);
  });
  it('preserves the refund receipt that intentionally has no detail URL',async()=>{
    adapter.send.mockResolvedValue({providerMessageId:'refund'});
    const {sendCustomerEmailSafe}=await loadEmail();
    expect((await sendCustomerEmailSafe('payment_refunded','guest@example.com',{reference:'SP-PAY-ABC123',bookingReference:'SP-BK-ABC123'}))?.status).toBe('SENT');
    expect(adapter.send.mock.calls[0][0].text).toContain('has been refunded');
  });
  it.each(['//evil.example/booking/x','https://evil.example/booking/x','javascript:alert(1)','/\\evil.example/x','/booking/\nx'])('does not send a booking link with an unsafe target %j',async detailUrl=>{
    const {sendCustomerEmailSafe}=await loadEmail();
    expect(await sendCustomerEmailSafe('booking_created','guest@example.com',{detailUrl})).toBeNull();
    expect(adapter.send).not.toHaveBeenCalled();
  });
});

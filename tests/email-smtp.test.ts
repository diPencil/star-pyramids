import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn();
const verify = vi.fn();
const createTransport = vi.fn(() => ({ sendMail, verify }));

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

const SMTP_ENV_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM_EMAIL',
  'SMTP_FROM_NAME',
  'SMTP_REPLY_TO',
  'SMTP_ALLOW_UNAUTH',
  'SMTP_TIMEOUT_MS',
] as const;

function clearSmtpEnv() {
  for (const key of SMTP_ENV_KEYS) delete process.env[key];
}

function setSmtpEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

async function loadModule() {
  vi.resetModules();
  return import('@/lib/server/email-smtp');
}

const input = {
  to: 'guest@example.com',
  recipientType: 'customer' as const,
  eventType: 'password_reset',
  subject: 'Reset your password',
  html: '<p>hello</p>',
  text: 'hello',
};

describe('SMTP provider configuration', () => {
  beforeEach(() => {
    clearSmtpEnv();
    sendMail.mockReset();
    verify.mockReset();
    createTransport.mockClear();
  });

  afterEach(() => {
    clearSmtpEnv();
  });

  it('reports not configured when SMTP_HOST is absent', async () => {
    const { describeSmtpConfig } = await loadModule();
    const status = describeSmtpConfig();
    expect(status.configured).toBe(false);
    expect(status.reason).toMatch(/SMTP_HOST/);
  });

  it('reports not configured when credentials are missing', async () => {
    const { describeSmtpConfig } = await loadModule();
    setSmtpEnv({ SMTP_HOST: 'smtp.example.com' });
    const status = describeSmtpConfig();
    expect(status.configured).toBe(false);
    expect(status.reason).toMatch(/SMTP_USER/);
  });

  it('never exposes a password in the configuration summary', async () => {
    const { describeSmtpConfig } = await loadModule();
    setSmtpEnv({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASSWORD: 'super-secret-value',
    });
    const status = describeSmtpConfig();
    const serialized = JSON.stringify(status);
    expect(status.configured).toBe(true);
    expect(serialized).not.toContain('super-secret-value');
  });

  it('defaults to STARTTLS on port 587', async () => {
    const { describeSmtpConfig } = await loadModule();
    setSmtpEnv({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASSWORD: 'secret',
    });
    const status = describeSmtpConfig();
    expect(status.port).toBe(587);
    expect(status.secure).toBe(false);
  });

  it('supports implicit TLS when SMTP_SECURE is true', async () => {
    const { describeSmtpConfig } = await loadModule();
    setSmtpEnv({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASSWORD: 'secret',
    });
    const status = describeSmtpConfig();
    expect(status.port).toBe(465);
    expect(status.secure).toBe(true);
  });
});

describe('SMTP delivery', () => {
  beforeEach(() => {
    clearSmtpEnv();
    sendMail.mockReset();
    verify.mockReset();
    createTransport.mockClear();
    setSmtpEnv({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASSWORD: 'secret',
    });
  });

  afterEach(() => {
    clearSmtpEnv();
  });

  it('sends and returns the provider message id', async () => {
    sendMail.mockResolvedValue({ messageId: '<abc@mail.example.com>', response: '250 OK', accepted: ['guest@example.com'] });
    const { SmtpProviderAdapter } = await loadModule();
    const result = await new SmtpProviderAdapter().send(input);
    expect(result.providerMessageId).toBe('<abc@mail.example.com>');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('throws (never resolves) when the server accepted nobody', async () => {
    sendMail.mockResolvedValue({ messageId: 'x', response: '550 rejected', accepted: [] });
    const { SmtpProviderAdapter } = await loadModule();
    await expect(new SmtpProviderAdapter().send(input)).rejects.toThrow(/did not accept/i);
  });

  it('propagates a transport error so the caller can record FAILED', async () => {
    sendMail.mockRejectedValue(new Error('535 Authentication failed'));
    const { SmtpProviderAdapter } = await loadModule();
    await expect(new SmtpProviderAdapter().send(input)).rejects.toThrow(/535/);
  });

  it('fails closed when configuration is removed', async () => {
    clearSmtpEnv();
    const { SmtpProviderAdapter, SmtpNotConfiguredError } = await loadModule();
    await expect(new SmtpProviderAdapter().send(input)).rejects.toBeInstanceOf(SmtpNotConfiguredError);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('uses the configured From address and never a client-supplied one', async () => {
    sendMail.mockResolvedValue({ messageId: 'm', response: '250 OK', accepted: ['guest@example.com'] });
    const { SmtpProviderAdapter } = await loadModule();
    await new SmtpProviderAdapter().send(input);
    const arg = sendMail.mock.calls[0]![0] as { from: { address: string } };
    expect(arg.from.address).toBe('mailer@example.com');
  });
});

describe('SMTP verification', () => {
  beforeEach(() => {
    clearSmtpEnv();
    verify.mockReset();
    setSmtpEnv({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASSWORD: 'secret',
    });
  });

  afterEach(() => {
    clearSmtpEnv();
  });

  it('reports success when the server verifies', async () => {
    verify.mockResolvedValue(true);
    const { verifySmtpConnection } = await loadModule();
    await expect(verifySmtpConnection()).resolves.toEqual({ ok: true });
  });

  it('reports a safe reason when verification fails', async () => {
    verify.mockRejectedValue(new Error('ECONNREFUSED'));
    const { verifySmtpConnection } = await loadModule();
    const result = await verifySmtpConnection();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ECONNREFUSED');
  });
});

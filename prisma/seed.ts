// Prisma seed — SAFE SYSTEM DEFINITIONS ONLY.
// Seeds: role definitions + technical application defaults.
// NEVER seed: users, demo customers/staff, bookings, requests, payments,
// dashboard fixtures, reviews, or catalogue content.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const ROLES: Array<{ key: string; name: string; description: string; isSystem: boolean }> = [
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full platform control, including roles and settings.',
    isSystem: true,
  },
  {
    key: 'ADMIN',
    name: 'Admin',
    description: 'Operational administration (catalogue, requests, bookings).',
    isSystem: false,
  },
  {
    key: 'STAFF',
    name: 'Staff',
    description: 'Day-to-day operations within assigned areas.',
    isSystem: false,
  },
  {
    key: 'CUSTOMER',
    name: 'Customer',
    description: 'Registered website customer.',
    isSystem: true,
  },
];

// Technical defaults only — business identity/contact values are set by
// the owner later through admin/settings, never seeded as truth here.
const SETTINGS: Array<{ key: string; value: string; description: string }> = [
  {
    key: 'app.defaultLocale',
    value: 'en',
    description: 'Default site language (en|ar).',
  },
  {
    key: 'app.defaultCurrency',
    value: 'USD',
    description: 'Default display currency (base currency).',
  },
  {
    key: 'app.timezone',
    value: 'Africa/Cairo',
    description: 'Business timezone for display.',
  },
];

async function main(): Promise<void> {
  for (const role of ROLES) {
    await db.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: role.isSystem },
      create: role,
    });
  }
  for (const setting of SETTINGS) {
    await db.siteSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: setting,
    });
  }
  // Anchor rate: base currency to itself. Quote rates are set by the owner.
  await db.fxRate.upsert({
    where: {
      baseCurrency_quoteCurrency: { baseCurrency: 'USD', quoteCurrency: 'USD' },
    },
    update: { rate: '1', isActive: true, source: 'system' },
    create: {
      baseCurrency: 'USD',
      quoteCurrency: 'USD',
      rate: '1',
      source: 'system',
    },
  });
  console.log('Seed complete: roles + technical defaults.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });

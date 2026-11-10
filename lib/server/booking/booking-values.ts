import 'server-only';
import { Prisma, BookingStatus as DbStatus } from '@prisma/client';
import { type BookingStatus } from '@/lib/booking/booking';

export const TO_DB_STATUS: Record<BookingStatus, DbStatus> = {
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

export const FROM_DB_STATUS: Record<DbStatus, BookingStatus> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};
export const NOTE_MAX = 1000;

export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function decimalToCents(value: Prisma.Decimal | number | string): number {
  return Math.round(Number(value.toString()) * 100);
}

export function dollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function hasControlChars(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f]/.test(value);
}

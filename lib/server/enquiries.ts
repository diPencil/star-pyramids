import 'server-only';
import { Prisma } from '@prisma/client';

export const enquirySelect = {
  publicId: true, name: true, email: true, phone: true, subject: true,
  message: true, sourcePage: true, status: true, createdAt: true, updatedAt: true,
  internalNotes: true,
  assignedTo: { select: { publicId: true, email: true, firstName: true, lastName: true, roles: { select: { role: { select: { key: true, name: true } } } } } },
} satisfies Prisma.WebsiteEnquirySelect;

// Same eligibility for the picker and mutation boundary; custom staff roles
// participate through their real grants, while CUSTOMER-only users cannot.
export const enquiryStaffWhere = {
  status: 'ACTIVE',
  roles: { some: { role: { key: { not: 'CUSTOMER' } } } },
  OR: [
    { roles: { some: { role: { key: 'SUPER_ADMIN' } } } },
    { roles: { some: { role: { grants: { some: { permission: { key: 'enquiries.manage' } } } } } } },
  ],
} satisfies Prisma.UserWhereInput;

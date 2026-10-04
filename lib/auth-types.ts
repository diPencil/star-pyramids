export type AuthenticatedUser = {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  countryCode: string | null;
  phone: string | null;
  status: string;
  emailVerifiedAt: Date | string | null;
  lastLoginAt: Date | string | null;
  roles: string[];
};

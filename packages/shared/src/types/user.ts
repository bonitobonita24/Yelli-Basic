import type { Role } from "./enums";

export interface User {
  id: string;
  tenantId: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  displayName: string;
  role: Role;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

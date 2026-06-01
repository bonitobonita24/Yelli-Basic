export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  logoUrl: string | null;
  isSuspended: boolean;
  adminPassphraseHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

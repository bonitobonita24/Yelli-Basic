'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/react';

/**
 * Admin → Org settings (PRODUCT.md Page 18 "Org settings (Cloud)" — display name +
 * slug). The deferred S3c sibling of ScreenAdmin{Members,Invitations,Audit};
 * mounts behind the W1b admin gate at /admin/settings.
 *
 * SWAP BOUNDARY — REUSE, not a new procedure (gate-#1 scope decision, 2026-06-13):
 *   - read  → `trpc.tenants.get`  (slug + displayName)
 *   - write → `trpc.brand.update({ displayName })` — the ONLY editable Tenant field a
 *     Tenant Admin owns is displayName, and brand.update already owns it + emits the
 *     LOCKED §11 audit action `tenant.branding.update`. A dedicated `tenants.update`
 *     would either duplicate brand.update or illegally extend the locked vocabulary
 *     (packages/shared/src/audit.ts has no tenant.profile.update). So this screen wires
 *     the existing branding mutation; logo upload stays on the separate /admin/branding
 *     surface (flow #7).
 *
 * `slug` is rendered READ-ONLY (immutable after creation — PRODUCT.md "Tenant slug
 * rules [Step 7]"; rename = Super-Admin DB migration via /_pwbt/). The display-name
 * bound (≤60) mirrors the brand.update server validator verbatim so the client never
 * disagrees with the wire (the PRODUCT.md ≤40 guidance is the softer UX hint).
 *
 * Clay semantic tokens only (ui-rules Rule 3 — zero raw hex); mobile-first single
 * column (PRODUCT.md row 18 "single-column form sections"); loading = shadcn
 * <Skeleton> (ui-rules Rule 11 PATH A). RHF + Zod via the shadcn Form wrapper
 * (ui-rules forms contract — this is the wrapper's first production use).
 */

const DISPLAY_NAME_MAX = 60; // mirrors brand.update's displayNameSchema (server contract).

const formSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Organization name is required.')
    .max(DISPLAY_NAME_MAX, `Keep it under ${DISPLAY_NAME_MAX} characters.`),
});

type FormValues = z.infer<typeof formSchema>;

export default function ScreenTenantSettings(): React.JSX.Element {
  const utils = trpc.useUtils();
  const tenantQuery = trpc.tenants.get.useQuery();

  if (tenantQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-[720px] space-y-6 px-4 py-6 md:px-12 md:py-12">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    );
  }

  if (tenantQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-6 md:px-12 md:py-12">
        <div className="rounded-lg border border-error-strong/30 bg-error-strong/10 p-6 text-sm text-error-strong">
          Couldn&apos;t load organization settings. Please refresh and try again.
        </div>
      </div>
    );
  }

  return <OrgSettingsForm tenant={tenantQuery.data} onSaved={() => void utils.tenants.get.invalidate()} />;
}

function OrgSettingsForm({
  tenant,
  onSaved,
}: {
  tenant: { slug: string; displayName: string };
  onSaved: () => void;
}): React.JSX.Element {
  const [saved, setSaved] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: tenant.displayName },
  });

  const update = trpc.brand.update.useMutation({
    onSuccess: (updated) => {
      onSaved();
      form.reset({ displayName: updated.displayName });
      setSaved(true);
    },
  });

  const onSubmit = (values: FormValues): void => {
    setSaved(false);
    update.mutate({ displayName: values.displayName });
  };

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-6 px-4 py-6 md:px-12 md:py-12">
      <header>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          Org settings
        </h1>
        <div className="mt-1 text-sm text-text-muted">Your organization&apos;s name and address</div>
      </header>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 rounded-lg border border-border bg-surface p-5 md:p-6"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            Organization
          </div>

          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={DISPLAY_NAME_MAX}
                    autoComplete="organization"
                    placeholder="Acme Clinic"
                    onChange={(e) => {
                      setSaved(false);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Shown in the top bar, the directory, and on incoming-call screens.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Slug — immutable after creation (PRODUCT.md Step 7). Read-only, never posted. */}
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">Address</Label>
            <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-canvas">
              <Input
                id="tenant-slug"
                value={tenant.slug}
                readOnly
                disabled
                aria-describedby="tenant-slug-help"
                className="flex-1 cursor-not-allowed border-0 bg-transparent font-mono text-text-muted focus-visible:ring-0"
              />
              <span className="grid place-items-center whitespace-nowrap border-l border-border bg-surface px-3 font-mono text-sm text-text-muted">
                .yelli-basic.powerbyte.app
              </span>
            </div>
            <p id="tenant-slug-help" className="text-[0.8rem] text-text-muted">
              Your address is permanent. To change it, contact support.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            {saved && !form.formState.isDirty && (
              <span className="text-sm text-success-strong" role="status">
                Saved.
              </span>
            )}
            {update.isError && (
              <span className="text-sm text-error-strong" role="alert">
                Couldn&apos;t save. Please try again.
              </span>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}

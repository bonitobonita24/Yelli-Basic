'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/react';

/**
 * ScreenDataPrivacy — DSR self-service UI (V32.9 / Rule 33).
 *
 * Wires all four DSR procedures:
 *   dsr.access    → Right to Access: download own data JSON
 *   dsr.port      → Right to Portability: download portable JSON export
 *   dsr.rectify   → Right to Rectification: edit own displayName / email
 *   dsr.erase     → Right to Erasure: delete-my-account with confirm dialog
 *   dsr.myRequests → show own DSR history
 *
 * Session-derived: userId / tenantId come from ctx.user server-side — we pass NOTHING
 * identifying from the client (L6 tenant isolation, security.md #13).
 *
 * Clay semantic tokens only (ui-rules Rule 3 — zero raw hex).
 * Touch targets ≥44px on all interactive elements (PRODUCT.md §9 / WCAG 2.5.5).
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Rectify form schema ──────────────────────────────────────────────────────

const rectifySchema = z
  .object({
    displayName: z.string().trim().max(60).optional(),
    email: z.string().max(254).optional(),
  })
  .superRefine((v, ctx) => {
    const hasName = (v.displayName?.trim().length ?? 0) > 0;
    const hasEmail = (v.email?.trim().length ?? 0) > 0;
    if (!hasName && !hasEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Update at least one field.', path: ['displayName'] });
    }
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email!)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid email address.', path: ['email'] });
    }
  });

type RectifyValues = z.infer<typeof rectifySchema>;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Access + Port (download) section */
function DownloadSection() {
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [loadingPort, setLoadingPort] = useState(false);
  const accessQuery = trpc.dsr.access.useQuery(undefined, { enabled: false });
  const portQuery = trpc.dsr.port.useQuery(undefined, { enabled: false });

  const handleAccess = async () => {
    setLoadingAccess(true);
    try {
      const data = await accessQuery.refetch();
      if (data.data) {
        downloadJson(data.data, `yelli-my-data-${Date.now()}.json`);
        toast.success('Data report downloaded.');
      }
    } catch {
      toast.error('Failed to retrieve your data. Please try again.');
    } finally {
      setLoadingAccess(false);
    }
  };

  const handlePort = async () => {
    setLoadingPort(true);
    try {
      const data = await portQuery.refetch();
      if (data.data) {
        downloadJson(data.data, `yelli-data-export-${Date.now()}.json`);
        toast.success('Data export downloaded.');
      }
    } catch {
      toast.error('Failed to export your data. Please try again.');
    } finally {
      setLoadingPort(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-foreground">Download your data</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Right of Access (RA 10173 §16(c)) and Data Portability (§16(f)). Both exports are
        machine-readable JSON.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => void handleAccess()}
          disabled={loadingAccess}
          aria-busy={loadingAccess}
          className="min-h-11 min-w-[160px]"
        >
          {loadingAccess ? 'Preparing…' : 'View my data (Access)'}
        </Button>
        <Button
          variant="outline"
          onClick={() => void handlePort()}
          disabled={loadingPort}
          aria-busy={loadingPort}
          className="min-h-11 min-w-[160px]"
        >
          {loadingPort ? 'Preparing…' : 'Download export (Port)'}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Access report includes: your profile, devices, call sessions, audit entries, and consent
        records. This request is logged and counts toward your statutory record.
      </p>
    </Card>
  );
}

/** Rectify (edit own profile) section */
function RectifySection() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const form = useForm<RectifyValues>({
    resolver: zodResolver(rectifySchema),
    defaultValues: { displayName: '', email: '' },
  });

  const rectify = trpc.dsr.rectify.useMutation({
    onSuccess: () => {
      toast.success('Profile updated successfully.');
      setOpen(false);
      form.reset();
      // Invalidate any cached user data
      void utils.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? 'Failed to update profile. Please try again.');
    },
  });

  const onSubmit = (values: RectifyValues) => {
    const patch: { displayName?: string; email?: string } = {};
    if (values.displayName && values.displayName.trim().length > 0)
      patch.displayName = values.displayName.trim();
    if (values.email && values.email.trim().length > 0) patch.email = values.email.trim();
    rectify.mutate(patch);
  };

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-foreground">Edit your profile</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Right to Rectification (RA 10173 §16(d)). Correct your display name or email address.
      </p>
      <div className="mt-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="min-h-11">
              Edit profile
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit your profile</DialogTitle>
              <DialogDescription>
                Fill in only the fields you want to change. Leave blank to keep the current value.
                Changing your email will require re-verification and will sign out other sessions.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
                className="space-y-4"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="rectify-displayName">Display name</FormLabel>
                      <FormControl>
                        <Input
                          id="rectify-displayName"
                          placeholder="Leave blank to keep current"
                          autoComplete="name"
                          className="min-h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="rectify-email">Email address</FormLabel>
                      <FormControl>
                        <Input
                          id="rectify-email"
                          type="email"
                          placeholder="Leave blank to keep current"
                          autoComplete="email"
                          className="min-h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="min-h-11"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={rectify.isPending}
                    aria-busy={rectify.isPending}
                    className="min-h-11"
                  >
                    {rectify.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}

/** Erase (delete account) section */
function EraseSection() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const erase = trpc.dsr.erase.useMutation({
    onSuccess: () => {
      toast.success('Your account has been scheduled for deletion. You will be signed out shortly.');
      setOpen(false);
      // Redirect to login after a short delay — the session will be invalidated server-side
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    },
    onError: (err) => {
      toast.error(err.message ?? 'Failed to process deletion request. Please try again.');
      setConfirming(false);
    },
  });

  const handleConfirm = () => {
    setConfirming(true);
    erase.mutate();
  };

  return (
    <Card className="border-destructive/30 p-5">
      <h3 className="text-base font-semibold text-foreground">Delete my account</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Right to Erasure / Blocking (RA 10173 §16(e)). Your account will be immediately suspended
        and permanently deleted after a 7-day grace period.
      </p>
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground" role="list">
        <li>▸ Your account and devices will be suspended immediately.</li>
        <li>▸ Hard delete occurs after the 7-day grace period (contact DPO to cancel).</li>
        <li>
          ▸ Audit log entries (7 yr) and call session records (1 yr) are exempt from deletion by
          law (RA 10173 §21).
        </li>
      </ul>
      <div className="mt-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="min-h-11 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Delete my account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This will immediately suspend your account and schedule it for permanent deletion
                after 7 days. This action cannot be undone. Audit log and call session records are
                retained as required by law.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={confirming}
                className="min-h-11"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={confirming || erase.isPending}
                aria-busy={confirming || erase.isPending}
                className="min-h-11"
              >
                {confirming || erase.isPending ? 'Processing…' : 'Yes, delete my account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}

/** DSR history section */
function DsrHistory() {
  const historyQuery = trpc.dsr.myRequests.useQuery();

  if (historyQuery.isPending) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-16 w-full" />
      </Card>
    );
  }

  if (historyQuery.isError || !historyQuery.data) return null;
  if (historyQuery.data.length === 0) return null;

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-foreground">Your request history</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        All data subject requests you have submitted (statutory log per RA 10173 §35).
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="pb-2 text-left text-xs font-semibold text-muted-foreground">
                Type
              </th>
              <th scope="col" className="pb-2 text-left text-xs font-semibold text-muted-foreground">
                Status
              </th>
              <th scope="col" className="pb-2 text-left text-xs font-semibold text-muted-foreground">
                Requested
              </th>
              <th scope="col" className="pb-2 text-left text-xs font-semibold text-muted-foreground">
                Due by
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {historyQuery.data.map((req) => (
              <tr key={req.id}>
                <td className="py-2 font-medium text-foreground">{req.type}</td>
                <td className="py-2 text-muted-foreground">{req.status}</td>
                <td className="py-2 text-muted-foreground">
                  {new Date(req.requestedAt).toLocaleDateString()}
                </td>
                <td className="py-2 text-muted-foreground">
                  {new Date(req.dueAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ScreenDataPrivacy(): React.JSX.Element {
  return (
    <section aria-labelledby="data-privacy-heading">
      <div className="mb-1">
        <h2
          id="data-privacy-heading"
          className="text-lg font-semibold text-foreground"
        >
          Data &amp; Privacy
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal data under the Philippine Data Privacy Act (RA 10173). See our{' '}
          <a
            href="/privacy"
            className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
          >
            Privacy Policy
          </a>{' '}
          for full details.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <DownloadSection />
        <RectifySection />
        <EraseSection />
        <DsrHistory />
      </div>
    </section>
  );
}

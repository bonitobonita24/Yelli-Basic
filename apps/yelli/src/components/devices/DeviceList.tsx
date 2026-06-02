"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PhoneIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc-client";
import { CallingModal } from "@/components/calls/CallingModal";

function formatRelative(input: Date | string | null | undefined): string {
  if (!input) return "never";
  const d = typeof input === "string" ? new Date(input) : input;
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

const ROLE_LABEL: Record<string, string> = {
  caller: "Caller",
  receiver: "Receiver",
  both: "Both",
};

interface CallingPeer {
  userId: string;
  displayName: string;
  callSessionId: string | null;
}

export function DeviceList() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const { data, isLoading, error } = trpc.device.list.useQuery({ limit: 50 });

  const [callingPeer, setCallingPeer] = useState<CallingPeer | null>(null);

  const inviteMutation = trpc.calls.invite.useMutation({
    onSuccess: ({ callSessionId }) => {
      setCallingPeer((p) => (p ? { ...p, callSessionId } : p));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive" role="alert">
            Could not load devices: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const devices = data?.items ?? [];
  // Filter out the current user's own devices — don't call yourself
  // Filter out the current user's own devices — don't show self as callable peer.
  // userId can be null in the Prisma select type (FK is non-null in schema, but tRPC
  // select inference is conservative) — treat null as "not the current user".
  const peers = devices.filter((d) => d.userId !== currentUserId);

  if (devices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No devices yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Register this browser to start placing or receiving calls.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Devices ({devices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {peers.map((device) => (
              <li
                key={device.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {device.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last seen {formatRelative(device.lastSeenAt ?? device.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {ROLE_LABEL[device.callRole] ?? device.callRole}
                  </Badge>
                  {/* CALL button: hide for receiver-only peers (they cannot receive origination) */}
                  {device.callRole !== "receiver" && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Call ${device.displayName}`}
                      disabled={inviteMutation.isPending && callingPeer?.userId === device.userId}
                      onClick={() => {
                        setCallingPeer({
                          userId: device.userId ?? "",
                          displayName: device.displayName ?? "Unknown",
                          callSessionId: null,
                        });
                        inviteMutation.mutate({ calleeUserId: device.userId ?? "" });
                      }}
                    >
                      <PhoneIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {inviteMutation.isError && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {inviteMutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      <CallingModal
        open={callingPeer !== null}
        calleeDisplayName={callingPeer?.displayName ?? ""}
        callSessionId={callingPeer?.callSessionId ?? null}
        onClose={() => {
          setCallingPeer(null);
          inviteMutation.reset();
        }}
      />
    </>
  );
}

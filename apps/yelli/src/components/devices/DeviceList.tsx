"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc-client";

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

export function DeviceList() {
  const { data, isLoading, error } = trpc.device.list.useQuery({ limit: 50 });

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
    <Card>
      <CardHeader>
        <CardTitle>Devices ({devices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {devices.map((device) => (
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
              <Badge variant="secondary">
                {ROLE_LABEL[device.callRole] ?? device.callRole}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

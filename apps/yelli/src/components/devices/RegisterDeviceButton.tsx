"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";

const FINGERPRINT_KEY = "yelli.deviceFingerprint";

function getOrCreateFingerprint(): string {
  if (typeof window === "undefined") return "ssr-placeholder-fingerprint";
  let fp = window.localStorage.getItem(FINGERPRINT_KEY);
  if (!fp) {
    fp = crypto.randomUUID();
    window.localStorage.setItem(FINGERPRINT_KEY, fp);
  }
  return fp;
}

function defaultDisplayName(): string {
  if (typeof navigator === "undefined") return "Browser";
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? "Browser";
  const stamp = new Date().toLocaleDateString();
  return `${platform} (${stamp})`.slice(0, 40);
}

export function RegisterDeviceButton() {
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);
  const register = trpc.device.register.useMutation({
    onSuccess: () => {
      void utils.device.list.invalidate();
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  const handleClick = () => {
    setError(null);
    register.mutate({
      displayName: defaultDisplayName(),
      fingerprint: getOrCreateFingerprint(),
    });
  };

  return (
    <div className="space-y-2">
      <Button
        className="h-11"
        onClick={handleClick}
        disabled={register.isPending}
      >
        {register.isPending ? "Registering…" : "Register this device"}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

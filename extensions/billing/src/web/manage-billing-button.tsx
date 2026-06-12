"use client";

import { useState } from "react";

import { Button } from "@acme/ui/button";
import { toast } from "@acme/ui/toast";

async function postForUrl(url: string): Promise<string> {
  const res = await fetch(url, { method: "POST" });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Request failed");
  return json.url;
}

/**
 * Opens the Stripe customer portal for an existing subscriber (change plan,
 * update payment method, cancel). Plan selection + first-time checkout now live
 * on the public /pricing page (driven by Payload Plans).
 */
export function ManageBillingButton({
  variant = "outline",
  label = "Manage billing",
}: {
  variant?: "default" | "outline";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const url = await postForUrl("/api/ext/billing/portal");
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing");
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      disabled={loading}
      onClick={() => void openPortal()}
    >
      {loading ? "Opening…" : label}
    </Button>
  );
}

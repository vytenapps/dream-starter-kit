"use client";

import { useState } from "react";

import { Button } from "@acme/ui/button";
import { toast } from "@acme/ui/toast";

/**
 * Starts Stripe Checkout for a Payload plan. Works for both signed-in users
 * (upgrade) and anonymous visitors (guest checkout — the account is created
 * post-payment by the webhook). The server route resolves the plan's Stripe
 * price, trial and intro coupon.
 */
export function PlanCheckoutButton({
  planId,
  label = "Get started",
  variant = "default",
  className,
}: {
  planId: string | number;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function checkout() {
    setLoading(true);
    try {
      const res = await fetch("/api/ext/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url)
        throw new Error(json.error ?? "Checkout failed");
      window.location.href = json.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      className={className}
      disabled={loading}
      onClick={() => void checkout()}
    >
      {loading ? "Redirecting…" : label}
    </Button>
  );
}

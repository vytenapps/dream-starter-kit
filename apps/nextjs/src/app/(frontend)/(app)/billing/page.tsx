"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { usePremium } from "@acme/app";
import { useSupabase } from "@acme/api";

import { ManageBillingButton } from "~/components/paywall";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

interface Invoice {
  id: string;
  number: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** Resolve the active subscription's plan display name (price → product). */
function usePlanName(priceId: string | null | undefined) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["plan-name", priceId],
    enabled: !!priceId,
    queryFn: async () => {
      const { data: price } = await supabase
        .from("prices")
        .select("product_id")
        .eq("id", priceId!)
        .maybeSingle();
      if (!price?.product_id) return null;
      const { data: product } = await supabase
        .from("products")
        .select("name")
        .eq("id", price.product_id)
        .maybeSingle();
      return product?.name ?? null;
    },
  });
}

function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const res = await fetch("/api/stripe/invoices");
      if (!res.ok) return [];
      const data = (await res.json()) as { invoices?: Invoice[] };
      return data.invoices ?? [];
    },
  });
}

export default function BillingPage() {
  const premium = usePremium();
  const planName = usePlanName(premium.subscription?.price_id);
  const invoices = useInvoices();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      <Card>
        <CardHeader>
          <CardDescription>Current plan</CardDescription>
          <CardTitle className="text-xl">
            {premium.isLoading
              ? "—"
              : premium.isPremium
                ? (planName.data ?? "Pro")
                : "Free"}
          </CardTitle>
          {premium.subscription?.status ? (
            <Badge variant="secondary" className="w-fit">
              {premium.subscription.status}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {premium.isPremium ? (
            <ManageBillingButton label="Change or cancel plan" />
          ) : (
            <Link href="/pricing" className={buttonVariants()}>
              Upgrade
            </Link>
          )}
          <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
            View plans
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
          <CardDescription>Your past payments.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : invoices.data && invoices.data.length > 0 ? (
            <ul className="divide-border divide-y text-sm">
              {invoices.data.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {inv.number ?? inv.id}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(inv.created * 1000).toLocaleDateString()} ·{" "}
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{money(inv.amountPaid, inv.currency)}</span>
                    {inv.hostedInvoiceUrl ? (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

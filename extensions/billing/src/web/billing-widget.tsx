"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@acme/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@acme/ui/card";
import { toast } from "@acme/ui/toast";

import { usePremium } from "../index";

function BillingWidgetInner() {
  const premium = usePremium();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const checkout = searchParams.get("checkout");

  // Surface the Stripe Checkout result and refresh the subscription on success.
  useEffect(() => {
    if (checkout === "success") {
      toast.success("Subscription active — welcome to Pro!");
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    } else if (checkout === "cancelled") {
      toast("Checkout cancelled.");
    }
  }, [checkout, queryClient]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardDescription>Plan</CardDescription>
          <CardTitle className="text-xl">
            {premium.isLoading ? "—" : premium.isPremium ? "Pro" : "Free"}
          </CardTitle>
        </div>
        {!premium.isLoading &&
          (premium.isPremium ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/billing">Manage billing</Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/pricing">Upgrade</Link>
            </Button>
          ))}
      </CardHeader>
    </Card>
  );
}

/** Dashboard widget: plan status + upgrade/manage CTA (+ checkout toast). */
export function BillingWidget() {
  return (
    <Suspense>
      <BillingWidgetInner />
    </Suspense>
  );
}

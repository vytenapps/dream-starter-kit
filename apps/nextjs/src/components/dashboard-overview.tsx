"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { usePremium } from "@acme/app";
import { toast } from "@acme/ui/toast";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function DashboardOverview() {
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
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
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
                <Button asChild variant="outline">
                  <Link href="/billing">Manage billing</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/pricing">Upgrade</Link>
                </Button>
              ))}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Content</CardDescription>
            <CardTitle className="text-xl">Payload CMS</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin">Open the CMS admin</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Welcome</CardTitle>
          <CardDescription>
            Your account lives on the app side (Supabase Auth + Row-Level
            Security). Public content — posts, events, pages and more — is
            managed in the CMS and shown on the public site.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/posts">Browse posts</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/reminders">Reminders</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/chat">AI chat</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

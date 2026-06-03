"use client";

import Link from "next/link";

import { usePremium } from "@acme/app";

import { ManageBillingButton, Paywall } from "~/components/paywall";
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
              (premium.isPremium ? <ManageBillingButton /> : <Paywall />)}
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
            Security). Public content — articles, events, pages and more — is
            managed in the CMS and shown on the public site.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/articles">Browse articles</Link>
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

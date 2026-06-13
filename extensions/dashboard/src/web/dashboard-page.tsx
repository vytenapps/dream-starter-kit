"use client";

import Link from "next/link";

import { useExtWidgets } from "@acme/ext-kit/react";
import { Button } from "@acme/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@acme/ui/card";

function DashboardInner() {
  const widgets = useExtWidgets();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* The widget grid: every installed-and-enabled extension's declared
          widget, provided by the host via @acme/ext-kit/react. */}
      {widgets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widgets.map(({ slug, Widget }) => (
            <Widget key={slug} />
          ))}
        </div>
      )}

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
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  return <DashboardInner />;
}

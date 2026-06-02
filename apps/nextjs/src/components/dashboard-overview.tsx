"use client";

import Link from "next/link";

import { usePremium, useProjects } from "@acme/app";

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
  const projects = useProjects();
  const premium = usePremium();
  const data = projects.data ?? [];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Projects</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {projects.isLoading ? "—" : data.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="sm:col-span-2">
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
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent projects</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/projects">All projects</Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {projects.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : data.length > 0 ? (
            data.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="hover:bg-muted rounded-md px-3 py-2 text-sm"
              >
                {project.name}
              </Link>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              No projects yet.{" "}
              <Link href="/projects" className="underline">
                Create your first →
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { TriangleAlert } from "lucide-react";

import { isSupabaseConfigured } from "~/lib/supabase/config";

/**
 * Warns on auth screens when the app is running with placeholder Supabase env
 * (e.g. a fresh one-click Vercel deploy before the real keys are set and the
 * app is redeployed). Without it, sign-in/up just fail with a cryptic
 * "Failed to fetch". Renders nothing once real credentials are configured.
 */
export function SupabaseConfigBanner() {
  if (isSupabaseConfigured()) return null;

  return (
    <div
      role="alert"
      className="border-destructive/50 bg-destructive/10 text-destructive flex gap-3 rounded-lg border p-4 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">Supabase isn’t connected yet</p>
        <p className="text-destructive/90">
          This deploy is using placeholder credentials, so sign-in and sign-up
          won’t work. Set{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          (Vercel’s Supabase integration sets both), then{" "}
          <span className="font-medium">redeploy</span>. Locally, add them to{" "}
          <code className="font-mono text-xs">.env</code>.
        </p>
      </div>
    </div>
  );
}

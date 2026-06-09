"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Field, FieldLabel } from "~/components/ui/field";
import { Progress } from "~/components/ui/progress";

/**
 * First-admin onboarding screen. Reached automatically after the first Payload
 * admin is created (the dashboard's SeedGate redirects here while the CMS is
 * unseeded). Streams the seed via `/api/cms/seed`, shows progress, then hands
 * off to the admin panel. Lives under (frontend) so Tailwind/shadcn styles load
 * (the Payload admin tree doesn't include them).
 */
const ADMIN_URL = "/admin";

export default function CmsSetupPage() {
  const [percent, setPercent] = useState(0);
  const [label, setLabel] = useState("Preparing your CMS…");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const goToAdmin = useCallback(() => {
    window.location.assign(ADMIN_URL);
  }, []);

  const runSeed = useCallback(async () => {
    setError(null);
    setPercent(0);
    setLabel("Preparing your CMS…");

    let res: Response;
    try {
      res = await fetch("/api/cms/seed", { method: "POST" });
    } catch {
      setError("Couldn't reach the server. Please retry.");
      return;
    }

    // Not staff (or no session) — this page isn't for them. Send them into the
    // app rather than bouncing through the /admin gate.
    if (res.status === 401) {
      window.location.assign("/dashboard");
      return;
    }

    const contentType = res.headers.get("Content-Type") ?? "";
    if (!contentType.includes("ndjson") || !res.body) {
      // JSON response: { alreadySeeded } or an error object.
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (data?.error) {
        setError(data.error);
        return;
      }
      goToAdmin();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let errored = false;

    // Returns true if the event reported a seeding error.
    const handleEvent = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      let event: {
        done?: number;
        total?: number;
        label?: string;
        complete?: boolean;
        error?: string;
      };
      try {
        event = JSON.parse(trimmed) as typeof event;
      } catch {
        return false;
      }
      if (event.error) {
        setError(event.error);
        return true;
      }
      if (typeof event.done === "number" && typeof event.total === "number") {
        setPercent(Math.round((event.done / event.total) * 100));
      }
      if (event.label) setLabel(event.label);
      return false;
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (handleEvent(line)) errored = true;
      }
    }
    if (buffer && handleEvent(buffer)) errored = true;

    if (!errored) {
      setPercent(100);
      setLabel("Done");
      goToAdmin();
    }
  }, [goToAdmin]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runSeed();
  }, [runSeed]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Setting up your CMS</h1>
          <p className="text-muted-foreground text-sm">
            Seeding demo content so your site is ready to explore. This only
            happens once.
          </p>
        </div>

        {error ? (
          <div className="flex flex-col gap-3">
            <p className="text-destructive text-sm">{error}</p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  started.current = true;
                  void runSeed();
                }}
              >
                Retry
              </Button>
              <Button variant="outline" onClick={goToAdmin}>
                Skip to admin
              </Button>
            </div>
          </div>
        ) : (
          <Field className="w-full">
            <FieldLabel htmlFor="cms-seed-progress">
              <span>{label}</span>
              <span className="ml-auto tabular-nums">{percent}%</span>
            </FieldLabel>
            <Progress value={percent} id="cms-seed-progress" />
          </Field>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";

import type { PlanId } from "@acme/config/constants";
import { PLANS } from "@acme/config/constants";
import { toast } from "@acme/ui/toast";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

async function postForUrl(url: string): Promise<string> {
  const res = await fetch(url, { method: "POST" });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Request failed");
  return json.url;
}

/**
 * Two-state consent paywall (shadcn Drawer): (1) pick a plan, (2) agree to the
 * terms via a required checkbox, then redirect to Stripe Checkout.
 */
export function Paywall({ trigger }: { trigger?: React.ReactNode }) {
  const [step, setStep] = useState<"plan" | "consent">("plan");
  const [plan, setPlan] = useState<PlanId>("monthly");
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const selected = PLANS.find((p) => p.id === plan);

  function reset() {
    setStep("plan");
    setConsented(false);
    setLoading(false);
  }

  async function subscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Checkout failed");
      window.location.href = json.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <Drawer onOpenChange={(open) => !open && reset()}>
      <DrawerTrigger asChild>{trigger ?? <Button>Go Pro</Button>}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>
              {step === "plan" ? "Upgrade to Pro" : "Confirm your subscription"}
            </DrawerTitle>
            <DrawerDescription>
              {step === "plan"
                ? "Choose a billing cycle. Cancel anytime."
                : "Review and agree before subscribing."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4">
            {step === "plan" ? (
              <RadioGroup
                value={plan}
                onValueChange={(value) => setPlan(value as PlanId)}
                className="gap-3"
              >
                {PLANS.map((p) => (
                  <Label
                    key={p.id}
                    htmlFor={`plan-${p.id}`}
                    className="flex cursor-pointer items-center justify-between rounded-md border p-4"
                  >
                    <span className="flex items-center gap-3">
                      <RadioGroupItem id={`plan-${p.id}`} value={p.id} />
                      <span className="font-medium">
                        {p.name}
                        {"badge" in p && p.badge ? (
                          <span className="text-muted-foreground"> · {p.badge}</span>
                        ) : null}
                      </span>
                    </span>
                    <span>
                      <span className="text-lg font-semibold">{p.price}</span>
                      <span className="text-muted-foreground text-sm">
                        {p.cadence}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            ) : (
              <Label
                htmlFor="consent"
                className="flex cursor-pointer items-start gap-3 text-sm font-normal"
              >
                <Checkbox
                  id="consent"
                  checked={consented}
                  onCheckedChange={(c) => setConsented(c === true)}
                />
                <span>
                  I agree to the{" "}
                  <a href="/terms" className="underline">
                    Terms
                  </a>{" "}
                  and authorize a recurring {selected?.price}
                  {selected?.cadence} charge until I cancel.
                </span>
              </Label>
            )}
          </div>

          <DrawerFooter>
            {step === "plan" ? (
              <Button onClick={() => setStep("consent")}>Continue</Button>
            ) : (
              <Button
                disabled={!consented || loading}
                onClick={() => void subscribe()}
              >
                {loading ? "Redirecting…" : `Subscribe — ${selected?.price}${selected?.cadence}`}
              </Button>
            )}
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Opens the Stripe customer portal for an existing subscriber. */
export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const url = await postForUrl("/api/stripe/portal");
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing");
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      disabled={loading}
      onClick={() => void openPortal()}
    >
      {loading ? "Opening…" : "Manage billing"}
    </Button>
  );
}

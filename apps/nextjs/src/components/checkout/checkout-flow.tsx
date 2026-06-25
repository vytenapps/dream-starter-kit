"use client";

// The Bloomberg-style two-step checkout, rendered inline on /checkout.
//
// Step 1 (Account) embeds the shared AuthFlow (passwordless email→code, or
// Continue with Apple/Google). It's *account-first*: by the time the buyer
// reaches Step 2 they're signed in, so the payment intent stamps their
// supabase_user_id directly (the anon/guest path stays only as a webhook
// fallback). Step 2 (Payment) mounts the inline Stripe form. A gated stepper
// built from shadcn Cards: the future step is disabled until the prior is done,
// and the Account step collapses to a ✓ + email + edit affordance once complete.
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";

import type { AuthSettings } from "@acme/app";
import type { ExtBillingPlan } from "@acme/cms";
import { useSession, useSupabase } from "@acme/api";
import { isAnonymousUser, signOut } from "@acme/app";

import type { PaidResult } from "~/components/checkout/checkout-payment";
import type { CheckoutTestimonialData } from "~/components/checkout/checkout-testimonial";
import type { PlanLite } from "~/lib/paywall-copy";
import { AuthFlow } from "~/components/auth/auth-flow";
import { CheckoutPayment } from "~/components/checkout/checkout-payment";
import { CheckoutTestimonial } from "~/components/checkout/checkout-testimonial";
import { PlanSummary } from "~/components/checkout/plan-summary";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { buildPlanCopy, buildUpsellCopy } from "~/lib/paywall-copy";

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        done
          ? "bg-primary text-primary-foreground"
          : "bg-foreground text-background"
      }`}
    >
      {done ? <Check className="size-4" /> : n}
    </span>
  );
}

export function CheckoutFlow({
  planId,
  plan,
  annualPlan,
  authSettings,
  appName,
  testimonial,
}: {
  planId: string | number;
  plan: ExtBillingPlan;
  annualPlan?: ExtBillingPlan | null;
  authSettings: AuthSettings;
  appName: string;
  testimonial?: CheckoutTestimonialData | null;
}) {
  const router = useRouter();
  const supabase = useSupabase();
  const { user } = useSession();

  // Authenticated-and-permanent gates Step 2. `justAuthed` advances immediately
  // when AuthFlow completes client-side (before the session hook re-reads);
  // `editingAccount` lets the buyer go back and switch accounts.
  const [justAuthed, setJustAuthed] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const isAuthed = Boolean(user && !isAnonymousUser(user));
  const accountDone = (isAuthed || justAuthed) && !editingAccount;

  const [paid, setPaid] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const subscriptionRef = useRef<string | undefined>(undefined);

  const copy = buildPlanCopy(plan as unknown as PlanLite);
  const canUpsell = Boolean(annualPlan?.id && annualPlan.id !== planId);
  const upsellCopy =
    annualPlan && canUpsell
      ? buildUpsellCopy(
          annualPlan as unknown as PlanLite,
          plan as unknown as PlanLite,
        )
      : null;

  const finishToApp = useCallback(() => {
    router.push("/a?checkout=success");
  }, [router]);

  const onPaid = useCallback((result: PaidResult) => {
    subscriptionRef.current = result.subscriptionId;
    setPaid(true);
  }, []);

  const onEditAccount = useCallback(async () => {
    setEditingAccount(true);
    setJustAuthed(false);
    setPaid(false);
    try {
      await signOut(supabase);
    } catch {
      /* ignore — UI already returned to the account step */
    }
  }, [supabase]);

  const switchToAnnual = useCallback(async () => {
    if (!annualPlan?.id) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/ext/billing/upgrade-annual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: annualPlan.id,
          subscriptionId: subscriptionRef.current,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not switch to annual.");
      }
      finishToApp();
    } catch (e) {
      setSwitchError(
        e instanceof Error ? e.message : "Could not switch to annual.",
      );
      setSwitching(false);
    }
  }, [annualPlan?.id, finishToApp]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="bg-secondary text-secondary-foreground -mx-4 mb-6 py-2 text-center text-sm font-semibold">
        Subscribe and Save
      </div>
      <h1 className="mb-8 text-center text-3xl font-bold">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT: the two-step accordion (stacks first on mobile). */}
        <div className="flex flex-col gap-4">
          {/* Step 1 — Account */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StepBadge n={1} done={accountDone} />
                  <h2 className="text-lg font-semibold">Account</h2>
                </div>
                {accountDone && (
                  <div className="flex items-center gap-2">
                    {user?.email && (
                      <span className="text-muted-foreground text-sm">
                        {user.email}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit account"
                      onClick={() => void onEditAccount()}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            {!accountDone && (
              <CardContent>
                <div className="mx-auto max-w-sm">
                  <AuthFlow
                    mode="signIn"
                    settings={authSettings}
                    appName={appName}
                    onAuthenticated={() => {
                      setJustAuthed(true);
                      setEditingAccount(false);
                    }}
                    redirectTo={`/checkout?plan=${encodeURIComponent(
                      String(planId),
                    )}&step=payment`}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Step 2 — Payment */}
          <Card className={!accountDone ? "opacity-60" : undefined}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <StepBadge n={2} done={paid} />
                <h2 className="text-lg font-semibold">Payment</h2>
              </div>
            </CardHeader>
            {accountDone && (
              <CardContent>
                {paid ? (
                  <div className="flex flex-col items-center gap-4 py-4 text-center">
                    {showUpsell && upsellCopy ? (
                      <>
                        <h3 className="text-lg font-semibold">
                          {upsellCopy.headline}
                        </h3>
                        <p className="text-sm">{upsellCopy.priceLine}</p>
                        {upsellCopy.savingsLine && (
                          <p className="text-primary text-sm font-medium">
                            {upsellCopy.savingsLine}
                          </p>
                        )}
                        {switchError && (
                          <p className="text-destructive text-sm">
                            {switchError}
                          </p>
                        )}
                        <Button
                          className="w-full"
                          disabled={switching}
                          onClick={() => void switchToAnnual()}
                        >
                          {switching ? "Switching…" : upsellCopy.cta}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={switching}
                          onClick={finishToApp}
                        >
                          Maybe later
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
                          <Check className="size-6" />
                        </div>
                        <h3 className="text-lg font-semibold">
                          You&apos;re in.
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Your subscription is active.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => {
                            if (canUpsell) setShowUpsell(true);
                            else finishToApp();
                          }}
                        >
                          Continue
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <CheckoutPayment
                    planId={planId}
                    plan={plan as unknown as PlanLite}
                    copy={copy}
                    onPaid={onPaid}
                  />
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* RIGHT: plan summary + testimonial (drops below the form on mobile). */}
        <div className="flex flex-col gap-4">
          <PlanSummary plan={plan} />
          {testimonial && <CheckoutTestimonial testimonial={testimonial} />}
        </div>
      </div>
    </div>
  );
}

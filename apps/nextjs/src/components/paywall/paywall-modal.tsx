"use client";

// Two-state paywall (offer → terms → paid) wired to REAL Stripe via the billing
// extension's express-intent route.
//
// DEFERRED Elements: <Elements> mounts immediately with {mode, amount, currency}
// — no server round-trip — so the Apple/Google Pay button renders instantly (no
// "preparing secure checkout" wait). The PaymentIntent/subscription is created
// only at confirm time (PaywallBody.confirm → createIntent), which also avoids
// spawning a throwaway incomplete subscription on every open.
//
// All pricing + fine print is pulled from the Payload CMS plan
// (lib/paywall-copy.ts), never hardcoded.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import confetti from "canvas-confetti";

import { useSession, useSupabase } from "@acme/api";
import {
  convertAnonToPermanent,
  ensureAnonSession,
  isAnonymousUser,
} from "@acme/app";

import type { PayMethod, PaywallStep } from "./paywall-body";
import type { CheckoutVariant } from "./stripe";
import type { BuyerDetails, PlanLite } from "~/lib/paywall-copy";
import { useCaptcha } from "~/components/captcha/captcha-provider";
import {
  buildPlanCopy,
  buildUpsellCopy,
  deferredElementsOptions,
} from "~/lib/paywall-copy";
import { PaywallBody } from "./paywall-body";
import { getStripePromise } from "./stripe";

interface IntentResponse {
  clientSecret?: string;
  mode?: "payment" | "setup";
  error?: string;
}

export interface CreatedIntent {
  clientSecret: string;
  mode: "payment" | "setup";
}

export interface PaywallModalProps {
  open: boolean;
  variant: CheckoutVariant;
  /** Resolved Payload plan id. */
  planId?: string | number | null;
  /** Resolved Payload plan (pricing + fine-print source). */
  plan?: PlanLite | null;
  /** The yearly plan offered as a 1-click upsell after purchase (if distinct). */
  annualPlan?: PlanLite | null;
  /** Step to open at. The detail-page gate dock is itself the offer, so it
   *  opens the modal directly at "terms" (no duplicate offer screen). */
  initialStep?: PaywallStep;
  /** Method to preselect on the terms screen ("wallet" by default). */
  initialMethod?: PayMethod;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaywallModal({
  open,
  variant,
  planId,
  plan,
  annualPlan,
  initialStep = "offer",
  initialMethod = "wallet",
  onClose,
  onSuccess,
}: PaywallModalProps) {
  const supabase = useSupabase();
  const { user } = useSession();
  const { token: captchaToken, reset: resetCaptcha } = useCaptcha();

  const [step, setStep] = useState<PaywallStep>(initialStep);
  const [paid, setPaid] = useState(false);
  // Post-purchase upsell: shown after a purchase when a distinct annual plan
  // exists. `switching` covers the in-flight switch request.
  const [upsell, setUpsell] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // Buyer identity captured at checkout (wallet/card) — drives anon→permanent
  // conversion. `checkEmail` shows the "confirm your email" screen afterwards.
  const buyerRef = useRef<BuyerDetails | undefined>(undefined);
  const [checkEmail, setCheckEmail] = useState<null | {
    email: string;
    existing: boolean;
  }>(null);
  // The page the buyer started on, so the confirmation email returns them here.
  const originRef = useRef<string>("/");
  useEffect(() => {
    originRef.current = window.location.pathname + window.location.search;
  }, []);

  const copy = useMemo(() => buildPlanCopy(plan), [plan]);

  // Only upsell to annual when a distinct annual plan is available (and the
  // bought plan isn't already that annual plan).
  const canUpsell = !!annualPlan?.id && annualPlan.id !== planId;
  const upsellCopy = useMemo(
    () => (annualPlan ? buildUpsellCopy(annualPlan, plan) : null),
    [annualPlan, plan],
  );

  // Fire confetti once when the success screen appears.
  useEffect(() => {
    if (!paid) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    void confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    });
  }, [paid]);

  // After payment: if the buyer is anonymous and we captured an email, convert
  // the account (Supabase sends a confirmation email that returns them to where
  // they started). Otherwise finish normally.
  const proceedAfterPay = useCallback(async () => {
    const email = buyerRef.current?.email?.trim();
    if (!isAnonymousUser(user) || !email) {
      onSuccess();
      return;
    }
    const next = `/confirm-email?next=${encodeURIComponent(originRef.current)}`;
    try {
      await convertAnonToPermanent(supabase, email, {
        emailRedirectTo: `${window.location.origin}${next}`,
        data: {
          display_name: buyerRef.current?.name ?? undefined,
          phone: buyerRef.current?.phone ?? undefined,
        },
      });
      setCheckEmail({ email, existing: false });
    } catch (e) {
      // Email already belongs to an account → merge this purchase into it.
      const code = (e as { code?: string }).code;
      if (code === "email_exists" || /already|exists/i.test(String(e))) {
        await fetch("/api/auth/merge-anon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }).catch(() => undefined);
        setCheckEmail({ email, existing: true });
      } else {
        // Conversion failed (transient) — they're still premium as an anon user;
        // don't block. Finish; they can convert later from settings.
        onSuccess();
      }
    }
  }, [supabase, user, onSuccess]);

  // 1-click switch to annual using the card on file (post-purchase upsell).
  const switchToAnnual = useCallback(async () => {
    if (!annualPlan?.id) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/ext/billing/upgrade-annual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: annualPlan.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not switch to annual.");
      }
      await proceedAfterPay();
    } catch (e) {
      setSwitchError(
        e instanceof Error ? e.message : "Could not switch to annual.",
      );
      setSwitching(false);
    }
  }, [annualPlan?.id, proceedAfterPay]);

  // Deferred Elements options (mode + today's charge). Null while the plan is
  // still resolving — virtually never seen because the plan query is prefetched
  // + cached by the provider before the modal opens.
  const deferred = useMemo(() => deferredElementsOptions(plan), [plan]);

  // Create the PaymentIntent / subscription at CONFIRM time (not on open).
  const createIntent = useCallback(async (): Promise<CreatedIntent> => {
    if (planId == null) {
      throw new Error("This plan isn't available yet.");
    }
    // Ensure the buyer has a session (anonymous if logged out) BEFORE creating
    // the subscription, so express-intent stamps supabase_user_id and the
    // webhook links the subscription to a real account (closes the embedded-
    // checkout gap). Tokens are single-use — reset after.
    try {
      await ensureAnonSession(supabase, { captchaToken });
    } catch {
      /* CAPTCHA/anon failed — proceed; guest webhook fallback still applies */
    } finally {
      resetCaptcha();
    }
    const res = await fetch("/api/ext/billing/express-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = (await res.json()) as IntentResponse;
    if (!res.ok || !data.clientSecret) {
      throw new Error(data.error ?? "Could not start checkout.");
    }
    return { clientSecret: data.clientSecret, mode: data.mode ?? "payment" };
  }, [planId, supabase, captchaToken, resetCaptcha]);

  if (!open) return null;

  const isDock = variant === "dock";
  const isFull = variant === "full";
  const panelClass =
    (isFull ? "co-panel" : isDock ? "drawer dock" : "drawer") +
    (step === "terms" && !paid ? " is-terms" : "");

  function finishPayment(_intentId?: string, details?: BuyerDetails) {
    buyerRef.current = details;
    setPaid(true);
  }

  return (
    <div
      className={isDock ? "dr-dock" : "dr-scrim" + (isFull ? " co-full" : "")}
      onMouseDown={(e) => {
        if (!isDock && (e.target as HTMLElement).classList.contains("dr-scrim"))
          onClose();
      }}
    >
      {isDock && <div className="dr-dock-fade" aria-hidden="true" />}
      <div className={panelClass} role="dialog" aria-modal="true">
        {!isFull && !isDock && <div className="dr-handle" aria-hidden="true" />}
        {!isDock && (
          <button className="dr-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}

        {checkEmail ? (
          // Anonymous buyer converted — confirm email to secure the account.
          <div className="dr-paid">
            <div className="dr-check">✉</div>
            <h2>Confirm your email</h2>
            <p>
              {checkEmail.existing ? (
                <>
                  That email already has an account — we&apos;ve linked this
                  purchase to it. Check <strong>{checkEmail.email}</strong> for
                  a sign-in link.
                </>
              ) : (
                <>
                  We sent a link to <strong>{checkEmail.email}</strong>. Confirm
                  it to secure your account — your access is already active.
                  You&apos;re passwordless; you can add a password anytime from
                  your account settings.
                </>
              )}
            </p>
            <button
              className="pay-btn"
              style={{ margin: "0 auto" }}
              onClick={onSuccess}
            >
              Done
            </button>
          </div>
        ) : paid && upsell && upsellCopy ? (
          // Post-purchase 1-click upsell to the annual plan.
          <div className="dr-paid dr-upsell">
            <h2>{upsellCopy.headline}</h2>
            <p className="dr-upsell-price">{upsellCopy.priceLine}</p>
            {upsellCopy.savingsLine && (
              <p className="dr-upsell-save">{upsellCopy.savingsLine}</p>
            )}
            <ul className="dr-upsell-list">
              {upsellCopy.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {switchError && (
              <p className="mb-3 text-sm text-red-400" role="alert">
                {switchError}
              </p>
            )}
            <button
              className="pay-btn"
              style={{ margin: "4px auto 0" }}
              disabled={switching}
              onClick={() => void switchToAnnual()}
            >
              {switching ? "Switching…" : upsellCopy.cta}
            </button>
            <button
              className="dr-cc"
              disabled={switching}
              onClick={() => void proceedAfterPay()}
            >
              Maybe later
            </button>
            <p className="dr-fineprint">{upsellCopy.fineprint}</p>
          </div>
        ) : paid ? (
          <div className="dr-paid">
            <div className="dr-check">✓</div>
            <h2>You&apos;re in.</h2>
            <p>Premium access unlocked.</p>
            <button
              className="pay-btn"
              style={{ margin: "0 auto" }}
              onClick={() => {
                if (canUpsell) setUpsell(true);
                else void proceedAfterPay();
              }}
            >
              Continue
            </button>
          </div>
        ) : deferred ? (
          // Deferred Elements — mounts instantly, wallet button renders right
          // away. Keyed by amount so an amount change remounts cleanly.
          <Elements
            key={`${deferred.mode}-${deferred.amount ?? 0}`}
            stripe={getStripePromise()}
            options={{
              mode: deferred.mode,
              ...(deferred.amount != null ? { amount: deferred.amount } : {}),
              currency: deferred.currency,
              appearance: {
                theme: "night",
                labels: "floating",
                variables: { borderRadius: "8px" },
              },
            }}
          >
            <PaywallBody
              copy={copy}
              createIntent={createIntent}
              step={step}
              setStep={setStep}
              initialMethod={initialMethod}
              onPaid={(id, details) => finishPayment(id, details)}
              onBack={
                initialStep === "terms" ? onClose : () => setStep("offer")
              }
              onClose={onClose}
            />
          </Elements>
        ) : (
          // Plan still resolving (rare — prefetched). Show the offer copy.
          <div className="dr-inner">
            <h2 className="dr-offer-h">{copy.headline}</h2>
            <p className="dr-offer-sub">{copy.sub}</p>
            <div className="dr-divider" />
            <div className="dr-foot">
              <button onClick={onClose}>Maybe later</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

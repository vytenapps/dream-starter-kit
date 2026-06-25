"use client";

// Step 2 of the Bloomberg-style checkout: the Stripe payment form, rendered
// INLINE on the page (not in the paywall modal chrome). It reuses the billing
// extension's deferred-Elements flow exactly as the paywall does — Express
// Checkout (Apple/Google Pay) + Payment Element (card + Link), with the
// PaymentIntent/subscription created at confirm time via /express-intent — but
// the surrounding UI is plain shadcn so it matches the rest of the page.
import { useState } from "react";
import {
  ExpressCheckoutElement,
  Elements,
  LinkAuthenticationElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { useSupabase } from "@acme/api";
import { ensureAnonSession } from "@acme/app";

import type { BuyerDetails, PaywallCopy, PlanLite } from "~/lib/paywall-copy";
import { useCaptcha } from "~/components/captcha/captcha-provider";
import { getStripePromise } from "~/components/paywall/stripe";
import { walletName, useWalletProvider } from "~/components/paywall/wallet-button";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { deferredElementsOptions } from "~/lib/paywall-copy";

/** What a confirmed payment hands back to the checkout flow. */
export interface PaidResult {
  intentId?: string;
  details?: BuyerDetails;
  subscriptionId?: string;
  customerId?: string;
}

function PaymentInner({
  planId,
  copy,
  onPaid,
}: {
  planId: string | number;
  copy: PaywallCopy;
  onPaid: (result: PaidResult) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const supabase = useSupabase();
  const { token: captchaToken, reset: resetCaptcha } = useCaptcha();

  const [agreed, setAgreed] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [walletReady, setWalletReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardEmail, setCardEmail] = useState<string>();
  const wallet = walletName(useWalletProvider());

  // Create the PaymentIntent / subscription at confirm time (deferred flow), the
  // same contract the paywall modal uses. The buyer is already signed in by the
  // Account step, so `express-intent` stamps `supabase_user_id`; the anon
  // ensure is a no-op safety net for the rare logged-out edge.
  async function createIntent(details?: BuyerDetails) {
    try {
      await ensureAnonSession(supabase, { captchaToken });
    } catch {
      /* anon/CAPTCHA unavailable — webhook fallback still links the purchase */
    } finally {
      resetCaptcha();
    }
    const res = await fetch("/api/ext/billing/express-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        email: details?.email ?? undefined,
        name: details?.name ?? undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      clientSecret?: string;
      mode?: "payment" | "setup";
      subscriptionId?: string;
      customerId?: string;
      error?: string;
    };
    if (!res.ok || !data.clientSecret) {
      throw new Error(data.error ?? "Could not start checkout.");
    }
    return {
      clientSecret: data.clientSecret,
      mode: data.mode ?? "payment",
      subscriptionId: data.subscriptionId,
      customerId: data.customerId,
    };
  }

  async function confirm(details?: BuyerDetails) {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Please check your details.");
      setBusy(false);
      return;
    }

    const buyer: BuyerDetails | undefined =
      details ?? (cardEmail ? { email: cardEmail } : undefined);

    let intent: Awaited<ReturnType<typeof createIntent>>;
    try {
      intent = await createIntent(buyer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(false);
      return;
    }

    const confirmParams = {
      return_url: `${window.location.origin}/checkout/return`,
    };
    const result =
      intent.mode === "setup"
        ? await stripe.confirmSetup({
            elements,
            clientSecret: intent.clientSecret,
            confirmParams,
            redirect: "if_required",
          })
        : await stripe.confirmPayment({
            elements,
            clientSecret: intent.clientSecret,
            confirmParams,
            redirect: "if_required",
          });
    if (result.error) {
      setError(result.error.message ?? "Payment failed. Please try again.");
      setBusy(false);
      return;
    }
    const intentId =
      "setupIntent" in result
        ? result.setupIntent?.id
        : result.paymentIntent?.id;
    onPaid({
      intentId,
      details: buyer,
      subscriptionId: intent.subscriptionId,
      customerId: intent.customerId,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {/* Express wallets (Apple Pay / Google Pay). Renders only where available. */}
      <div className={walletReady === false ? "hidden" : "flex flex-col gap-3"}>
        <ExpressCheckoutElement
          onReady={({ availablePaymentMethods }) =>
            setWalletReady(!!availablePaymentMethods)
          }
          onClick={({ resolve }) => {
            if (!agreed) {
              setNeedsConsent(true);
              return;
            }
            resolve();
          }}
          onConfirm={(e) =>
            void confirm({
              name: e.billingDetails?.name,
              email: e.billingDetails?.email,
              phone: e.billingDetails?.phone,
              address: e.billingDetails?.address as
                | Record<string, unknown>
                | undefined,
            })
          }
          options={{
            buttonHeight: 48,
            buttonType: { applePay: "plain", googlePay: "plain" },
            emailRequired: true,
            phoneNumberRequired: true,
            billingAddressRequired: true,
          }}
        />
        {walletReady && (
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">
              or pay with card
            </span>
            <Separator className="flex-1" />
          </div>
        )}
      </div>

      {/* Card + Link. The email feeds account creation/receipts on the card path. */}
      <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
        <LinkAuthenticationElement
          onChange={(e) => setCardEmail(e.value.email)}
        />
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {/* Terms gate. */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="checkout-terms"
          checked={agreed}
          onCheckedChange={(v) => {
            setAgreed(v === true);
            if (v === true) setNeedsConsent(false);
          }}
          aria-invalid={needsConsent}
        />
        <Label
          htmlFor="checkout-terms"
          className={`text-sm leading-snug font-normal ${
            needsConsent ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {copy.fineprint}
        </Label>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!agreed || busy || !stripe}
        onClick={() => void confirm()}
      >
        {busy ? "Processing…" : "Purchase Subscription"}
      </Button>
      {walletReady === false && (
        <p className="text-muted-foreground text-center text-xs">
          {wallet} isn’t available here — pay with a card above.
        </p>
      )}
    </div>
  );
}

/**
 * Mounts deferred Stripe Elements (so the wallet button can appear without a
 * server round-trip) and renders the inline payment form. `plan` supplies the
 * amount/currency/mode; `copy` supplies the fine print shown by the terms gate.
 */
export function CheckoutPayment({
  planId,
  plan,
  copy,
  onPaid,
}: {
  planId: string | number;
  plan: PlanLite;
  copy: PaywallCopy;
  onPaid: (result: PaidResult) => void;
}) {
  const deferred = deferredElementsOptions(plan);
  if (!deferred) {
    return (
      <p className="text-muted-foreground text-sm">
        This plan isn’t available for purchase yet.
      </p>
    );
  }
  return (
    <Elements
      key={`${deferred.mode}-${deferred.amount ?? 0}`}
      stripe={getStripePromise()}
      options={{
        mode: deferred.mode,
        ...(deferred.amount != null ? { amount: deferred.amount } : {}),
        currency: deferred.currency,
        appearance: { theme: "stripe", variables: { borderRadius: "8px" } },
      }}
    >
      <PaymentInner planId={planId} copy={copy} onPaid={onPaid} />
    </Elements>
  );
}

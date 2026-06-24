"use client";

// The Stripe-aware body of the paywall, mounted inside <Elements> by
// paywall-modal. Two screens, matching a Bloomberg-style wallet-first flow:
//
//   Step 1 (offer)  — the price + an "Apple Pay / Google Pay" button (white,
//                     real logo) and an "Or pay with credit card" link. BOTH
//                     advance to step 2; neither charges yet.
//   Step 2 (terms)  — "Terms & Conditions": the full fine print + an explicit
//                     opt-in checkbox. The live Express Checkout wallet button
//                     mounts only AFTER the box is checked (so the native sheet
//                     can't open before consent); the card path shows the
//                     Payment Element + Subscribe button, also gated.
//
// On the detail page the on-page gate dock IS step 1, so the modal opens
// directly at step 2 (paywall-modal `initialStep`) — never two offer screens.
import { useState } from "react";
import Link from "next/link";
import {
  ExpressCheckoutElement,
  LinkAuthenticationElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import type { BuyerDetails, PaywallCopy } from "~/lib/paywall-copy";
import { PaywallOffer } from "./paywall-offer";
import { useWalletProvider, walletName } from "./wallet-button";

export type PaywallStep = "offer" | "terms";
export type PayMethod = "wallet" | "card";

export function PaywallBody({
  copy,
  createIntent,
  step,
  setStep,
  initialMethod = "wallet",
  onPaid,
  onBack,
  onClose,
}: {
  copy: PaywallCopy;
  /**
   * Creates the PaymentIntent/subscription at confirm time (deferred flow).
   * The buyer details (wallet billingDetails / card email) are forwarded so the
   * server can stamp the Stripe customer's email + name on creation.
   */
  createIntent: (details?: BuyerDetails) => Promise<{
    clientSecret: string;
    mode: "payment" | "setup";
  }>;
  step: PaywallStep;
  setStep: (s: PaywallStep) => void;
  initialMethod?: PayMethod;
  /**
   * Receives the succeeded intent id and the buyer details captured at checkout
   * (wallet billingDetails / card email) — used to convert an anonymous account
   * + persist profile data.
   */
  onPaid: (intentId?: string, details?: BuyerDetails) => void;
  /** Back from the terms screen (→ offer, or close when terms is the entry). */
  onBack: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [method, setMethod] = useState<PayMethod>(initialMethod);
  const [agreed, setAgreed] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [walletReady, setWalletReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Email for the card path (the wallet supplies its own via billingDetails).
  const [cardEmail, setCardEmail] = useState<string>();
  const name = walletName(useWalletProvider());

  function goToTerms(m: PayMethod) {
    setMethod(m);
    setError(null);
    setStep("terms");
  }

  // Deferred confirm: validate the element, THEN create the intent server-side,
  // then confirm against it. Used by both the wallet (onConfirm) and the card
  // pay button. The clientSecret only exists from this point — Elements mounted
  // in deferred mode, which is what lets the wallet render with no upfront wait.
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

    // Prefer wallet billingDetails; fall back to the card-form email.
    const buyer: BuyerDetails | undefined =
      details ?? (cardEmail ? { email: cardEmail } : undefined);

    let intent: { clientSecret: string; mode: "payment" | "setup" };
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
    onPaid(intentId, buyer);
  }

  // ---- Step 2: Terms & Conditions → opt-in → pay ----
  if (step === "terms") {
    return (
      <div className="dr-inner">
        <div className="dr-terms-head">
          <button className="dr-back" onClick={onBack} aria-label="Back">
            ‹
          </button>
          <h2 className="dr-terms-h">Terms &amp; Conditions</h2>
        </div>
        <p className="dr-terms-body">{copy.fineprint}</p>

        {/* Consent is required to pay. If the user tries without checking, the
            text turns red (no separate error message). */}
        <label
          className={`dr-consent ${needsConsent ? "dr-consent-error" : ""}`}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              if (e.target.checked) setNeedsConsent(false);
            }}
          />
          <span>
            Please check this box to indicate that you agree to the terms and
            conditions above, including the{" "}
            <Link href="/terms" target="_blank" className="underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {/* Reserved for real payment errors (not the consent prompt). */}
        {error && (
          <p className="mb-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {method === "card" ? (
          <>
            <div className="dr-pay-wrap">
              {/* Collect the email so we can create/convert the account. */}
              <LinkAuthenticationElement
                onChange={(e) => setCardEmail(e.value.email)}
              />
              <PaymentElement options={{ layout: "tabs" }} />
            </div>
            <button
              className="pay-btn"
              style={{ margin: "16px auto 0" }}
              disabled={!agreed || busy || !stripe}
              onClick={() => void confirm()}
            >
              {busy ? "Processing…" : copy.cta}
            </button>
            <button className="dr-cc" onClick={() => setMethod("wallet")}>
              Use {name} instead
            </button>
          </>
        ) : (
          <>
            {/* The LIVE wallet button renders right away. The consent box is
                required: onClick blocks (doesn't resolve) the OS sheet until
                the box is checked. */}
            <div className="dr-pay-wrap">
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
              {walletReady === false && (
                <p className="dr-fineprint">
                  {name} isn’t available here — use a card below.
                </p>
              )}
            </div>
            <button className="dr-cc" onClick={() => setMethod("card")}>
              Or pay with credit card
            </button>
          </>
        )}
      </div>
    );
  }

  // ---- Step 1: offer (shared with the detail dock via PaywallOffer) ----
  return (
    <PaywallOffer
      headline={copy.headline}
      sub={copy.sub}
      onWallet={() => goToTerms("wallet")}
      onCard={() => goToTerms("card")}
      onClose={onClose}
    />
  );
}

"use client";

// Shared "screen 1" offer used by BOTH the full-screen / sheet modal
// (PaywallBody) and the on-page detail dock (PremiumGate), so the two
// presentations stay in sync — same wallet button, card link, and footer. Copy
// + click handlers are passed per context; the layout is one source of truth.
// No Stripe imports, so it can render outside <Elements> (the detail dock is
// not inside the Elements provider).
import type { ReactNode } from "react";
import Link from "next/link";

import { WalletButton } from "./wallet-button";

export function PaywallOffer({
  headline,
  sub,
  onWallet,
  onCard,
  onClose,
  topSlot,
}: {
  headline: string;
  sub: string;
  /** Wallet button tap (advance to the Terms/consent screen). */
  onWallet: () => void;
  /** "Or pay with credit card" (advance to the Terms/consent screen). */
  onCard: () => void;
  /** When provided, renders a "Maybe later" dismiss in the footer. */
  onClose?: () => void;
  /** Optional content above the headline (e.g. a cross-sell between plans). */
  topSlot?: ReactNode;
}) {
  return (
    <div className="dr-inner">
      {topSlot}
      <h2 className="dr-offer-h">{headline}</h2>
      <p className="dr-offer-sub">{sub}</p>

      <WalletButton onClick={onWallet} />
      <button className="dr-cc" onClick={onCard}>
        Or pay with credit card
      </button>

      <div className="dr-divider" />
      <div className="dr-foot">
        <Link href="/sign-in">Sign In</Link>
        <Link href="/terms" target="_blank">
          Terms of Service
        </Link>
        <Link href="/privacy" target="_blank">
          Privacy Policy
        </Link>
        {onClose && <button onClick={onClose}>Maybe later</button>}
      </div>
    </div>
  );
}

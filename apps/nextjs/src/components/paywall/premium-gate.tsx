"use client";

// On-page gate for premium content. While the viewer isn't premium it blurs +
// locks the body and shows an on-page dock (the offer); tapping a pay option
// opens the full modal directly at the terms screen — both share PaywallOffer,
// so the dock and the modal never drift. Once the subscription query reports
// premium (or while it's still loading for a signed-in user) the real body
// renders untouched.
import type { ReactNode } from "react";

import { buildPlanCopy } from "~/lib/paywall-copy";
import { PaywallOffer } from "./paywall-offer";
import { usePaywall } from "./paywall-provider";

import "./paywall.css";

export function PremiumGate({ children }: { children: ReactNode }) {
  const { isPremium, isLoading, isOpen, plan, openPaywall } = usePaywall();
  const copy = buildPlanCopy(plan);

  // Premium (or still resolving for a signed-in user) → show the real content.
  // Anonymous/logged-out users resolve to "not premium" instantly.
  if (isPremium || isLoading) return <>{children}</>;

  return (
    <div className="premium-gate">
      {/* The body stays in the DOM but is blurred + non-interactive. */}
      <div className="premium-gate-blur" aria-hidden="true">
        {children}
      </div>
      <div className="premium-gate-fade" aria-hidden="true" />

      {/* On-page dock — hidden while the full modal is open. */}
      {!isOpen && (
        <div className="paywall-root">
          <div className="dr-dock">
            <div className="drawer dock">
              <PaywallOffer
                headline={copy.headline}
                sub={copy.sub}
                onWallet={() => openPaywall("dock", "wallet")}
                onCard={() => openPaywall("dock", "card")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

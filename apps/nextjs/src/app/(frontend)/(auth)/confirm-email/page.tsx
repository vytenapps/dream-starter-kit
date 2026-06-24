"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { createClient } from "~/lib/supabase/client";

/**
 * Sign-up confirmation landing page. The kit's confirmation email template
 * (supabase/templates/confirmation.html) links here with `?token_hash=…`,
 * verified by an explicit `verifyOtp(type: "signup")` call.
 *
 * Why not GoTrue's {{ .ConfirmationURL }} redirect flow: re-sent confirmations
 * (supabase.auth.resend — used by /check-email, /profile, and unconfirmed
 * sign-in recovery) carry NO PKCE state, so their links redirect with
 * implicit-flow hash tokens that a server route can never read. Verifying a
 * token_hash from page JS works identically for original and re-sent emails,
 * from any browser/device, and keeps the one-time token out of the navigation
 * redirect chain (mail-scanner prefetch / Critical-CH navigation restarts
 * can't burn it — same reasoning as /accept-invite).
 *
 * On success we hard-navigate to /welcome (the server must re-read the fresh
 * auth cookie), which routes the founder into /cms-setup and everyone else to
 * /a.
 */
export default function ConfirmEmailPage() {
  const [supabase] = useState(createClient);
  const [status, setStatus] = useState<"loading" | "invalid">("loading");
  // One-time tokens must be verified exactly once — guard against React 18
  // StrictMode's dev-only double effect run (a second verifyOtp would 403).
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function confirm() {
      const query = new URLSearchParams(window.location.search);
      const tokenHash = query.get("token_hash");
      // Anonymous→permanent conversions (updateUser email) link with
      // `type=email_change`; sign-ups with `type=signup`. Honor whichever.
      const type = (query.get("type") as EmailOtpType | null) ?? "signup";
      // Conversions pass `?next=<origin>` to return the buyer to where they
      // started (a paid, now-permanent user). Same-origin relative paths only
      // (open-redirect guard); default to /welcome (routes by role).
      const nextParam = query.get("next");
      const next =
        nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : "/welcome";
      history.replaceState(null, "", window.location.pathname);

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        if (!error) {
          window.location.assign(next);
          return;
        }
        // Token used/expired — an earlier visit may have already confirmed.
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.assign(next);
        return;
      }
      setStatus("invalid");
    }

    void confirm();
  }, [supabase]);

  if (status === "loading") {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Confirming your email…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      <h1 className="text-2xl font-semibold">Link invalid or expired</h1>
      <p className="text-muted-foreground text-sm">
        This confirmation link is invalid or has expired.{" "}
        <Link href="/check-email">Request a new one</Link>, or{" "}
        <Link href="/sign-in">sign in</Link> if your email is already confirmed.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

import type { ResetPasswordInput } from "@acme/app";
import { resetPasswordSchema, updatePassword } from "@acme/app";
import { toast } from "@acme/ui/toast";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createClient } from "~/lib/supabase/client";

/**
 * Staff-invite landing page. Reached from the Supabase invite email sent by
 * the Users-collection hook (payload/hooks/invite-user.ts).
 *
 * The kit's invite template (supabase/templates/invite.html) links here with
 * `?token_hash=…`, verified by an explicit `verifyOtp(type: "invite")` call —
 * the one-time token never rides a redirect chain, so mail-scanner prefetch or
 * a browser navigation restart (e.g. for the Critical-CH client hint Payload
 * sets site-wide) can't burn it, and the link works from any browser/device.
 *
 * Fallback: Supabase's DEFAULT invite template links through GoTrue's /verify,
 * which lands here with implicit-flow session tokens in the URL hash
 * (#access_token=… — invisible to server routes, which is why this is a client
 * page and not /auth/callback). We adopt those too, for hosted projects that
 * haven't customized the template.
 *
 * Once a session exists the invitee sets a password and enters /admin —
 * `profiles.is_staff` was already flagged when the invite was sent.
 */
export default function AcceptInvitePage() {
  const [supabase] = useState(createClient);
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">(
    "loading",
  );
  // One-time tokens must be verified exactly once — guard against React 18
  // StrictMode's dev-only double effect run (a second verifyOtp would 403).
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function adoptSession() {
      const query = new URLSearchParams(window.location.search);
      const tokenHash = query.get("token_hash");
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");

      // Drop the tokens from the address bar before any async work.
      history.replaceState(null, "", window.location.pathname);

      if (tokenHash) {
        // Kit invite template: verify the one-time token → session.
        const { error } = await supabase.auth.verifyOtp({
          type: "invite",
          token_hash: tokenHash,
        });
        if (!error) {
          setStatus("ready");
          return;
        }
        // Token already used (e.g. an earlier visit) — a session may exist.
      } else if (access_token && refresh_token) {
        // Default invite template: adopt the implicit-flow session tokens.
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (!error) {
          setStatus("ready");
          return;
        }
      }

      // No (working) credentials in the URL: either supabase-js consumed the
      // hash itself (detectSessionInUrl), an earlier visit already verified,
      // or the link is expired/used. A stored session tells them apart.
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "ready" : "invalid");
    }

    void adoptSession();
  }, [supabase]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: standardSchemaResolver(resetPasswordSchema),
  });

  async function onSubmit({ password }: ResetPasswordInput) {
    try {
      await updatePassword(supabase, password);
      toast.success("Welcome aboard");
      // Hard navigation so the proxy + Payload SSO bridge re-read the fresh
      // session; is_staff is already true, so the /admin gate passes.
      window.location.assign("/admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set password");
    }
  }

  if (status === "loading") {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Checking your invite…
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold">Invite link invalid</h1>
        <p className="text-muted-foreground text-sm">
          This invite link is invalid or has expired. Ask your admin to invite
          you again, or <Link href="/sign-in">sign in</Link> if you already have
          an account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">You’re invited</h1>
        <p className="text-muted-foreground text-sm">
          Set a password to finish creating your account.
        </p>
      </div>
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-destructive text-sm">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-destructive text-sm">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Setting up…" : "Continue to admin"}
        </Button>
      </form>
    </div>
  );
}

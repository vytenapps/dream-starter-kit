"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";

import { resendSignUpEmail, verifySignUpCode } from "@acme/app";
import { cn } from "@acme/ui";

import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { authCallbackUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/client";
import { authErrorMessage } from "~/lib/supabase/config";

/**
 * Post-sign-up "Check your email" screen (email confirmations are on, the
 * hosted Supabase default). Three views:
 *
 * - `link` (default, arriving with ?email=): the confirmation email is out;
 *   clicking its link completes sign-up via /auth/callback. That link is
 *   PKCE-coupled (same browser only), so we also offer…
 * - `code`: manual entry of the 6-digit code from the same email — verifyOtp
 *   establishes the session from any browser/device.
 * - `email` (no ?email=, e.g. direct navigation): ask for the address and
 *   re-send the confirmation email.
 *
 * On success we hard-navigate to /welcome (same reasoning as signup-form: the
 * server must re-read the fresh auth cookie), which routes the founder into
 * /cms-setup and everyone else to /dashboard.
 */
export function CheckEmailForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const supabase = createClient();
  const emailParam = useSearchParams().get("email");

  const [email, setEmail] = useState(emailParam ?? "");
  const [view, setView] = useState<"link" | "code" | "email">(
    emailParam ? "link" : "email",
  );
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await verifySignUpCode(supabase, email, code.trim());
      window.location.assign("/welcome");
    } catch (err) {
      setError(authErrorMessage(err, "That code didn’t work. Try again."));
      setPending(false);
    }
  }

  async function onResend(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await resendSignUpEmail(supabase, email, {
        emailRedirectTo: authCallbackUrl("/welcome"),
      });
      setView("link");
    } catch (err) {
      setError(authErrorMessage(err, "Could not send the email. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-8 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-6" />
          </div>
          {view === "email" ? (
            <h1 className="text-xl font-bold">What’s your email address?</h1>
          ) : (
            <>
              <h1 className="text-xl font-bold">Check your email</h1>
              <FieldDescription>
                We’ve sent you a temporary login{" "}
                {view === "code" ? "code" : "link"}.
                <br />
                Please check your inbox at{" "}
                <span className="text-foreground font-medium">{email}</span>.
              </FieldDescription>
            </>
          )}
        </div>

        {view === "link" && (
          <Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError(null);
                setView("code");
              }}
            >
              Enter code manually
            </Button>
          </Field>
        )}

        {view === "code" && (
          <form onSubmit={(e) => void onVerifyCode(e)}>
            <FieldGroup>
              <Field>
                <Input
                  aria-label="Login code"
                  placeholder="Enter code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  className="text-center"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={pending || !code.trim()}>
                  {pending ? "Verifying…" : "Continue with login code"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}

        {view === "email" && (
          <form onSubmit={(e) => void onResend(e)}>
            <FieldGroup>
              <Field>
                <Input
                  type="email"
                  aria-label="Email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  className="text-center"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={pending || !email.trim()}>
                  {pending ? "Sending…" : "Continue with email"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}

        {error && (
          <FieldDescription className="text-destructive text-center">
            {error}
          </FieldDescription>
        )}

        <FieldDescription className="text-center">
          <Link href="/sign-up">Back to signup</Link>
        </FieldDescription>
      </FieldGroup>
    </div>
  );
}

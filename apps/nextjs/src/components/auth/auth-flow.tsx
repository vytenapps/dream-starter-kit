"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";

import type { AuthSettings, ChooserEntry } from "@acme/app";
import {
  chooserEntries,
  EMAIL_METHODS,
  emailSchema,
  isEmailDomainAllowed,
  resendSignUpEmail,
  signInWithOAuth,
  signInWithOtp,
  signInWithPassword,
  signInWithSSO,
  signUpWithPassword,
  ssoParamsForEmail,
  verifyEmailLoginCode,
} from "@acme/app";
import { cn } from "@acme/ui";
import { toast } from "@acme/ui/toast";

import { AppleIcon, GoogleIcon } from "~/components/auth/provider-icons";
import { useCaptcha } from "~/components/captcha/captcha-provider";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "~/components/ui/input-otp";
import { authCallbackUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/client";
import { authErrorMessage, isSupabaseConfigured } from "~/lib/supabase/config";

type Mode = "signIn" | "signUp";
type Step = "chooser" | "email" | "password" | "check";

/**
 * The shared login-05 style auth flow used by both /sign-in and /sign-up. A
 * centered card with the brand icon + a stacked list of "Continue with …"
 * buttons whose order + enablement come from the authentication-settings global
 * (the first enabled method is the filled primary). Email methods (password /
 * magic link / code) collapse into one "Continue with email" entry that opens a
 * short email → password / check-your-email sub-flow.
 */
export function AuthFlow({
  mode,
  settings,
  appName,
  onAuthenticated,
  redirectTo: redirectToProp,
}: {
  mode: Mode;
  settings: AuthSettings;
  appName: string;
  /**
   * When provided, the paths that establish a session entirely client-side
   * (password sign-in, sign-up returning a session, email-code verify) call
   * this INSTEAD of a hard navigation — so the flow can be embedded as an inline
   * step (e.g. the checkout Account step) without leaving the page. The paths
   * that inherently leave the page (OAuth, SSO, the emailed magic-link) still
   * navigate; use `redirectTo` to bring them back to where the embed lives.
   * Its presence also hides the sign-in/sign-up cross-links (no page to leave to).
   */
  onAuthenticated?: () => void;
  /**
   * Override the post-auth destination. Used by embeds whose OAuth/magic-link
   * round-trips must return to a specific URL (e.g. `/checkout?...&step=payment`).
   * Takes precedence over the `?redirectTo` query param and the configured default.
   */
  redirectTo?: string;
}) {
  const supabase = createClient();
  const configured = isSupabaseConfigured();
  const { token: captchaToken, reset: resetCaptcha } = useCaptcha();
  const isSignUp = mode === "signUp";
  const embedded = Boolean(onAuthenticated);

  // Same-origin redirect only (the value drives a full navigation + OAuth `next`).
  const redirectParam = useSearchParams().get("redirectTo");
  const configuredDest = isSignUp
    ? (settings.postSignupRedirect ?? "/welcome")
    : (settings.postLoginRedirect ?? "/welcome");
  const dest =
    redirectToProp ??
    // Same-origin only: a leading `/` but not `//` or `/\` (browsers treat a
    // backslash as a slash, so `/\evil.com` would navigate to a foreign origin).
    (!isSignUp && redirectParam && /^\/(?![/\\])/.test(redirectParam)
      ? redirectParam
      : configuredDest);
  const callback = authCallbackUrl(dest);

  // Finish a client-completable auth path: hand control back to an embedding
  // parent when present, otherwise navigate as the standalone pages do.
  function finish() {
    if (onAuthenticated) onAuthenticated();
    else window.location.assign(dest);
  }

  const m = settings.methods;
  const entries = chooserEntries(settings);
  // The first enabled email method in the configured order drives the email
  // step: magic link (default) → "check your email" link view; password →
  // password step; email code → code entry.
  const primaryEmailMethod = settings.orderedMethods.find((x) =>
    EMAIL_METHODS.includes(x),
  );

  const [step, setStep] = useState<Step>("chooser");
  const [purpose, setPurpose] = useState<"email" | "sso">("email");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpMode, setOtpMode] = useState<"link" | "code">("link");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading =
    step === "check"
      ? "Check your email"
      : step === "email" || step === "password"
        ? purpose === "sso"
          ? "What’s your work email?"
          : isSignUp && step === "password"
            ? "Create your account"
            : "What’s your email address?"
        : ((isSignUp ? settings.signUpHeading : settings.signInHeading) ??
          (isSignUp ? "Create your workspace" : `Welcome to ${appName}`));

  function termsOk(): boolean {
    if (isSignUp && settings.requireTermsAcceptance && !acceptTerms) {
      toast.error("Please accept the terms to continue");
      return false;
    }
    return true;
  }

  function emailOk(value: string): boolean {
    if (!emailSchema.safeParse(value).success) {
      setError("Enter a valid email address");
      return false;
    }
    if (isSignUp && !isEmailDomainAllowed(value, settings)) {
      setError("Sign-ups from that email domain aren’t allowed");
      return false;
    }
    setError(null);
    return true;
  }

  async function onOAuth(provider: "google" | "apple") {
    if (!termsOk()) return;
    const { error: err } = await signInWithOAuth(supabase, provider, {
      redirectTo: callback,
    });
    if (err) toast.error(authErrorMessage(err, err.message));
  }

  async function onSso(value: string) {
    const params = ssoParamsForEmail(value, settings) ?? {
      domain: value.slice(value.lastIndexOf("@") + 1),
    };
    const { data, error: err } = await signInWithSSO(supabase, params, {
      redirectTo: callback,
    });
    if (err || !data?.url) {
      setError(authErrorMessage(err, "SSO isn’t available for that email"));
      return;
    }
    window.location.assign(data.url);
  }

  // Email step submit: branch by mode + the primary email method.
  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsOk() || !emailOk(email)) return;
    if (purpose === "sso") {
      setPending(true);
      await onSso(email);
      setPending(false);
      return;
    }
    // Sign-up collects name + password when password is enabled (else a
    // passwordless sign-up link). Sign-in follows the configured primary email
    // method — magic link by default, so the user lands on "check your email".
    if (isSignUp ? m.password : primaryEmailMethod === "password") {
      setStep("password");
      return;
    }
    await sendPasswordless();
  }

  async function sendPasswordless() {
    setPending(true);
    setError(null);
    try {
      await signInWithOtp(supabase, email, {
        emailRedirectTo: callback,
        captchaToken,
      });
      // Default to the magic-link view; the user only sees the code field after
      // clicking "Enter code manually" (unless email-code is the primary method).
      setOtpMode(primaryEmailMethod === "emailOtp" ? "code" : "link");
      setStep("check");
    } catch (err) {
      setError(authErrorMessage(err, "Could not send the email"));
    } finally {
      setPending(false);
      resetCaptcha();
    }
  }

  async function onPasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signInWithPassword(supabase, { email, password }, { captchaToken });
      finish();
    } catch (err) {
      if ((err as { code?: string }).code === "email_not_confirmed") {
        try {
          await resendSignUpEmail(supabase, email, {
            emailRedirectTo: authCallbackUrl("/welcome"),
          });
        } catch {
          /* rate-limited — /check-email can resend */
        }
        window.location.assign(
          `/check-email?email=${encodeURIComponent(email)}`,
        );
        return;
      }
      setError(authErrorMessage(err, "Sign in failed"));
      setPending(false);
    } finally {
      resetCaptcha();
    }
  }

  async function onCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < settings.minPasswordLength) {
      setError(`Use at least ${settings.minPasswordLength} characters`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { session } = await signUpWithPassword(
        supabase,
        { email, password, displayName: displayName || undefined },
        { emailRedirectTo: callback, captchaToken },
      );
      if (session) {
        finish();
      } else {
        // Email confirmation required — the styled /check-email page handles the
        // sign-up link + 6-digit code (verifyOtp type "signup").
        window.location.assign(
          `/check-email?email=${encodeURIComponent(email)}`,
        );
      }
    } catch (err) {
      setError(authErrorMessage(err, "Sign up failed"));
      setPending(false);
    } finally {
      resetCaptcha();
    }
  }

  async function onVerifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    setPending(true);
    setError(null);
    try {
      await verifyEmailLoginCode(supabase, email, code.trim());
      finish();
    } catch (err) {
      setError(authErrorMessage(err, "That code didn’t work. Try again."));
      setPending(false);
    }
  }

  function chooserButton(entry: ChooserEntry, primary: boolean) {
    const variant = primary ? "default" : "outline";
    if (entry === "google") {
      return (
        <Button
          key="google"
          type="button"
          variant={variant}
          disabled={!configured}
          onClick={() => void onOAuth("google")}
        >
          <GoogleIcon />
          Continue with Google
        </Button>
      );
    }
    if (entry === "apple") {
      return (
        <Button
          key="apple"
          type="button"
          variant={variant}
          disabled={!configured}
          onClick={() => void onOAuth("apple")}
        >
          <AppleIcon />
          Continue with Apple
        </Button>
      );
    }
    if (entry === "sso") {
      return (
        <Button
          key="sso"
          type="button"
          variant={variant}
          disabled={!configured}
          onClick={() => {
            if (!termsOk()) return;
            setError(null);
            setPurpose("sso");
            setStep("email");
          }}
        >
          {settings.ssoButtonLabel}
        </Button>
      );
    }
    return (
      <Button
        key="email"
        type="button"
        variant={variant}
        disabled={!configured}
        onClick={() => {
          if (!termsOk()) return;
          setError(null);
          setPurpose("email");
          setStep("email");
        }}
      >
        Continue with email
      </Button>
    );
  }

  const Logo = (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex size-8 items-center justify-center rounded-md">
        <GalleryVerticalEnd className="size-6" />
      </div>
      <span className="sr-only">{appName}</span>
      <h1 className="text-xl font-bold">{heading}</h1>
    </div>
  );

  const backToLogin = (
    <FieldDescription className="text-center">
      <button
        type="button"
        className="underline-offset-4 hover:underline"
        onClick={() => {
          setError(null);
          setStep("chooser");
        }}
      >
        Back to login
      </button>
    </FieldDescription>
  );

  return (
    <div className={cn("flex flex-col gap-6")}>
      {step === "chooser" && (
        <FieldGroup>
          {Logo}
          {settings.subtitle && (
            <FieldDescription className="text-center">
              {settings.subtitle}
            </FieldDescription>
          )}

          {entries.length === 0 ? (
            <FieldDescription className="text-center">
              Sign-in is currently unavailable. Please check back later.
            </FieldDescription>
          ) : (
            <>
              {isSignUp && settings.requireTermsAcceptance && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="acceptTerms"
                    checked={acceptTerms}
                    onCheckedChange={(v) => setAcceptTerms(v === true)}
                  />
                  <FieldLabel htmlFor="acceptTerms" className="font-normal">
                    I agree to the{" "}
                    <a href={settings.termsUrl}>Terms of Service</a> and{" "}
                    <a href={settings.privacyUrl}>Privacy Policy</a>
                  </FieldLabel>
                </Field>
              )}
              <Field>
                {entries.map((entry, i) => chooserButton(entry, i === 0))}
              </Field>
            </>
          )}

          {!settings.requireTermsAcceptance && (
            <FieldDescription className="px-6 text-center">
              By {isSignUp ? "signing up" : "continuing"}, you agree to our{" "}
              <a href={settings.termsUrl}>Terms of Service</a> and{" "}
              <a href={settings.privacyUrl}>Privacy Policy</a>.
            </FieldDescription>
          )}

          {!embedded && (
            <FieldDescription className="text-center">
              {isSignUp ? (
                <>
                  Already have an account? <Link href="/sign-in">Log in</Link>
                </>
              ) : settings.allowSignups ? (
                <>
                  Don&apos;t have an account?{" "}
                  <Link href="/sign-up">Sign up</Link>
                </>
              ) : null}
            </FieldDescription>
          )}
        </FieldGroup>
      )}

      {step === "email" && (
        <form onSubmit={(e) => void onEmailSubmit(e)}>
          <FieldGroup>
            {Logo}
            <Field>
              <Input
                type="email"
                aria-label="Email"
                placeholder="Enter your email address…"
                autoComplete="email"
                autoFocus
                className="text-center"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {error && (
              <FieldDescription className="text-destructive text-center">
                {error}
              </FieldDescription>
            )}
            <Field>
              <Button type="submit" disabled={pending || !configured}>
                {pending
                  ? "Please wait…"
                  : purpose === "sso"
                    ? settings.ssoButtonLabel
                    : "Continue with email"}
              </Button>
              {/* Sign-in only: password is reachable without sending a link
                  first when it's enabled but not the primary email method. */}
              {!isSignUp &&
                purpose === "email" &&
                m.password &&
                primaryEmailMethod !== "password" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (emailOk(email)) setStep("password");
                    }}
                  >
                    Use password instead
                  </Button>
                )}
            </Field>
            {backToLogin}
          </FieldGroup>
        </form>
      )}

      {step === "password" && (
        <form
          onSubmit={(e) =>
            void (isSignUp ? onCreateAccount(e) : onPasswordSignIn(e))
          }
        >
          <FieldGroup>
            {Logo}
            <FieldDescription className="text-center">{email}</FieldDescription>
            {isSignUp && (
              <Field>
                <FieldLabel htmlFor="displayName">Name</FieldLabel>
                <Input
                  id="displayName"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </Field>
            )}
            <Field>
              <div className="flex items-center">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                {!isSignUp && (
                  <Link
                    href="/forgot-password"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && (
              <FieldDescription className="text-destructive text-center">
                {error}
              </FieldDescription>
            )}
            <Field>
              <Button type="submit" disabled={pending || !configured}>
                {pending
                  ? "Please wait…"
                  : isSignUp
                    ? "Create account"
                    : "Log in"}
              </Button>
              {(m.magicLink || m.emailOtp) && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void sendPasswordless()}
                >
                  Email me a {m.emailOtp && !m.magicLink ? "code" : "link"}{" "}
                  instead
                </Button>
              )}
            </Field>
            {backToLogin}
          </FieldGroup>
        </form>
      )}

      {step === "check" && (
        <FieldGroup>
          {Logo}
          <FieldDescription className="text-center">
            We&apos;ve sent you a temporary login{" "}
            {otpMode === "code" ? "code" : "link"}.
            <br />
            Please check your inbox at{" "}
            <span className="text-foreground font-medium">{email}</span>.
          </FieldDescription>

          {otpMode === "link" ? (
            <Field>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setOtpMode("code");
                }}
              >
                Enter code manually
              </Button>
            </Field>
          ) : (
            <form onSubmit={(e) => void onVerifyCode(e)}>
              <FieldGroup>
                <Field>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={code}
                      onChange={(value) => setCode(value)}
                      onComplete={() => void onVerifyCode()}
                      aria-label="Login code"
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </Field>
                {error && (
                  <FieldDescription className="text-destructive text-center">
                    {error}
                  </FieldDescription>
                )}
                <Field>
                  <Button type="submit" disabled={pending || !code.trim()}>
                    {pending ? "Verifying…" : "Continue with login code"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
          {backToLogin}
        </FieldGroup>
      )}
    </div>
  );
}

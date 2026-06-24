"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { GalleryVerticalEnd } from "lucide-react";
import { useForm } from "react-hook-form";

import type { SignInInput } from "@acme/app";
import {
  emailSchema,
  resendSignUpEmail,
  signInSchema,
  signInWithOAuth,
  signInWithOtp,
  signInWithPassword,
} from "@acme/app";
import { cn } from "@acme/ui";
import { toast } from "@acme/ui/toast";

import { useCaptcha } from "~/components/captcha/captcha-provider";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { authCallbackUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/client";
import { authErrorMessage, isSupabaseConfigured } from "~/lib/supabase/config";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const supabase = createClient();
  const configured = isSupabaseConfigured();
  const { token: captchaToken, reset: resetCaptcha } = useCaptcha();
  // Only honor same-origin paths — this value drives a full-page navigation
  // (and the OAuth callback `next`), so an absolute/protocol-relative URL would
  // be an open redirect. Default destination is /welcome, which routes by role:
  // staff/admin into the CMS (/admin, seeding first if needed), everyone else
  // to /a. An explicit redirectTo (e.g. a deep link) still wins.
  const redirectParam = useSearchParams().get("redirectTo");
  const redirectTo =
    redirectParam?.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/welcome";
  const callback = authCallbackUrl(redirectTo);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: standardSchemaResolver(signInSchema) });

  async function onSubmit(values: SignInInput) {
    try {
      await signInWithPassword(supabase, values, { captchaToken });
      window.location.assign(redirectTo);
    } catch (e) {
      // Unconfirmed email (correct password): don't dead-end on an error
      // toast — re-send the confirmation and continue on /check-email, which
      // offers the fresh link and the manual 6-digit code. Covers users whose
      // original link expired or redirected to a misconfigured Site URL.
      if ((e as { code?: string }).code === "email_not_confirmed") {
        try {
          await resendSignUpEmail(supabase, values.email, {
            emailRedirectTo: authCallbackUrl("/welcome"),
          });
        } catch {
          // Rate-limited or transient — /check-email can re-send manually.
        }
        window.location.assign(
          `/check-email?email=${encodeURIComponent(values.email)}`,
        );
        return;
      }
      toast.error(authErrorMessage(e, "Sign in failed"));
    } finally {
      // Turnstile tokens are single-use — mint a fresh one for the next attempt.
      resetCaptcha();
    }
  }

  async function onMagicLink() {
    const email = getValues("email");
    if (!emailSchema.safeParse(email).success) {
      toast.error("Enter your email first");
      return;
    }
    try {
      await signInWithOtp(supabase, email, {
        emailRedirectTo: callback,
        captchaToken,
      });
      toast.success("Check your email for a magic link");
    } catch (e) {
      toast.error(authErrorMessage(e, "Could not send link"));
    } finally {
      resetCaptcha();
    }
  }

  async function onOAuth(provider: "google" | "apple") {
    const { error } = await signInWithOAuth(supabase, provider, {
      redirectTo: callback,
    });
    if (error) toast.error(authErrorMessage(error, error.message));
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to Acme Inc.</h1>
            <FieldDescription>
              Don&apos;t have an account? <Link href="/sign-up">Sign up</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              {...register("email")}
            />
            {errors.email && (
              <FieldDescription className="text-destructive">
                {errors.email.message}
              </FieldDescription>
            )}
          </Field>
          <Field>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="/forgot-password"
                className="ml-auto text-sm underline-offset-4 hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && (
              <FieldDescription className="text-destructive">
                {errors.password.message}
              </FieldDescription>
            )}
          </Field>
          <Field>
            <Button type="submit" disabled={isSubmitting || !configured}>
              {isSubmitting ? "Signing in…" : "Login"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!configured}
              onClick={() => void onMagicLink()}
            >
              Email me a magic link
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field className="grid gap-4 sm:grid-cols-2">
            <Button
              variant="outline"
              type="button"
              disabled={!configured}
              onClick={() => void onOAuth("apple")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  fill="currentColor"
                />
              </svg>
              Continue with Apple
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={!configured}
              onClick={() => void onOAuth("google")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a href="/terms">Terms of Service</a> and{" "}
        <a href="/privacy">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}

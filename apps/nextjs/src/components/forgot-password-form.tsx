"use client";

import Link from "next/link";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

import type { ForgotPasswordInput } from "@acme/app";
import { forgotPasswordSchema, resetPasswordForEmail } from "@acme/app";
import { toast } from "@acme/ui/toast";

import { useCaptcha } from "~/components/captcha/captcha-provider";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authCallbackUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/client";

export function ForgotPasswordForm() {
  const supabase = createClient();
  const { token: captchaToken, reset: resetCaptcha } = useCaptcha();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ForgotPasswordInput>({
    resolver: standardSchemaResolver(forgotPasswordSchema),
  });

  async function onSubmit({ email }: ForgotPasswordInput) {
    try {
      await resetPasswordForEmail(
        supabase,
        email,
        authCallbackUrl("/reset-password"),
        { captchaToken },
      );
      toast.success("If that email exists, a reset link is on its way");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not send reset email",
      );
    } finally {
      resetCaptcha();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-muted-foreground text-sm">
          We&apos;ll email you a link to set a new one
        </p>
      </div>

      {isSubmitSuccessful ? (
        <p className="text-muted-foreground text-center text-sm">
          Check your inbox.
        </p>
      ) : (
        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/sign-in" className="text-foreground underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

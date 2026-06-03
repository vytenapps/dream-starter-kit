"use client";

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
 * Reached via the password-reset email → /auth/callback (which exchanges the
 * code for a session) → here. The recovery session lets us call updateUser.
 */
export default function ResetPasswordPage() {
  const supabase = createClient();
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
      toast.success("Password updated");
      // Full-page nav so the server + proxy re-read the just-updated session
      // (a soft router navigation to the gated /profile doesn't pick it up).
      window.location.assign("/profile");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-2xl font-semibold">Set a new password</h1>
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
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
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}

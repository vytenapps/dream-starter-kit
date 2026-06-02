"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { GalleryVerticalEnd } from "lucide-react";
import { useForm } from "react-hook-form";

import type { SignUpInput } from "@acme/app";
import { signInWithOAuth, signUpSchema, signUpWithPassword } from "@acme/app";
import { APP_NAME } from "@acme/config/constants";
import { cn } from "@acme/ui";
import { toast } from "@acme/ui/toast";

import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { createClient } from "~/lib/supabase/client";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const supabase = createClient();
  const callback = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=/dashboard`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: standardSchemaResolver(signUpSchema) });

  async function onSubmit(values: SignUpInput) {
    try {
      await signUpWithPassword(supabase, values, { emailRedirectTo: callback });
      toast.success("Account created");
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign up failed");
    }
  }

  async function onOAuth(provider: "google" | "apple") {
    const { error } = await signInWithOAuth(supabase, provider, {
      redirectTo: callback,
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-8 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-6" />
            </div>
            <h1 className="text-xl font-bold">Welcome to {APP_NAME}</h1>
            <FieldDescription>
              Already have an account? <Link href="/sign-in">Sign in</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="displayName">Name</FieldLabel>
            <Input id="displayName" {...register("displayName")} />
            {errors.displayName && (
              <FieldDescription className="text-destructive">
                {errors.displayName.message}
              </FieldDescription>
            )}
          </Field>
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
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && (
              <FieldDescription className="text-destructive">
                {errors.password.message}
              </FieldDescription>
            )}
          </Field>
          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create account"}
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field>
            <Button
              variant="outline"
              type="button"
              onClick={() => void onOAuth("google")}
            >
              Continue with Google
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void onOAuth("apple")}
            >
              Continue with Apple
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

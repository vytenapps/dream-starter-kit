"use client";

import { useRouter } from "next/navigation";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

import type { UpdateProfileInput } from "@acme/app";
import { useSession } from "@acme/api";
import {
  resendSignUpEmail,
  signOut,
  updateProfileSchema,
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
  useUserTags,
} from "@acme/app";
import { toast } from "@acme/ui/toast";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authCallbackUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/client";
import { authErrorMessage } from "~/lib/supabase/config";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useSession();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const tags = useUserTags();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: standardSchemaResolver(updateProfileSchema),
    values: {
      displayName: profile.data?.display_name ?? "",
      avatarUrl: profile.data?.avatar_url ?? "",
    },
  });

  async function onSave(values: UpdateProfileInput) {
    try {
      await updateProfile.mutateAsync(values);
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function onSignOut() {
    try {
      await signOut(supabase);
    } catch {
      // Local session cookies are cleared even if the server revoke fails.
    }
    // Hard navigation (not router.replace + refresh): discards the client Router
    // Cache so any entitled content rendered while signed in (e.g. a gated
    // post/plan) can't linger after logout.
    window.location.assign("/sign-in");
  }

  // Recovery path for an unconfirmed email (e.g. the confirmation link
  // expired or redirected to the wrong origin before the project's auth URLs
  // were configured): re-send a fresh confirmation and finish on /check-email,
  // which offers both the link and the manual 6-digit code.
  async function onVerifyEmail() {
    if (!user?.email) return;
    try {
      await resendSignUpEmail(supabase, user.email, {
        emailRedirectTo: authCallbackUrl("/welcome"),
      });
      window.location.assign(
        `/check-email?email=${encodeURIComponent(user.email)}`,
      );
    } catch (e) {
      toast.error(authErrorMessage(e, "Could not send the email. Try again."));
    }
  }

  async function onDelete() {
    if (
      !window.confirm("Permanently delete your account? This cannot be undone.")
    ) {
      return;
    }
    try {
      await deleteAccount.mutateAsync();
      toast.success("Account deleted");
      router.replace("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{user?.email}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void onSignOut()}
        >
          Sign out
        </Button>
      </div>

      {user && !user.email_confirmed_at && (
        <div className="border-muted-foreground/30 -mt-4 rounded-lg border p-4">
          <h2 className="font-medium">Email not verified</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Your email address hasn’t been confirmed yet. We can send you a
            fresh confirmation link and code.
          </p>
          <Button type="button" onClick={() => void onVerifyEmail()}>
            Verify email
          </Button>
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(onSave)(e)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" {...register("displayName")} />
          {errors.displayName && (
            <p className="text-destructive text-sm">
              {errors.displayName.message}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            placeholder="https://…"
            {...register("avatarUrl")}
          />
          {errors.avatarUrl && (
            <p className="text-destructive text-sm">
              {errors.avatarUrl.message}
            </p>
          )}
        </div>
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Saving…" : "Save"}
        </Button>
      </form>

      <div className="grid gap-2">
        <Label>Tags</Label>
        {tags.data && tags.data.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.data.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                style={
                  tag.color
                    ? { backgroundColor: tag.color, color: "#fff" }
                    : undefined
                }
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {tags.isLoading ? "Loading…" : "No tags yet."}
          </p>
        )}
      </div>

      <div className="border-destructive/30 mt-4 rounded-lg border p-4">
        <h2 className="text-destructive font-medium">Danger zone</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Delete your account and all associated data.
        </p>
        <Button
          type="button"
          variant="destructive"
          disabled={deleteAccount.isPending}
          onClick={() => void onDelete()}
        >
          {deleteAccount.isPending ? "Deleting…" : "Delete account"}
        </Button>
      </div>
    </div>
  );
}

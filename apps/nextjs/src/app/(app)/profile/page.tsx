"use client";

import { useRouter } from "next/navigation";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

import { useSession } from "@acme/api";
import type { UpdateProfileInput } from "@acme/app";
import {
  signOut,
  updateProfileSchema,
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
} from "@acme/app";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import { toast } from "@acme/ui/toast";

import { createClient } from "~/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useSession();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

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
    await signOut(supabase);
    router.replace("/sign-in");
    router.refresh();
  }

  async function onDelete() {
    if (!window.confirm("Permanently delete your account? This cannot be undone.")) {
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <Button type="button" variant="outline" onClick={() => void onSignOut()}>
          Sign out
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">{user?.email}</p>

      <form
        onSubmit={(e) => void handleSubmit(onSave)(e)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" {...register("displayName")} />
          {errors.displayName && (
            <p className="text-destructive text-sm">{errors.displayName.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input id="avatarUrl" placeholder="https://…" {...register("avatarUrl")} />
          {errors.avatarUrl && (
            <p className="text-destructive text-sm">{errors.avatarUrl.message}</p>
          )}
        </div>
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Saving…" : "Save"}
        </Button>
      </form>

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
    </main>
  );
}

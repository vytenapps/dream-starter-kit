import { Alert, ScrollView, View } from "react-native";
import { Stack } from "expo-router";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import { useSession } from "@acme/api";
import type { UpdateProfileInput } from "@acme/app";
import {
  signOut,
  updateProfileSchema,
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
} from "@acme/app";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { supabase } from "~/lib/supabase";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function Profile() {
  const { user } = useSession();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const {
    control,
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
      Alert.alert("Saved", "Your profile was updated.");
    } catch (e) {
      Alert.alert("Save failed", msg(e));
    }
  }

  function onDelete() {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all your data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void (async () => {
              try {
                await deleteAccount.mutateAsync();
              } catch (e) {
                Alert.alert("Delete failed", msg(e));
              }
            })(),
        },
      ],
    );
  }

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-6"
    >
      <Stack.Screen options={{ title: "Profile" }} />
      <Text className="text-muted-foreground">{user?.email}</Text>

      <View className="gap-1">
        <Text className="text-sm font-medium">Display name</Text>
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input value={value} onChangeText={onChange} onBlur={onBlur} />
          )}
        />
        {errors.displayName && (
          <Text className="text-destructive text-sm">
            {errors.displayName.message}
          </Text>
        )}
      </View>

      <View className="gap-1">
        <Text className="text-sm font-medium">Avatar URL</Text>
        <Controller
          control={control}
          name="avatarUrl"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="https://…"
              autoCapitalize="none"
              value={value ?? ""}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.avatarUrl && (
          <Text className="text-destructive text-sm">
            {errors.avatarUrl.message}
          </Text>
        )}
      </View>

      <Button
        title="Save"
        loading={updateProfile.isPending}
        onPress={() => void handleSubmit(onSave)()}
      />
      <Button
        title="Sign out"
        variant="outline"
        onPress={() => void signOut(supabase)}
      />
      <Button
        title="Delete account"
        variant="destructive"
        loading={deleteAccount.isPending}
        onPress={onDelete}
      />
    </ScrollView>
  );
}

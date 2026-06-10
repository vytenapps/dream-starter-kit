import { Alert, ScrollView, View } from "react-native";
import { Stack } from "expo-router";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import type { UpdateProfileInput } from "@acme/app";
import { useSession } from "@acme/api";
import {
  signOut,
  updateProfileSchema,
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
  useUserTags,
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
  const tags = useUserTags();

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

      <View className="gap-1">
        <Text className="text-sm font-medium">Tags</Text>
        {tags.data && tags.data.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {tags.data.map((tag) => (
              <View
                key={tag.id}
                className="bg-secondary rounded-full px-3 py-1"
                style={tag.color ? { backgroundColor: tag.color } : undefined}
              >
                <Text className="text-secondary-foreground text-xs">
                  {tag.name}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-muted-foreground text-sm">
            {tags.isLoading ? "Loading…" : "No tags yet."}
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

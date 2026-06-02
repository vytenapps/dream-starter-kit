import { Alert, View } from "react-native";
import * as Linking from "expo-linking";
import { Link } from "expo-router";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import type { ForgotPasswordInput } from "@acme/app";
import { forgotPasswordSchema, resetPasswordForEmail } from "@acme/app";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { supabase } from "~/lib/supabase";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function ForgotPassword() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: standardSchemaResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: ForgotPasswordInput) {
    try {
      await resetPasswordForEmail(
        supabase,
        email,
        Linking.createURL("/auth-callback"),
      );
      Alert.alert("Check your email", "We sent you a reset link.");
    } catch (e) {
      Alert.alert("Could not send email", msg(e));
    }
  }

  return (
    <View className="bg-background flex-1 justify-center gap-4 p-6">
      <Text className="text-3xl font-bold">Reset password</Text>
      <View className="gap-1">
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.email && (
          <Text className="text-destructive text-sm">
            {errors.email.message}
          </Text>
        )}
      </View>
      <Button
        title="Send reset link"
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />
      <View className="flex-row justify-center">
        <Link href="/sign-in">
          <Text className="text-primary">Back to sign in</Text>
        </Link>
      </View>
    </View>
  );
}

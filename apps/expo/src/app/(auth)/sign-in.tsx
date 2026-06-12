import { useState } from "react";
import { Alert, View } from "react-native";
import * as Linking from "expo-linking";
import { Link } from "expo-router";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import type { SignInInput } from "@acme/app";
import {
  emailSchema,
  signInSchema,
  signInWithOtp,
  signInWithPassword,
} from "@acme/app";
import { Button } from "@acme/ui-native/button";
import { Input } from "@acme/ui-native/input";
import { Text } from "@acme/ui-native/text";

import { nativeOAuth } from "~/lib/auth";
import { supabase } from "~/lib/supabase";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function SignIn() {
  const [oauth, setOauth] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: standardSchemaResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInInput) {
    try {
      await signInWithPassword(supabase, values);
    } catch (e) {
      Alert.alert("Sign in failed", msg(e));
    }
  }

  async function onMagicLink() {
    const email = getValues("email");
    if (!emailSchema.safeParse(email).success) {
      Alert.alert("Enter your email first");
      return;
    }
    try {
      await signInWithOtp(supabase, email, {
        emailRedirectTo: Linking.createURL("/auth-callback"),
      });
      Alert.alert("Check your email", "We sent you a magic link.");
    } catch (e) {
      Alert.alert("Could not send link", msg(e));
    }
  }

  async function onOAuth(provider: "google" | "apple") {
    setOauth(provider);
    try {
      await nativeOAuth(provider);
    } catch (e) {
      Alert.alert("Sign in failed", msg(e));
    } finally {
      setOauth(null);
    }
  }

  return (
    <View className="bg-background flex-1 justify-center gap-4 p-6">
      <Text className="text-3xl font-bold">Welcome back</Text>

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

      <View className="gap-1">
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="Password"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.password && (
          <Text className="text-destructive text-sm">
            {errors.password.message}
          </Text>
        )}
      </View>

      <Button
        title="Sign in"
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />
      <Button
        title="Email me a magic link"
        variant="ghost"
        onPress={() => void onMagicLink()}
      />

      <View className="gap-2">
        <Button
          title="Continue with Google"
          variant="outline"
          loading={oauth === "google"}
          onPress={() => void onOAuth("google")}
        />
        <Button
          title="Continue with Apple"
          variant="outline"
          loading={oauth === "apple"}
          onPress={() => void onOAuth("apple")}
        />
      </View>

      <View className="flex-row justify-center gap-4">
        <Link href="/sign-up">
          <Text className="text-primary">Create account</Text>
        </Link>
        <Link href="/forgot-password">
          <Text className="text-muted-foreground">Forgot password?</Text>
        </Link>
      </View>
    </View>
  );
}

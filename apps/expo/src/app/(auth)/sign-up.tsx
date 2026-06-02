import { Alert, View } from "react-native";
import * as Linking from "expo-linking";
import { Link } from "expo-router";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import type { SignUpInput } from "@acme/app";
import { signUpSchema, signUpWithPassword } from "@acme/app";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { supabase } from "~/lib/supabase";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function SignUp() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: standardSchemaResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  async function onSubmit(values: SignUpInput) {
    try {
      await signUpWithPassword(supabase, values, {
        emailRedirectTo: Linking.createURL("/auth-callback"),
      });
      Alert.alert("Account created", "You're all set.");
    } catch (e) {
      Alert.alert("Sign up failed", msg(e));
    }
  }

  return (
    <View className="bg-background flex-1 justify-center gap-4 p-6">
      <Text className="text-3xl font-bold">Create account</Text>

      <View className="gap-1">
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="Name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.displayName && (
          <Text className="text-destructive text-sm">
            {errors.displayName.message}
          </Text>
        )}
      </View>

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
        title="Create account"
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />

      <View className="flex-row justify-center">
        <Link href="/sign-in">
          <Text className="text-primary">Already have an account? Sign in</Text>
        </Link>
      </View>
    </View>
  );
}

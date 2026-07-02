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
  ssoParamsForEmail,
  useAuthConfig,
  verifyEmailLoginCode,
} from "@acme/app";
import { Button } from "@acme/ui-native/button";
import { Input } from "@acme/ui-native/input";
import { Text } from "@acme/ui-native/text";

import { nativeOAuth, nativeSSO } from "~/lib/auth";
import { supabase } from "~/lib/supabase";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function SignIn() {
  const settings = useAuthConfig();
  const m = settings.methods;
  const [oauth, setOauth] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: standardSchemaResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const emailMethods = m.password || m.magicLink || m.emailOtp || m.sso;

  function requireEmail(): string | null {
    const email = getValues("email");
    if (!emailSchema.safeParse(email).success) {
      Alert.alert("Enter your email first");
      return null;
    }
    return email;
  }

  async function onSubmit(values: SignInInput) {
    try {
      await signInWithPassword(supabase, values);
    } catch (e) {
      Alert.alert("Sign in failed", msg(e));
    }
  }

  async function onMagicLink() {
    const email = requireEmail();
    if (!email) return;
    try {
      await signInWithOtp(supabase, email, {
        emailRedirectTo: Linking.createURL("/auth-callback"),
        // Sign-in must never create an account (that's the sign-up screen).
        shouldCreateUser: false,
      });
      Alert.alert("Check your email", "We sent you a magic link.");
    } catch (e) {
      Alert.alert("Could not send link", msg(e));
    }
  }

  async function onSendCode() {
    const email = requireEmail();
    if (!email) return;
    try {
      await signInWithOtp(supabase, email, { shouldCreateUser: false });
      setOtpSent(true);
    } catch (e) {
      Alert.alert("Could not send code", msg(e));
    }
  }

  async function onVerifyCode() {
    setVerifying(true);
    try {
      await verifyEmailLoginCode(supabase, getValues("email"), otpCode.trim());
      // Session established — AuthGate routes into the app.
    } catch (e) {
      Alert.alert("Invalid or expired code", msg(e));
      setVerifying(false);
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

  async function onSso() {
    const email = requireEmail();
    if (!email) return;
    setOauth("sso");
    try {
      const params = ssoParamsForEmail(email, settings) ?? {
        domain: email.slice(email.lastIndexOf("@") + 1),
      };
      await nativeSSO(params);
    } catch (e) {
      Alert.alert("SSO sign-in failed", msg(e));
    } finally {
      setOauth(null);
    }
  }

  if (otpSent) {
    return (
      <View className="bg-background flex-1 justify-center gap-4 p-6">
        <Text className="text-3xl font-bold">Enter your code</Text>
        <Text className="text-muted-foreground">
          We emailed a 6-digit code to {getValues("email")}.
        </Text>
        <Input
          placeholder="Enter code"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          className="text-center"
          value={otpCode}
          onChangeText={setOtpCode}
        />
        <Button
          title="Verify code"
          loading={verifying}
          disabled={verifying || otpCode.trim().length < 6}
          onPress={() => void onVerifyCode()}
        />
        <Button
          title="Use a different method"
          variant="ghost"
          onPress={() => {
            setOtpSent(false);
            setOtpCode("");
          }}
        />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1 justify-center gap-4 p-6">
      <Text className="text-3xl font-bold">
        {settings.signInHeading ?? "Welcome back"}
      </Text>

      {emailMethods && (
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
      )}

      {m.password && (
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
      )}

      {m.password && (
        <Button
          title="Sign in"
          loading={isSubmitting}
          onPress={() => void handleSubmit(onSubmit)()}
        />
      )}
      {m.magicLink && (
        <Button
          title="Email me a magic link"
          variant="ghost"
          onPress={() => void onMagicLink()}
        />
      )}
      {m.emailOtp && (
        <Button
          title="Email me a code"
          variant="ghost"
          onPress={() => void onSendCode()}
        />
      )}

      {(m.google || m.apple || m.sso) && (
        <View className="gap-2">
          {m.google && (
            <Button
              title="Continue with Google"
              variant="outline"
              loading={oauth === "google"}
              onPress={() => void onOAuth("google")}
            />
          )}
          {m.apple && (
            <Button
              title="Continue with Apple"
              variant="outline"
              loading={oauth === "apple"}
              onPress={() => void onOAuth("apple")}
            />
          )}
          {m.sso && (
            <Button
              title={settings.ssoButtonLabel}
              variant="outline"
              loading={oauth === "sso"}
              onPress={() => void onSso()}
            />
          )}
        </View>
      )}

      <View className="flex-row justify-center gap-4">
        {settings.allowSignups && (
          <Link href="/sign-up">
            <Text className="text-primary">Create account</Text>
          </Link>
        )}
        {m.password && (
          <Link href="/forgot-password">
            <Text className="text-muted-foreground">Forgot password?</Text>
          </Link>
        )}
      </View>
    </View>
  );
}

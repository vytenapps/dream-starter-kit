import { useState } from "react";
import { Alert, View } from "react-native";
import * as Linking from "expo-linking";
import { Link } from "expo-router";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import type { SignUpInput } from "@acme/app";
import {
  isEmailDomainAllowed,
  makeSignUpSchema,
  signInWithOtp,
  signUpWithPassword,
  useAuthConfig,
  verifyEmailLoginCode,
  verifySignUpCode,
} from "@acme/app";
import { Button } from "@acme/ui-native/button";
import { Input } from "@acme/ui-native/input";
import { Text } from "@acme/ui-native/text";

import { nativeOAuth } from "~/lib/auth";
import { supabase } from "~/lib/supabase";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function SignUp() {
  const settings = useAuthConfig();
  const m = settings.methods;
  // Set once sign-up needs email confirmation (the hosted Supabase default) or a
  // passwordless sign-up link/code is sent: swaps the form for "Check your email".
  const [confirm, setConfirm] = useState<{
    email: string;
    mode: "signup" | "otp";
  } | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: standardSchemaResolver(
      makeSignUpSchema({ minPasswordLength: settings.minPasswordLength }),
    ),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const passwordlessSignup = m.magicLink || m.emailOtp;

  function gate(email: string): boolean {
    if (settings.requireTermsAcceptance && !acceptTerms) {
      Alert.alert("Please accept the terms to continue");
      return false;
    }
    if (!isEmailDomainAllowed(email, settings)) {
      Alert.alert("Sign-ups from that email domain aren't allowed");
      return false;
    }
    return true;
  }

  async function onSubmit(values: SignUpInput) {
    if (!gate(values.email)) return;
    try {
      const { session } = await signUpWithPassword(supabase, values, {
        emailRedirectTo: Linking.createURL("/auth-callback"),
      });
      // With confirmations off there's a session already — AuthGate redirects.
      if (!session) setConfirm({ email: values.email, mode: "signup" });
    } catch (e) {
      Alert.alert("Sign up failed", msg(e));
    }
  }

  async function onPasswordlessSignup() {
    const email = getValues("email");
    if (!gate(email)) return;
    setSendingLink(true);
    try {
      await signInWithOtp(supabase, email, {
        emailRedirectTo: Linking.createURL("/auth-callback"),
        // Sign-up screen (gated by `gate()` above): creating the account is intended.
        shouldCreateUser: true,
      });
      setConfirm({ email, mode: "otp" });
    } catch (e) {
      Alert.alert("Could not send sign-up link", msg(e));
    } finally {
      setSendingLink(false);
    }
  }

  async function onOAuth(provider: "google" | "apple") {
    if (settings.requireTermsAcceptance && !acceptTerms) {
      Alert.alert("Please accept the terms to continue");
      return;
    }
    try {
      await nativeOAuth(provider);
    } catch (e) {
      Alert.alert("Sign up failed", msg(e));
    }
  }

  if (confirm) {
    return (
      <CheckEmail
        email={confirm.email}
        mode={confirm.mode}
        onBack={() => setConfirm(null)}
      />
    );
  }

  const hasEmailForm = m.password || passwordlessSignup;

  return (
    <View className="bg-background flex-1 justify-center gap-4 p-6">
      <Text className="text-3xl font-bold">
        {settings.signUpHeading ?? "Create account"}
      </Text>

      {hasEmailForm && (
        <>
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
        </>
      )}

      {settings.requireTermsAcceptance && (
        <Text
          className="text-muted-foreground text-sm"
          onPress={() => setAcceptTerms((v) => !v)}
        >
          {acceptTerms ? "☑" : "☐"} I agree to the Terms of Service and Privacy
          Policy
        </Text>
      )}

      {m.password && (
        <Button
          title="Create account"
          loading={isSubmitting}
          onPress={() => void handleSubmit(onSubmit)()}
        />
      )}
      {passwordlessSignup && (
        <Button
          title="Email me a sign-up link"
          variant={m.password ? "ghost" : "default"}
          loading={sendingLink}
          onPress={() => void onPasswordlessSignup()}
        />
      )}

      {(m.google || m.apple) && (
        <View className="gap-2">
          {m.google && (
            <Button
              title="Continue with Google"
              variant="outline"
              onPress={() => void onOAuth("google")}
            />
          )}
          {m.apple && (
            <Button
              title="Continue with Apple"
              variant="outline"
              onPress={() => void onOAuth("apple")}
            />
          )}
        </View>
      )}

      <View className="flex-row justify-center">
        <Link href="/sign-in">
          <Text className="text-primary">Already have an account? Sign in</Text>
        </Link>
      </View>
    </View>
  );
}

/**
 * Post-sign-up confirmation view (mirrors the web /check-email screen). The
 * emailed link opens the WEB /confirm-email page (kit template, token_hash) —
 * it confirms the account but signs in the browser, not this app — so the
 * 6-digit code verified inline here is the primary path on native. `mode`
 * selects the OTP type: "signup" for a password sign-up confirmation, "otp" for
 * a passwordless email-code sign-up.
 */
function CheckEmail({
  email,
  mode,
  onBack,
}: {
  email: string;
  mode: "signup" | "otp";
  onBack: () => void;
}) {
  const [enterCode, setEnterCode] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function onVerify() {
    setVerifying(true);
    try {
      if (mode === "signup") {
        await verifySignUpCode(supabase, email, code.trim());
      } else {
        await verifyEmailLoginCode(supabase, email, code.trim());
      }
      // Session established — AuthGate routes into the app.
    } catch (e) {
      Alert.alert("That code didn’t work", msg(e));
      setVerifying(false);
    }
  }

  return (
    <View className="bg-background flex-1 justify-center gap-4 p-6">
      <Text className="text-center text-3xl font-bold">Check your email</Text>
      <Text className="text-muted-foreground text-center">
        We’ve sent you a temporary login {enterCode ? "code" : "link"}.{"\n"}
        Please check your inbox at{" "}
        <Text className="text-foreground font-medium">{email}</Text>.
      </Text>

      {enterCode ? (
        <>
          <Input
            placeholder="Enter code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            className="text-center"
            value={code}
            onChangeText={setCode}
          />
          <Button
            title="Continue with login code"
            loading={verifying}
            disabled={verifying || !code.trim()}
            onPress={() => void onVerify()}
          />
        </>
      ) : (
        <Button
          title="Enter code manually"
          variant="outline"
          onPress={() => setEnterCode(true)}
        />
      )}

      <View className="flex-row justify-center">
        <Text className="text-primary" onPress={onBack}>
          Back to signup
        </Text>
      </View>
    </View>
  );
}

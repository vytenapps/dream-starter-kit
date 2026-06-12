import { Pressable } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@acme/ui-native/text";

import { usePremium } from "../index";

/** Home-screen widget: plan status + upgrade pointer. */
export function BillingWidget() {
  const router = useRouter();
  const premium = usePremium();

  return (
    <Pressable
      className="border-border w-full rounded-md border p-3"
      onPress={() => router.push("/x/billing")}
    >
      <Text className="text-muted-foreground text-xs">Plan</Text>
      <Text className="text-base font-medium">
        {premium.isLoading
          ? "—"
          : premium.isPremium
            ? "Pro 🎉"
            : "Free — see plans"}
      </Text>
    </Pressable>
  );
}

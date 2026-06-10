import { Linking, ScrollView, View } from "react-native";
import { Stack } from "expo-router";

import type { Plan } from "@acme/cms";
import { usePlans, usePremium } from "@acme/app";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { clientEnv } from "~/lib/env";

/** "$9.99" / "$399" — drop decimals on whole-dollar amounts. */
function price(cents: number, currency: string) {
  const symbol = currency.toLowerCase() === "usd" ? "$" : "";
  const dollars = cents / 100;
  return `${symbol}${cents % 100 === 0 ? dollars : dollars.toFixed(2)}`;
}

function cadence(plan: Plan) {
  if (plan.pricingType === "one_time") return "";
  return plan.interval === "year" ? "/yr" : "/mo";
}

/**
 * Native pricing screen. Stripe is web-only in this kit (golden rule #4), so
 * mobile DISPLAYS the plans (read from the CMS) and links out to the web pricing
 * page to subscribe. Premium itself is read from the subscriptions table, so a
 * subscription bought on the web unlocks Pro here automatically.
 */
export default function Pricing() {
  const plans = usePlans();
  const premium = usePremium();
  const webPricingUrl = `${clientEnv.APP_URL}/pricing`;

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-6"
    >
      <Stack.Screen options={{ title: "Pricing" }} />

      <Text className="text-muted-foreground">
        {premium.isPremium
          ? "You're on a paid plan 🎉"
          : "You're on the Free plan."}
      </Text>

      {plans.data?.map((plan) => (
        <View key={plan.id} className="border-border gap-2 rounded-xl border p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold">{plan.name}</Text>
            {plan.badge ? (
              <Text className="text-primary text-xs font-medium">
                {plan.badge}
              </Text>
            ) : null}
          </View>
          <Text className="text-2xl font-bold">
            {price(plan.unitAmount, plan.currency)}
            <Text className="text-muted-foreground text-sm">
              {cadence(plan)}
            </Text>
          </Text>
          {plan.description ? (
            <Text className="text-muted-foreground text-sm">
              {plan.description}
            </Text>
          ) : null}
          {(plan.features ?? []).map((f, i) => (
            <Text key={i} className="text-sm">
              • {f.text}
            </Text>
          ))}
        </View>
      ))}

      {plans.isLoading ? (
        <Text className="text-muted-foreground">Loading plans…</Text>
      ) : null}

      <Button
        title="Subscribe on the web"
        onPress={() => void Linking.openURL(webPricingUrl)}
      />
      <Text className="text-muted-foreground text-center text-xs">
        Payments are handled securely on the web.
      </Text>
    </ScrollView>
  );
}

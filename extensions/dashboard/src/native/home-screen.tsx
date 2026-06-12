import type { Href } from "expo-router";
import { ScrollView, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import type { NavMenuEntry } from "@acme/app";
import { useSession } from "@acme/api";
import { useNavMenu } from "@acme/app";
import { APP_NAME } from "@acme/config/constants";
import { useExtWidgets } from "@acme/ext-kit/react";
import { Button } from "@acme/ui-native/button";
import { Text } from "@acme/ui-native/text";

/**
 * Fallback menu while the CMS-driven one (useNavMenu → nav-items collection)
 * is loading or unreachable — mirrors the host's core nav defaults.
 */
const FALLBACK_MENU: NavMenuEntry[] = [
  { key: "core:/content/posts", label: "Posts", href: "/content/posts" },
  { key: "ext:chat:/x/chat", label: "Chat", href: "/x/chat" },
  {
    key: "ext:reminders:/x/reminders",
    label: "Reminders",
    href: "/x/reminders",
  },
  {
    key: "ext:notifications:/x/notifications",
    label: "Notifications",
    href: "/x/notifications",
  },
  { key: "ext:billing:/x/billing", label: "Pricing", href: "/x/billing" },
  { key: "core:/profile", label: "Profile", href: "/profile" },
];

export function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const widgets = useExtWidgets();
  // CMS-driven menu: installed-and-enabled extensions appear automatically;
  // staff renames/reordering/toggles from /admin apply on next fetch.
  const { data: menu } = useNavMenu("native");
  const items = menu && menu.length > 0 ? menu : FALLBACK_MENU;

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="items-center justify-center gap-4 p-6"
    >
      <Stack.Screen options={{ title: APP_NAME }} />
      <Text className="text-4xl font-bold">{APP_NAME}</Text>
      <Text className="text-muted-foreground text-center">
        Signed in as {user?.email}
      </Text>
      {/* Home-screen widgets from installed extensions (host-provided). */}
      {widgets.length > 0 && (
        <View className="w-full gap-2">
          {widgets.map(({ slug, Widget }) => (
            <Widget key={slug} />
          ))}
        </View>
      )}
      {items.map((item, i) => (
        <Button
          key={item.key}
          title={item.label}
          variant={i === 0 ? "default" : "outline"}
          onPress={() => router.push(item.href as Href)}
        />
      ))}
    </ScrollView>
  );
}

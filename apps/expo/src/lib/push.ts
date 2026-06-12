import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import type { AppSupabaseClient } from "@acme/api";

// Show notifications received while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
});

/**
 * Register for Expo push notifications and persist the token to `push_tokens`.
 *
 * IMPORTANT: remote push requires a DEV BUILD or a standalone build — Expo Go
 * cannot receive remote push on Android as of SDK 53+. On simulators/emulators
 * (no physical device) this returns null. See README → "Push notifications".
 */
export async function registerForPushNotifications(
  supabase: AppSupabaseClient,
): Promise<string | null> {
  if (!Device.isDevice) return null;

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return null;

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const pushToken = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = pushToken.data;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("ext_notifications_push_tokens").upsert(
      {
        user_id: user.id,
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
      },
      { onConflict: "user_id,token" },
    );
  }

  return token;
}

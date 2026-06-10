import { View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { useSession } from "@acme/api";
import { APP_NAME } from "@acme/config/constants";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

export default function Home() {
  const router = useRouter();
  const { user } = useSession();

  return (
    <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
      <Stack.Screen options={{ title: APP_NAME }} />
      <Text className="text-4xl font-bold">{APP_NAME}</Text>
      <Text className="text-muted-foreground text-center">
        Signed in as {user?.email}
      </Text>
      <Button
        title="Posts"
        onPress={() => router.push("/content/posts")}
      />
      <Button
        title="Chat"
        variant="outline"
        onPress={() => router.push("/chat")}
      />
      <Button
        title="Reminders"
        variant="outline"
        onPress={() => router.push("/reminders")}
      />
      <Button
        title="Notifications"
        variant="outline"
        onPress={() => router.push("/notifications")}
      />
      <Button
        title="Pricing"
        variant="outline"
        onPress={() => router.push("/pricing")}
      />
      <Button
        title="Profile"
        variant="outline"
        onPress={() => router.push("/profile")}
      />
    </View>
  );
}

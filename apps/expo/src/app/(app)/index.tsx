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
      <Text className="text-4xl font-bold">Meet Dream</Text>
      <Text className="text-muted-foreground text-center">
        Signed in as {user?.email}
      </Text>
      <Button title="Projects" onPress={() => router.push("/projects")} />
      <Button
        title="Chat"
        variant="outline"
        onPress={() => router.push("/chat")}
      />
      <Button
        title="Profile"
        variant="outline"
        onPress={() => router.push("/profile")}
      />
    </View>
  );
}

import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { usePost } from "@acme/app";

import { Text } from "~/components/ui/text";

export default function PostDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const post = usePost(slug);
  const doc = post.data;

  return (
    <ScrollView className="bg-background flex-1">
      <View className="gap-3 p-4">
        <Stack.Screen options={{ title: doc?.title ?? "Post" }} />
        {post.isLoading ? (
          <Text className="text-muted-foreground">Loading…</Text>
        ) : !doc ? (
          <Text className="text-muted-foreground">Not found.</Text>
        ) : (
          <>
            <Text className="text-2xl font-bold">{doc.title}</Text>
            {doc.excerpt ? (
              <Text className="text-muted-foreground">{doc.excerpt}</Text>
            ) : null}
            <Text className="text-muted-foreground text-xs">
              Open the web app to read the full post.
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

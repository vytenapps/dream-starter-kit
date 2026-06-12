import { FlatList, Pressable, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { usePosts } from "@acme/app";
import { Text } from "@acme/ui-native/text";

export default function PostsList() {
  const router = useRouter();
  const posts = usePosts();

  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: "Posts" }} />
      <FlatList
        data={posts.data ?? []}
        keyExtractor={(post) => String(post.id)}
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {posts.isLoading ? "Loading…" : "No posts yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            className="border-border border-b py-3"
            onPress={() => router.push(`/content/posts/${item.slug}`)}
          >
            <Text className="text-base font-medium">{item.title}</Text>
            {item.excerpt ? (
              <Text className="text-muted-foreground text-sm">
                {item.excerpt}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

import { FlatList, Pressable, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { useArticles } from "@acme/app";

import { Text } from "~/components/ui/text";

export default function ArticlesList() {
  const router = useRouter();
  const articles = useArticles();

  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: "Articles" }} />
      <FlatList
        data={articles.data ?? []}
        keyExtractor={(article) => String(article.id)}
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {articles.isLoading ? "Loading…" : "No articles yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            className="border-border border-b py-3"
            onPress={() => router.push(`/content/articles/${item.slug}`)}
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

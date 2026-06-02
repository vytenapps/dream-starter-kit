import { Alert, FlatList, Pressable, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import type { CreateItemInput, ItemStatus } from "@acme/app";
import {
  createItemSchema,
  useCreateItem,
  useDeleteItem,
  useItems,
  useProject,
  useUpdateItem,
} from "@acme/app";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

// Tapping the status cycles through the lifecycle (no native Select needed).
const NEXT_STATUS: Record<ItemStatus, ItemStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  const items = useItems(id);
  const createItem = useCreateItem(id);
  const updateItem = useUpdateItem(id);
  const deleteItem = useDeleteItem(id);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateItemInput>({
    resolver: standardSchemaResolver(createItemSchema),
    defaultValues: { title: "", status: "open" },
  });

  async function onCreate(values: CreateItemInput) {
    try {
      await createItem.mutateAsync(values);
      reset({ title: "", status: "open" });
    } catch (e) {
      Alert.alert("Error", msg(e));
    }
  }

  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: project.data?.name ?? "Project" }} />
      <View className="flex-row gap-2">
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              className="flex-1"
              placeholder="New item"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        <Button
          title="Add"
          loading={createItem.isPending}
          onPress={() => void handleSubmit(onCreate)()}
        />
      </View>
      {errors.title && (
        <Text className="text-destructive text-sm">{errors.title.message}</Text>
      )}
      <FlatList
        data={items.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {items.isLoading ? "Loading…" : "No items yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <View className="border-border flex-row items-center justify-between border-b py-3">
            <Text className="flex-1 text-base">{item.title}</Text>
            <Pressable
              onPress={() =>
                void updateItem.mutateAsync({
                  id: item.id,
                  status: NEXT_STATUS[item.status as ItemStatus],
                })
              }
              className="bg-muted mr-2 rounded px-2 py-1"
            >
              <Text className="text-xs">{item.status}</Text>
            </Pressable>
            <Button
              title="Delete"
              variant="ghost"
              onPress={() => void deleteItem.mutateAsync(item.id)}
            />
          </View>
        )}
      />
    </View>
  );
}

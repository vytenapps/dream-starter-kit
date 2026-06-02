import { Alert, FlatList, Pressable, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import type { CreateProjectInput } from "@acme/app";
import {
  createProjectSchema,
  useCreateProject,
  useDeleteProject,
  useProjects,
} from "@acme/app";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function Projects() {
  const router = useRouter();
  const projects = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: standardSchemaResolver(createProjectSchema),
    defaultValues: { name: "" },
  });

  async function onCreate(values: CreateProjectInput) {
    try {
      await createProject.mutateAsync(values);
      reset({ name: "" });
    } catch (e) {
      Alert.alert("Error", msg(e));
    }
  }

  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: "Projects" }} />
      <View className="flex-row gap-2">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              className="flex-1"
              placeholder="New project"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        <Button
          title="Add"
          loading={createProject.isPending}
          onPress={() => void handleSubmit(onCreate)()}
        />
      </View>
      {errors.name && (
        <Text className="text-destructive text-sm">{errors.name.message}</Text>
      )}
      <FlatList
        data={projects.data ?? []}
        keyExtractor={(project) => project.id}
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {projects.isLoading ? "Loading…" : "No projects yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <View className="border-border flex-row items-center justify-between border-b py-3">
            <Pressable
              className="flex-1"
              onPress={() => router.push(`/projects/${item.id}`)}
            >
              <Text className="text-base">{item.name}</Text>
            </Pressable>
            <Button
              title="Delete"
              variant="ghost"
              onPress={() => void deleteProject.mutateAsync(item.id)}
            />
          </View>
        )}
      />
    </View>
  );
}

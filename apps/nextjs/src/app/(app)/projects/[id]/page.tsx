"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

import type { CreateItemInput, ItemStatus } from "@acme/app";
import {
  createItemSchema,
  ITEM_STATUSES,
  useCreateItem,
  useDeleteItem,
  useItems,
  useProject,
  useUpdateItem,
} from "@acme/app";
import { toast } from "@acme/ui/toast";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const project = useProject(id);
  const items = useItems(id);
  const createItem = useCreateItem(id);
  const updateItem = useUpdateItem(id);
  const deleteItem = useDeleteItem(id);

  const {
    register,
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
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add item");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <Link href="/projects" className="text-muted-foreground text-sm">
        ← Projects
      </Link>
      <h1 className="text-2xl font-semibold">
        {project.data?.name ?? "Project"}
      </h1>

      <form
        onSubmit={(e) => void handleSubmit(onCreate)(e)}
        className="flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <Input placeholder="New item title" {...register("title")} />
          <Button type="submit" disabled={createItem.isPending}>
            {createItem.isPending ? "Adding…" : "Add item"}
          </Button>
        </div>
        {errors.title && (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        )}
      </form>

      {items.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.data && items.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.data.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-md border p-3"
            >
              <span className="flex-1">{item.title}</span>
              <Select
                value={item.status}
                onValueChange={(value) =>
                  void updateItem.mutateAsync({
                    id: item.id,
                    status: value as ItemStatus,
                  })
                }
              >
                <SelectTrigger className="w-36" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void deleteItem.mutateAsync(item.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No items yet — add one above.</p>
      )}
    </main>
  );
}

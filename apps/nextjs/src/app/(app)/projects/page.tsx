"use client";

import Link from "next/link";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

import type { CreateProjectInput } from "@acme/app";
import {
  createProjectSchema,
  useCreateProject,
  useDeleteProject,
  useProjects,
} from "@acme/app";
import { toast } from "@acme/ui/toast";

import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

export default function ProjectsPage() {
  const projects = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const {
    register,
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
      reset();
      toast.success("Project created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create project");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this project and all its items?")) return;
    try {
      await deleteProject.mutateAsync(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Projects</h1>

      <form
        onSubmit={(e) => void handleSubmit(onCreate)(e)}
        className="flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <Input placeholder="New project name" {...register("name")} />
          <Button type="submit" disabled={createProject.isPending}>
            {createProject.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </form>

      {projects.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : projects.data && projects.data.length > 0 ? (
        <ul className="grid gap-3">
          {projects.data.map((project) => (
            <li key={project.id}>
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    <Link
                      href={`/projects/${project.id}`}
                      className="hover:underline"
                    >
                      {project.name}
                    </Link>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDelete(project.id)}
                  >
                    Delete
                  </Button>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          No projects yet — create one above.
        </p>
      )}
    </main>
  );
}

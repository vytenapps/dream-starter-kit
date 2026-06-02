import { z } from "zod/v4";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

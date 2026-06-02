/**
 * @acme/app — shared, cross-platform feature logic (validators, auth actions,
 * data hooks). UI stays per-platform in apps/*; the logic lives here so web and
 * native share one implementation.
 */

export * from "./validators/auth";
export * from "./validators/project";
export * from "./validators/item";
export * from "./auth";
export { useProfile, useUpdateProfile } from "./hooks/use-profile";
export { useDeleteAccount } from "./hooks/use-delete-account";
export {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "./hooks/use-projects";
export {
  useItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from "./hooks/use-items";

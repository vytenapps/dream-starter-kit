/**
 * @acme/app — shared, cross-platform feature logic (validators, auth actions,
 * data hooks). UI stays per-platform in apps/*; the logic lives here so web and
 * native share one implementation.
 */

export * from "./validators/auth";
export * from "./validators/tag";
export * from "./auth";
export * from "./hooks/use-content";
export { useProfile, useUpdateProfile } from "./hooks/use-profile";
export { useDeleteAccount } from "./hooks/use-delete-account";
export { useUserTags } from "./hooks/use-tags";
export type { UserTag } from "./hooks/use-tags";
export { useNavMenu } from "./hooks/use-nav-menu";
export type { NavMenuEntry } from "./hooks/use-nav-menu";

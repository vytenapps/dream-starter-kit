/**
 * @acme/app — shared, cross-platform feature logic (validators, auth actions,
 * data hooks). UI stays per-platform in apps/*; the logic lives here so web and
 * native share one implementation.
 */

export * from "./validators/auth";
export * from "./auth";
export { useProfile, useUpdateProfile } from "./hooks/use-profile";
export { useDeleteAccount } from "./hooks/use-delete-account";

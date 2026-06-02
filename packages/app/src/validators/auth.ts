import { z } from "zod/v4";

export const emailSchema = z.email("Enter a valid email");
export const passwordSchema = z.string().min(8, "Use at least 8 characters");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().min(1, "Name is required").max(80).optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const magicLinkSchema = z.object({ email: emailSchema });
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().min(1, "Name is required").max(80),
  avatarUrl: z.union([z.url("Enter a valid URL"), z.literal("")]).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

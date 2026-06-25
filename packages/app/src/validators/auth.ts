import { z } from "zod/v4";

export const emailSchema = z.email("Enter a valid email");

/** Default minimum password length, mirrored by the auth-settings global. */
export const DEFAULT_MIN_PASSWORD_LENGTH = 8;

/** Password schema for a given minimum length (driven by the auth-settings global). */
export const makePasswordSchema = (min: number = DEFAULT_MIN_PASSWORD_LENGTH) =>
  z.string().min(min, `Use at least ${min} characters`);

export const passwordSchema = makePasswordSchema();

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Sign-up schema, parameterized by the front-end auth-settings global's minimum
 * password length. Terms acceptance + email-domain rules are enforced in the UI
 * (they depend on runtime settings, not a static schema). The static
 * {@link signUpSchema} below is the default (8 chars) kept for back-compat.
 */
export const makeSignUpSchema = ({
  minPasswordLength = DEFAULT_MIN_PASSWORD_LENGTH,
}: { minPasswordLength?: number } = {}) =>
  z.object({
    email: emailSchema,
    password: makePasswordSchema(minPasswordLength),
    displayName: z.string().min(1, "Name is required").max(80).optional(),
  });

export const signUpSchema = makeSignUpSchema();
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

import type { GlobalConfig } from "payload";

import { anyone, isStaff } from "../access";

/**
 * Front-end authentication configuration (System → Authentication). Staff pick a
 * default sign-in method and toggle which methods the sign-up / sign-in /
 * forgot-password UIs offer, plus sign-up access rules, password strength, copy,
 * and SAML SSO routing.
 *
 * IMPORTANT — this is a PRESENTATION + CLIENT-LOGIC layer, not the source of
 * truth for what auth actually works. Supabase's GoTrue server (config.toml /
 * the hosted dashboard) is what truly enables a provider, signup, captcha or
 * SAML; our app reads this global at request time to decide which UI to render
 * and which client-side rules to apply. Each method that needs a matching
 * Supabase setting carries an inline note linking to docs/AUTH.md. We do NOT
 * call the Supabase Management API.
 *
 * Read access is `anyone` (the public sign-in pages and the mobile
 * /api/auth/config endpoint must read it; it holds no secrets); updates are
 * staff-only. Read server-side via `getAuthSettings()` in lib/payload.ts.
 */

/** Where the inline admin notes link for per-method Supabase prerequisites. */
const DOCS_AUTH =
  "https://github.com/vytenapps/dream-starter-kit/blob/main/docs/AUTH.md";

export const AuthenticationSettings: GlobalConfig = {
  slug: "authentication-settings",
  label: "Authentication",
  admin: {
    group: "System",
    description:
      "Choose the default sign-in method and which methods the auth screens " +
      "offer, plus sign-up access rules and copy. This controls the UI and " +
      "client logic only — each method must also be enabled in Supabase. " +
      `Setup guide: ${DOCS_AUTH}`,
  },
  access: { read: anyone, update: isStaff },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Methods",
          description:
            "Drag to reorder and toggle the methods the sign-in / sign-up " +
            "screens offer. The FIRST enabled method is the primary " +
            "call-to-action (the filled button); the rest appear below it. The " +
            "three email methods (password / magic link / code) collapse into a " +
            "single “Continue with email” button positioned at the " +
            "first enabled one. Per-method Supabase prerequisites: " +
            `${DOCS_AUTH}.`,
          fields: [
            {
              name: "loginMethods",
              type: "array",
              labels: { singular: "Method", plural: "Login methods" },
              // Mirrors DEFAULT_LOGIN_METHODS in @acme/app (auth-settings.ts).
              defaultValue: [
                { method: "password", enabled: true },
                { method: "magicLink", enabled: true },
                { method: "emailOtp", enabled: true },
                { method: "google", enabled: false },
                { method: "apple", enabled: false },
                { method: "sso", enabled: false },
              ],
              admin: {
                description:
                  "Drag the handle to reorder. Toggle Enabled to show/hide. " +
                  "Google/Apple need the provider enabled in Supabase; SAML SSO " +
                  "needs [auth.sso] + a registered identity provider.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "method",
                      type: "select",
                      required: true,
                      options: [
                        { label: "Email + password", value: "password" },
                        { label: "Magic link", value: "magicLink" },
                        { label: "Email code (OTP)", value: "emailOtp" },
                        { label: "Google", value: "google" },
                        { label: "Apple", value: "apple" },
                        { label: "SAML 2.0 SSO", value: "sso" },
                      ],
                      admin: { width: "60%" },
                    },
                    {
                      name: "enabled",
                      type: "checkbox",
                      defaultValue: false,
                      admin: { width: "40%" },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Sign-up & access",
          fields: [
            {
              name: "allowSignups",
              type: "checkbox",
              defaultValue: true,
              admin: {
                description:
                  "When off, public sign-up is hidden and the sign-up route is " +
                  "blocked (invite-only). For hard server enforcement also set " +
                  `enable_signup = false in Supabase — see ${DOCS_AUTH}#invite-only.`,
              },
            },
            {
              name: "emailDomainMode",
              type: "select",
              defaultValue: "off",
              options: [
                { label: "No restriction", value: "off" },
                { label: "Allow only these domains", value: "allowlist" },
                { label: "Block these domains", value: "blocklist" },
              ],
              admin: {
                description:
                  "Restrict which email domains may sign up (checked client-" +
                  "side and in the sign-up/checkout server route).",
              },
            },
            {
              name: "emailDomains",
              type: "array",
              labels: { singular: "Domain", plural: "Domains" },
              admin: {
                condition: (data) => data.emailDomainMode !== "off",
                description: "Bare domains, e.g. acme.com (no @ or scheme).",
              },
              fields: [
                {
                  name: "domain",
                  type: "text",
                  required: true,
                  admin: { placeholder: "acme.com" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "termsUrl",
                  type: "text",
                  defaultValue: "/terms",
                  admin: {
                    width: "50%",
                    description: "Terms of Service link in the sign-up footer.",
                  },
                },
                {
                  name: "privacyUrl",
                  type: "text",
                  defaultValue: "/privacy",
                  admin: {
                    width: "50%",
                    description: "Privacy Policy link in the sign-up footer.",
                  },
                },
              ],
            },
            {
              name: "requireTermsAcceptance",
              type: "checkbox",
              defaultValue: false,
              admin: {
                description:
                  "Require an explicit 'I agree' checkbox before sign-up.",
              },
            },
            {
              type: "row",
              fields: [
                {
                  name: "postLoginRedirect",
                  type: "text",
                  admin: {
                    width: "50%",
                    description:
                      "Where users land after login. Blank keeps the default " +
                      "role-based routing (/welcome → /a or the CMS).",
                  },
                },
                {
                  name: "postSignupRedirect",
                  type: "text",
                  admin: {
                    width: "50%",
                    description:
                      "Where users land right after sign-up. Blank keeps the " +
                      "default (/welcome).",
                  },
                },
              ],
            },
          ],
        },
        {
          label: "Security",
          fields: [
            {
              name: "minPasswordLength",
              type: "number",
              defaultValue: 8,
              min: 6,
              max: 72,
              admin: {
                step: 1,
                description:
                  "Minimum password length enforced in the UI. Must be ≥ " +
                  "Supabase's server-side minimum_password_length to be " +
                  `enforced end-to-end — see ${DOCS_AUTH}#passwords.`,
              },
            },
            {
              name: "requireCaptcha",
              type: "checkbox",
              defaultValue: false,
              label: "Require Cloudflare Turnstile",
              admin: {
                description:
                  "Require a Turnstile token on auth actions. Needs the site " +
                  "key configured and Supabase [auth.captcha] enabled — see " +
                  `${DOCS_AUTH}#captcha and docs/TURNSTILE.md.`,
              },
            },
          ],
        },
        {
          label: "Appearance",
          fields: [
            {
              name: "signInHeading",
              type: "text",
              admin: {
                description:
                  "Heading on the sign-in screen. Blank uses the app name.",
              },
            },
            {
              name: "signUpHeading",
              type: "text",
              admin: {
                description:
                  "Heading on the sign-up screen. Blank uses the app name.",
              },
            },
            {
              name: "subtitle",
              type: "text",
              admin: {
                description: "Optional subtitle shown under the heading.",
              },
            },
          ],
        },
        {
          label: "SSO",
          description:
            "SAML 2.0 single sign-on. This screen only surfaces the entry " +
            "point and routes by email domain — SAML must be enabled in " +
            `Supabase and the identity provider registered. See ${DOCS_AUTH}#sso.`,
          fields: [
            {
              name: "ssoButtonLabel",
              type: "text",
              defaultValue: "Continue with SAML SSO",
            },
            {
              name: "ssoDomains",
              type: "array",
              labels: { singular: "SSO domain", plural: "SSO domains" },
              admin: {
                description:
                  "Map email domains to a registered Supabase SSO provider. " +
                  "A user entering an email on one of these domains is routed " +
                  "to that identity provider. Leave providerId blank to let " +
                  "Supabase resolve the provider by domain.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "domain",
                      type: "text",
                      required: true,
                      admin: { width: "50%", placeholder: "acme.com" },
                    },
                    {
                      name: "providerId",
                      type: "text",
                      admin: {
                        width: "50%",
                        placeholder: "(optional Supabase SSO provider UUID)",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

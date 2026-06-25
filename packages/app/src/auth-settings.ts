/**
 * Cross-platform shape + helpers for the front-end authentication config that
 * staff edit in the Payload `authentication-settings` global (System →
 * Authentication). The web RSC pages read it via the Local API
 * (`getAuthSettings()` in apps/nextjs/src/lib/payload.ts); the Expo app reads
 * the same data over the public `/api/auth/config` endpoint (see
 * `useAuthConfig`). Both feed the normalized {@link AuthSettings} below into the
 * shared UI logic so web and native render the same methods in the same order.
 *
 * This is a PRESENTATION layer: it decides which methods/forms render, in what
 * order, and which client-side rules apply. Supabase's GoTrue server is still
 * the source of truth for what auth actually works (see docs/AUTH.md).
 */

export type AuthMethod =
  | "password"
  | "magicLink"
  | "emailOtp"
  | "google"
  | "apple"
  | "sso";

/** Canonical method set + the order used to backfill any methods a config omits. */
export const AUTH_METHOD_ORDER: readonly AuthMethod[] = [
  "password",
  "magicLink",
  "emailOtp",
  "google",
  "apple",
  "sso",
];

/** The email-based methods, which collapse into one "Continue with email" entry. */
export const EMAIL_METHODS: readonly AuthMethod[] = [
  "password",
  "magicLink",
  "emailOtp",
];

/** One row of the staff-orderable login-method list (drag to reorder, toggle on/off). */
export interface LoginMethodRow {
  method: AuthMethod;
  enabled: boolean;
}

/**
 * The kit's out-of-the-box method order + enablement (mirrors the global
 * default). Magic link leads, so the default sign-in flow sends a magic link
 * ("check your email") and email-code is the manual fallback; password stays
 * enabled (reachable via "Use password instead" / used for sign-up).
 */
export const DEFAULT_LOGIN_METHODS: LoginMethodRow[] = [
  { method: "magicLink", enabled: true },
  { method: "emailOtp", enabled: true },
  { method: "password", enabled: true },
  { method: "google", enabled: false },
  { method: "apple", enabled: false },
  { method: "sso", enabled: false },
];

export type EmailDomainMode = "off" | "allowlist" | "blocklist";

export interface SsoDomain {
  domain: string;
  providerId: string | null;
}

/** Top-level chooser buttons (the three email methods collapse into "email"). */
export type ChooserEntry = "email" | "google" | "apple" | "sso";

/** Normalized, fully-defaulted auth config consumed by the UI on both platforms. */
export interface AuthSettings {
  /** Full, deduped, ordered method list (every method present exactly once). */
  loginMethods: LoginMethodRow[];
  /** Enabled methods in the configured order; the first is the primary CTA. */
  orderedMethods: AuthMethod[];
  /** Convenience lookup of enablement by method. */
  methods: Record<AuthMethod, boolean>;
  allowSignups: boolean;
  emailDomainMode: EmailDomainMode;
  emailDomains: string[];
  termsUrl: string;
  privacyUrl: string;
  requireTermsAcceptance: boolean;
  /** Blank/null keeps the app's default role-based routing. */
  postLoginRedirect: string | null;
  postSignupRedirect: string | null;
  minPasswordLength: number;
  requireCaptcha: boolean;
  signInHeading: string | null;
  signUpHeading: string | null;
  subtitle: string | null;
  ssoButtonLabel: string;
  ssoDomains: SsoDomain[];
}

const recordFromRows = (rows: LoginMethodRow[]): Record<AuthMethod, boolean> => {
  const rec: Record<AuthMethod, boolean> = {
    password: false,
    magicLink: false,
    emailOtp: false,
    google: false,
    apple: false,
    sso: false,
  };
  for (const r of rows) rec[r.method] = r.enabled;
  return rec;
};

/** Defaults that mirror the global's field defaults and the kit's prior behavior. */
export const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  loginMethods: DEFAULT_LOGIN_METHODS,
  orderedMethods: DEFAULT_LOGIN_METHODS.filter((r) => r.enabled).map(
    (r) => r.method,
  ),
  methods: recordFromRows(DEFAULT_LOGIN_METHODS),
  allowSignups: true,
  emailDomainMode: "off",
  emailDomains: [],
  termsUrl: "/terms",
  privacyUrl: "/privacy",
  requireTermsAcceptance: false,
  postLoginRedirect: null,
  postSignupRedirect: null,
  minPasswordLength: 8,
  requireCaptcha: false,
  signInHeading: null,
  signUpHeading: null,
  subtitle: null,
  ssoButtonLabel: "Continue with SAML SSO",
  ssoDomains: [],
};

// The raw Payload global is loosely typed (every field nullable/optional). These
// helpers coerce defensively so callers always get a complete AuthSettings.
type Raw = Record<string, unknown>;
const asRaw = (v: unknown): Raw =>
  v && typeof v === "object" ? (v as Raw) : {};

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim().length > 0 ? v : fallback;

const optStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const isMethod = (v: unknown): v is AuthMethod =>
  typeof v === "string" && (AUTH_METHOD_ORDER as readonly string[]).includes(v);

/** Read + normalize the orderable `loginMethods` array: dedupe, then backfill any
 * missing methods (disabled) so the list always contains all methods once. */
function normalizeMethods(raw: Raw): LoginMethodRow[] {
  const rowsIn = Array.isArray(raw.loginMethods)
    ? raw.loginMethods.map(asRaw)
    : [];
  if (rowsIn.length === 0) return DEFAULT_LOGIN_METHODS;

  const seen = new Set<AuthMethod>();
  const out: LoginMethodRow[] = [];
  for (const row of rowsIn) {
    if (!isMethod(row.method) || seen.has(row.method)) continue;
    seen.add(row.method);
    out.push({ method: row.method, enabled: bool(row.enabled, false) });
  }
  // Any method the admin removed entirely is backfilled as disabled.
  for (const method of AUTH_METHOD_ORDER) {
    if (!seen.has(method)) out.push({ method, enabled: false });
  }
  return out;
}

/**
 * Coerce the raw `authentication-settings` global (or the JSON returned by
 * `/api/auth/config`) into a complete {@link AuthSettings}. Idempotent — running
 * it on already-normalized data returns an equivalent value. Unknown/missing
 * fields fall back to {@link DEFAULT_AUTH_SETTINGS}.
 */
export function normalizeAuthSettings(input: unknown): AuthSettings {
  const raw = asRaw(input);
  const d = DEFAULT_AUTH_SETTINGS;

  const loginMethods = normalizeMethods(raw);
  const orderedMethods = loginMethods
    .filter((r) => r.enabled)
    .map((r) => r.method);

  const mode = ((): EmailDomainMode => {
    const v = raw.emailDomainMode;
    return v === "allowlist" || v === "blocklist" || v === "off"
      ? v
      : d.emailDomainMode;
  })();

  const domains = Array.isArray(raw.emailDomains)
    ? raw.emailDomains
        .map((row) =>
          typeof row === "string" ? row : (optStr(asRaw(row).domain) ?? ""),
        )
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0)
    : d.emailDomains;

  const ssoDomains: SsoDomain[] = Array.isArray(raw.ssoDomains)
    ? raw.ssoDomains
        .map((row) => asRaw(row))
        .map((row) => ({
          domain: (optStr(row.domain) ?? "").toLowerCase(),
          providerId: optStr(row.providerId),
        }))
        .filter((row) => row.domain.length > 0)
    : d.ssoDomains;

  return {
    loginMethods,
    orderedMethods,
    methods: recordFromRows(loginMethods),
    allowSignups: bool(raw.allowSignups, d.allowSignups),
    emailDomainMode: mode,
    emailDomains: domains,
    termsUrl: str(raw.termsUrl, d.termsUrl),
    privacyUrl: str(raw.privacyUrl, d.privacyUrl),
    requireTermsAcceptance: bool(
      raw.requireTermsAcceptance,
      d.requireTermsAcceptance,
    ),
    postLoginRedirect: optStr(raw.postLoginRedirect),
    postSignupRedirect: optStr(raw.postSignupRedirect),
    minPasswordLength: Math.min(
      72,
      Math.max(6, num(raw.minPasswordLength, d.minPasswordLength)),
    ),
    requireCaptcha: bool(raw.requireCaptcha, d.requireCaptcha),
    signInHeading: optStr(raw.signInHeading),
    signUpHeading: optStr(raw.signUpHeading),
    subtitle: optStr(raw.subtitle),
    ssoButtonLabel: str(raw.ssoButtonLabel, d.ssoButtonLabel),
    ssoDomains,
  };
}

/** Enabled methods in the configured order (the first is the primary CTA). */
export function enabledMethodsInOrder(s: AuthSettings): AuthMethod[] {
  return s.orderedMethods;
}

/** The effective primary method: the first enabled one in the configured order. */
export function resolveDefaultMethod(s: AuthSettings): AuthMethod | null {
  return s.orderedMethods[0] ?? null;
}

/**
 * Top-level chooser buttons in order, collapsing the three email methods into a
 * single "email" entry at the position of the first enabled email method.
 */
export function chooserEntries(s: AuthSettings): ChooserEntry[] {
  const out: ChooserEntry[] = [];
  let emailAdded = false;
  for (const method of s.orderedMethods) {
    if (EMAIL_METHODS.includes(method)) {
      if (!emailAdded) {
        out.push("email");
        emailAdded = true;
      }
    } else {
      out.push(method as "google" | "apple" | "sso");
    }
  }
  return out;
}

/**
 * True when `email` is permitted by the domain allow/block rules. An off mode or
 * empty list permits everything; malformed emails are left for the email schema.
 */
export function isEmailDomainAllowed(email: string, s: AuthSettings): boolean {
  if (s.emailDomainMode === "off" || s.emailDomains.length === 0) return true;
  const at = email.lastIndexOf("@");
  if (at < 0) return true;
  const domain = email.slice(at + 1).trim().toLowerCase();
  const match = s.emailDomains.includes(domain);
  return s.emailDomainMode === "allowlist" ? match : !match;
}

/** The SSO provider params for an email, if its domain maps to a configured provider. */
export function ssoParamsForEmail(
  email: string,
  s: AuthSettings,
): { domain?: string; providerId?: string } | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  const entry = s.ssoDomains.find((row) => row.domain === domain);
  if (!entry) return null;
  return entry.providerId
    ? { providerId: entry.providerId }
    : { domain: entry.domain };
}

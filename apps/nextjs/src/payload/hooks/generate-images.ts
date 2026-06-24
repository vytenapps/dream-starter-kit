import type {
  CollectionBeforeChangeHook,
  Payload,
  PayloadRequest,
} from "payload";

import {
  DEFAULT_IMAGE_AUDIT_MAX_ATTEMPTS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SYSTEM_PROMPT,
  IMAGE_GENERATION_MAX_FORMATS,
  isAiGatewayConfigured,
} from "@acme/config";

import type {
  GeneratedImage,
  ImageFormatSpec,
  ResolvedAuditSettings,
} from "../../lib/image-formats";
import { env } from "../../env";
import { isS3Configured } from "../../lib/s3-config";

// NOTE: the actual renderer (lib/image-generation) imports `ai` + `sharp` behind
// `import "server-only"`. It is loaded LAZILY (dynamic import inside the hook) so
// the Payload CLI (generate:types / migrate:create), which loads payload.config
// but never runs hooks, never resolves the server-only module. It executes only
// at runtime in the Next server.

/**
 * Generic image-generation hooks for any Payload collection. A collection opts
 * in with one line of fields (generatedImageFields) + a two-hook beforeChange
 * array: `[generateImagesHook(cfg), syncImageUrls(cfg)]` — generation FIRST so
 * the URL-sync hook in the same array sees the newly-attached media.
 *
 * Design decisions ported from the verified reference implementation — do not
 * regress (see the task brief): beforeChange (not afterChange) so it triggers
 * off incoming `data[promptField]`, ids land in `data` for the sync hook, no
 * second write / no recursion; per-format isolation (one failure never discards
 * the others, nothing throws — the underlying write still commits); the
 * S3-configured guard runs FIRST so a misconfigured deploy wastes zero gateway
 * spend; "fill missing slots" semantics (clear a slot to regenerate it).
 *
 * Inline execution: generation runs inline in the originating request (the MCP
 * and cms-api route handlers raise maxDuration to match). Seam: if a Payload
 * Jobs Queue is wired up, move the per-format body into a task.
 */

export interface GeneratedImagesConfig {
  /** The image formats this collection fills (e.g. FEATURED_FORMATS). */
  formats: readonly ImageFormatSpec[];
  /** Textarea field holding the prompt. Default "imagePrompt". */
  promptField?: string;
  /** Shared alt-text field. Default "imageAlt". */
  altField?: string;
}

const DEFAULT_PROMPT_FIELD = "imagePrompt";
const DEFAULT_ALT_FIELD = "imageAlt";

/** Cache-column name for a format field's resolved public URL. */
export const urlCacheField = (field: string): string => `${field}Url`;

/** Trim a (possibly null) value; undefined when blank, so `??` chains through. */
function nonEmpty(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface ResolvedImageSettings {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  /** Post-generation audit configuration (resolved from the global). */
  audit: ResolvedAuditSettings;
}

/**
 * Resolve image-generation settings: global → env → code default. Reads the
 * `image-generation-settings` global (overrideAccess — this is server config,
 * not a user-facing read); falls back to env then @acme/config defaults.
 */
export async function resolveImageGenerationSettings(
  payload: Payload,
  req?: PayloadRequest,
): Promise<ResolvedImageSettings> {
  let global:
    | {
        enabled?: boolean | null;
        model?: string | null;
        systemPrompt?: string | null;
        auditEnabled?: boolean | null;
        auditMaxAttempts?: number | null;
        auditModel?: string | null;
        auditInstructions?: string | null;
        auditFailureAction?: string | null;
      }
    | undefined;
  try {
    global = (await payload.findGlobal({
      slug: "image-generation-settings",
      overrideAccess: true,
      ...(req ? { req } : {}),
    })) as typeof global;
  } catch {
    global = undefined;
  }

  const enabled = global?.enabled ?? true;
  const model =
    nonEmpty(global?.model) ??
    nonEmpty(env.IMAGE_GENERATION_MODEL) ??
    DEFAULT_IMAGE_MODEL;
  const systemPrompt =
    nonEmpty(global?.systemPrompt) ??
    nonEmpty(env.IMAGE_GENERATION_SYSTEM_PROMPT) ??
    DEFAULT_IMAGE_SYSTEM_PROMPT;

  const audit: ResolvedAuditSettings = {
    enabled: global?.auditEnabled === true,
    maxAttempts:
      typeof global?.auditMaxAttempts === "number" &&
      Number.isFinite(global.auditMaxAttempts) &&
      global.auditMaxAttempts >= 1
        ? Math.floor(global.auditMaxAttempts)
        : DEFAULT_IMAGE_AUDIT_MAX_ATTEMPTS,
    model: nonEmpty(global?.auditModel),
    instructions: nonEmpty(global?.auditInstructions),
    failureAction: global?.auditFailureAction === "skip" ? "skip" : "publish",
  };

  return { enabled, model, systemPrompt, audit };
}

/** Is a slot empty (no value in the incoming data nor the existing doc)? */
function slotEmpty(
  field: string,
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
): boolean {
  const value = field in data ? data[field] : originalDoc?.[field];
  return value === undefined || value === null || value === "";
}

/**
 * Create a Media doc from a generated buffer and return its id. Runs with
 * `overrideAccess: true` (a server-side side-effect of an already-authorized
 * write) and passes `req` so it joins the operation's transaction.
 */
export async function createMediaFromBuffer(
  payload: Payload,
  args: {
    data: Buffer;
    filename: string;
    alt: string;
    req?: PayloadRequest;
  },
): Promise<number | string> {
  const doc = await payload.create({
    collection: "media",
    data: { alt: args.alt },
    file: {
      data: args.data,
      mimetype: "image/webp",
      name: args.filename,
      size: args.data.length,
    },
    overrideAccess: true,
    ...(args.req ? { req: args.req } : {}),
  });
  return doc.id;
}

/**
 * Build the beforeChange hook that fills a collection's empty image slots from
 * `data[promptField]`. Returns the (possibly-mutated) data; never throws.
 */
export function generateImagesHook(
  config: GeneratedImagesConfig,
): CollectionBeforeChangeHook {
  const promptField = config.promptField ?? DEFAULT_PROMPT_FIELD;
  const altField = config.altField ?? DEFAULT_ALT_FIELD;
  // Cost guardrail (golden rule #6): never render more than the cap per write.
  const formats = config.formats.slice(0, IMAGE_GENERATION_MAX_FORMATS);

  return async ({ data, originalDoc, req, collection }) => {
    // Payload types `data`/`originalDoc` loosely; work through typed records.
    const doc = data as Record<string, unknown>;
    const orig = originalDoc as Record<string, unknown> | undefined;
    const slug = collection.slug;
    const prompt =
      typeof doc[promptField] === "string" ? doc[promptField].trim() : "";
    if (!prompt) return data;

    // Opt-out (mirrors billing's skipStripeSync): the seed sets this so demo
    // content stays scalar-only and spends zero gateway budget on first boot.
    if (req.context.skipImageGeneration === true) return data;

    const missing = formats.filter((f) => slotEmpty(f.field, doc, orig));
    if (missing.length === 0) return data;

    const log = req.payload.logger;

    // Guard #1 (FIRST): storage must be configured, else the upload throws a
    // cryptic AWS error only AFTER the gateway billed for every image.
    if (!isS3Configured()) {
      log.warn(
        `[image-generation] ${slug}: S3 storage not configured — skipping ` +
          `generation of ${missing.length} image(s). Set S3 keys or the ` +
          `Supabase env (see lib/s3-config.ts).`,
      );
      return data;
    }
    // Guard #2: the AI Gateway must be reachable.
    if (!isAiGatewayConfigured()) {
      log.warn(
        `[image-generation] ${slug}: AI Gateway not configured ` +
          `(AI_GATEWAY_API_KEY / Vercel OIDC) — skipping generation.`,
      );
      return data;
    }

    const settings = await resolveImageGenerationSettings(req.payload, req);
    // Guard #3: kill switch.
    if (!settings.enabled) {
      log.info(
        `[image-generation] ${slug}: disabled via image-generation-settings — skipping.`,
      );
      return data;
    }

    const altValue =
      typeof doc[altField] === "string" ? doc[altField].trim() : "";
    const alt = altValue.length > 0 ? altValue : prompt;

    // Lazy server-only renderer (keeps `ai`/`sharp`/server-only out of the
    // Payload CLI's config-load graph; see the note at the top of this file).
    const lib = await import("../../lib/image-generation");

    // Per-format isolation: each format generated + attached in its own
    // try/catch; one failure is logged with its cause and never discards
    // formats that succeeded, and nothing throws. When auditing is on, each
    // format runs a generate→audit→regenerate loop (generateAuditedImage); an
    // image that never passes is kept ("publish") or dropped ("skip"), per the
    // global settings.
    await Promise.all(
      missing.map(async (format) => {
        try {
          let image: GeneratedImage;
          if (settings.audit.enabled) {
            const outcome = await lib.generateAuditedImage({
              model: settings.model,
              systemPrompt: settings.systemPrompt,
              subject: prompt,
              format,
              audit: settings.audit,
              onEvent: (message, err) =>
                log.warn(
                  `[image-generation] ${slug}: "${format.key}" ${message}` +
                    (err instanceof Error ? ` — ${err.message}` : ""),
                ),
            });
            if (!outcome.image) {
              // Audit never passed + failure action "skip" → attach nothing.
              log.warn(
                `[image-generation] ${slug}: "${format.key}" audit failed ` +
                  `after ${outcome.attempts} attempt(s) — skipped` +
                  (outcome.reason ? `: ${outcome.reason}` : ""),
              );
              return;
            }
            if (!outcome.passed) {
              // Failure action "publish" → keep the last image, but flag it.
              log.warn(
                `[image-generation] ${slug}: "${format.key}" audit failed ` +
                  `after ${outcome.attempts} attempt(s) — publishing last image` +
                  (outcome.reason ? `: ${outcome.reason}` : ""),
              );
            }
            image = outcome.image;
          } else {
            image = await lib.generateOneImage({
              model: settings.model,
              systemPrompt: settings.systemPrompt,
              subject: prompt,
              format,
            });
          }
          const filename = `${slug}-${format.key}-${Date.now()}.webp`;
          const id = await createMediaFromBuffer(req.payload, {
            data: image.data,
            filename,
            alt,
            req,
          });
          doc[format.field] = id;
        } catch (err) {
          const cause = err instanceof Error ? err.message : String(err);
          log.error(
            `[image-generation] ${slug}: format "${format.key}" failed — ${cause}`,
          );
        }
      }),
    );

    return data;
  };
}

/**
 * Cache each attached image's public URL into its hidden `<field>Url` column so
 * public surfaces (RSC + native) read the URL without populating the relation.
 * Register AFTER generateImagesHook in the same beforeChange array.
 */
export function syncImageUrls(
  config: GeneratedImagesConfig,
): CollectionBeforeChangeHook {
  const formats = config.formats;

  return async ({ data, originalDoc, req }) => {
    const doc = data as Record<string, unknown>;
    const orig = originalDoc as Record<string, unknown> | undefined;
    await Promise.all(
      formats.map(async (format) => {
        const cache = urlCacheField(format.field);
        const value = format.field in doc ? doc[format.field] : undefined;
        // Slot cleared in this write → clear the cache too.
        if (format.field in doc && (value === null || value === "")) {
          doc[cache] = null;
          return;
        }
        // Resolve the id to cache (only when the value is present in this write,
        // or hasn't been cached yet on the existing doc).
        const id = extractId(value ?? orig?.[format.field]);
        if (id === null) return;
        const cached = orig?.[cache];
        const alreadyCached =
          !(format.field in doc) &&
          typeof cached === "string" &&
          cached.length > 0;
        if (alreadyCached) return;
        try {
          const media = await req.payload.findByID({
            collection: "media",
            id,
            depth: 0,
            overrideAccess: true,
            req,
          });
          const url = (media as { url?: string }).url;
          if (typeof url === "string") doc[cache] = url;
        } catch {
          // best-effort cache; never block the write
        }
      }),
    );
    return data;
  };
}

/** Pull a media id out of an upload field value (id or populated doc). */
function extractId(value: unknown): number | string | null {
  if (typeof value === "number" || typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === "number" || typeof id === "string") return id;
  }
  return null;
}

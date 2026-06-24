import type { CollectionSlug } from "payload";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import config from "@payload-config";
import { getPayload } from "payload";

import { env } from "~/env";
import { generateAuditedImage } from "~/lib/image-generation";
import { isS3Configured } from "~/lib/s3-config";
import {
  createMediaFromBuffer,
  resolveImageGenerationSettings,
} from "~/payload/hooks/generate-images";
import { IMAGE_COLLECTIONS } from "~/payload/image-collections";

/**
 * Staff endpoint backing the Image Generation settings "Regenerate all images"
 * control. Authed via the Payload admin session (only staff get one), then
 * re-checked for the editor/admin role.
 *
 * For every image-enabled collection (payload/image-collections.ts) and every
 * doc in it that has an `imagePrompt`, it re-renders that collection's image
 * formats from the CURRENT global settings (model + art-direction prompt, and
 * the post-generation audit when enabled) and swaps in the new media. So after
 * editing the prompt, one click re-renders the whole catalog against it.
 *
 * EFFICIENCY — the slow part (AI Gateway image generation) is decoupled from the
 * DB writes so it can run in parallel WITHOUT holding a connection from the tiny
 * `max: 2` Payload pool (payload.config.ts):
 *   - generation runs with bounded concurrency (DOC_CONCURRENCY docs at once,
 *     each rendering its formats in parallel) and touches no DB;
 *   - the resulting media-create + doc-update writes are SERIALIZED through one
 *     queue, so at most one doc writes at a time (≤1 pooled connection).
 *
 * POST streams newline-delimited JSON progress events (like /api/cms/seed):
 *   { done, total, label }                      one per doc as it completes
 *   { done: total, label: "Done", complete: true, processed, failed }
 * or, before streaming, a JSON error object (401/403/503) the client surfaces.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * How many docs generate concurrently. Each renders its formats in parallel, so
 * this is ~DOC_CONCURRENCY × formats in-flight AI Gateway calls. Generation
 * holds no DB connection, so this is bounded by gateway throughput, not the pool.
 */
const DOC_CONCURRENCY = 4;

/** One doc to regenerate, paired with its collection's format config. */
interface Candidate {
  collectionSlug: string;
  formats: (typeof IMAGE_COLLECTIONS)[number]["config"]["formats"];
  promptField: string;
  altField: string;
  id: string | number;
  prompt: string;
  alt: string;
}

export async function POST() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only content staff (admin/editor) may trigger a bulk regeneration.
  if (!user.roles.some((r) => r === "admin" || r === "editor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Bail early (before streaming) if images can't be stored — otherwise we'd
  // burn AI Gateway spend on images the upload step can't persist. Mirrors the
  // on-save hook's S3 guard.
  if (!isS3Configured(env)) {
    return NextResponse.json(
      {
        error:
          "Image storage is not configured (S3 / Supabase Storage). " +
          "Configure storage and redeploy before regenerating.",
      },
      { status: 503 },
    );
  }

  // Collect every doc, across all image-enabled collections, that has a
  // non-empty prompt to render from. Metadata only (id + prompt + alt).
  const candidates: Candidate[] = [];
  for (const { slug, config } of IMAGE_COLLECTIONS) {
    const promptField = config.promptField ?? "imagePrompt";
    const altField = config.altField ?? "imageAlt";
    let page = 1;
    for (;;) {
      const { docs, hasNextPage } = await payload.find({
        collection: slug as CollectionSlug,
        where: { [promptField]: { exists: true } },
        select: { [promptField]: true, [altField]: true },
        depth: 0,
        limit: 100,
        page,
        overrideAccess: true,
      });
      for (const doc of docs as unknown as Record<string, unknown>[]) {
        const prompt =
          typeof doc[promptField] === "string" ? doc[promptField].trim() : "";
        if (!prompt) continue;
        const altRaw = typeof doc[altField] === "string" ? doc[altField] : "";
        candidates.push({
          collectionSlug: slug,
          formats: config.formats,
          promptField,
          altField,
          id: doc.id as string | number,
          prompt,
          alt: altRaw.trim() || prompt,
        });
      }
      if (!hasNextPage || docs.length === 0) break;
      page += 1;
    }
  }

  // Resolve model + art-direction + audit once (shared with the on-save hook).
  // The explicit button overrides the `enabled` auto-generation kill switch but
  // still honors the post-generation audit settings.
  const { model, systemPrompt, audit } =
    await resolveImageGenerationSettings(payload);

  const total = candidates.length;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      if (total === 0) {
        send({
          done: 0,
          total: 0,
          label: "No content with a prompt to regenerate.",
        });
        send({
          done: 0,
          total: 0,
          label: "Done",
          complete: true,
          processed: 0,
          failed: 0,
        });
        controller.close();
        return;
      }

      let completed = 0;
      let processed = 0;
      let failed = 0;

      // Serialize all DB writes through one queue: at most one doc's
      // media-create + update runs at a time, so we never exceed the tiny pool.
      let writeChain: Promise<void> = Promise.resolve();
      const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
        const run = writeChain.then(fn);
        writeChain = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      };

      const logError = (where: string, c: Candidate, err: unknown) =>
        payload.logger.error(
          {
            err:
              err instanceof Error ? (err.stack ?? err.message) : String(err),
            collection: c.collectionSlug,
            docId: c.id,
          },
          `[regenerate-images] ${where} failed`,
        );

      const processDoc = async (c: Candidate) => {
        // 1. Generate every format IN PARALLEL, each isolated (a gateway/parse
        //    failure in one never discards the others). NO DB connection held.
        //    With auditing on, each format runs a generate→audit→regenerate
        //    loop; an image that never passes is kept ("publish") or dropped
        //    ("skip"), per the global settings.
        const generated = await Promise.all(
          c.formats.map(async (format) => {
            const outcome = await generateAuditedImage({
              model,
              systemPrompt,
              subject: c.prompt,
              format,
              audit,
              onEvent: (message, err) =>
                logError(`${message} (${format.key})`, c, err),
            });
            return outcome.image; // null → skipped (audit "skip" or all attempts failed)
          }),
        );

        // 2. Create the media docs + point the doc's slots at them — SERIALIZED
        //    so DB writes stay within the pool. Setting every slot makes the
        //    on-save hook a no-op (nothing missing); syncImageUrls refreshes the
        //    public *Url cache in the same save.
        const attached = await serialize(async () => {
          const data: Record<string, string | number> = {};
          for (const image of generated) {
            if (!image) continue;
            try {
              data[image.format.field] = await createMediaFromBuffer(payload, {
                data: image.data,
                filename: `${c.collectionSlug}-${c.id}-${image.format.key}.webp`,
                alt: c.alt,
              });
            } catch (err) {
              logError(`media create (${image.format.key})`, c, err);
            }
          }
          if (Object.keys(data).length > 0) {
            await payload.update({
              collection: c.collectionSlug as CollectionSlug,
              id: c.id,
              data: data as never,
              overrideAccess: true,
            });
          }
          return Object.keys(data).length;
        });

        if (attached > 0) processed += 1;
        else failed += 1;
        completed += 1;
        send({
          done: completed,
          total,
          label: `Regenerated ${completed} of ${total} item${total === 1 ? "" : "s"}…`,
        });
      };

      try {
        // Bounded-concurrency worker pool over the candidate docs.
        let cursor = 0;
        const runners = Array.from(
          { length: Math.min(DOC_CONCURRENCY, total) },
          async () => {
            while (cursor < candidates.length) {
              const c = candidates[cursor++];
              if (c) await processDoc(c);
            }
          },
        );
        await Promise.all(runners);
        send({
          done: total,
          total,
          label: "Done",
          complete: true,
          processed,
          failed,
        });
      } catch (err) {
        payload.logger.error(err, "[regenerate-images] run failed");
        send({ error: "Regeneration failed. Please retry." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}

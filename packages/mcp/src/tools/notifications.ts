import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { Doc, McpToolContext } from "../payload-context";
import { createDoc, findDocs, updateDoc } from "../payload-context";
import { jsonResult, runTool } from "./shared";

/**
 * Push-notification tools, backed by the Payload `notifications` collection
 * (Marketing group; access = isStaff). Authoring a notification with
 * status=scheduled + scheduledAt is what the dispatch worker
 * (/api/cms/notifications/dispatch) picks up and sends. These run as the staff
 * user, so Payload enforces who may write.
 */
const channel = z
  .array(z.enum(["push", "email", "sms", "in_app"]))
  .min(1)
  .describe("Delivery channels. Default ['push'].");
const audience = z.enum(["all", "segment", "users"]);

function buildNotification(input: {
  title: string;
  body?: string;
  channel?: string[];
  audience?: string;
  targetUsers?: string[];
  segment?: Record<string, unknown>;
  deepLink?: string;
  scheduledAt?: string;
  status: string;
}): Doc {
  return {
    title: input.title,
    body: input.body,
    channel: input.channel ?? ["push"],
    audience: input.audience ?? "all",
    targetUsers: input.targetUsers,
    segment: input.segment,
    deepLink: input.deepLink,
    scheduledAt: input.scheduledAt,
    status: input.status,
  };
}

export function registerNotificationTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  server.registerTool(
    "notify_create",
    {
      title: "Create notification (draft)",
      description:
        "Create a push/email/SMS/in-app notification as a DRAFT (not sent). " +
        "Use notify_schedule to schedule delivery.",
      inputSchema: {
        title: z.string(),
        body: z.string().optional(),
        channel: channel.optional(),
        audience: audience.optional(),
        targetUsers: z
          .array(z.string())
          .optional()
          .describe("CMS user ids — required when audience='users'."),
        deepLink: z
          .string()
          .optional()
          .describe("In-app route to open, e.g. /posts/welcome."),
      },
    },
    (input) =>
      runTool(async () => {
        const doc = await createDoc(
          ctx,
          "notifications",
          buildNotification({ ...input, status: "draft" }),
        );
        return jsonResult({ created: true, id: doc.id, status: "draft" });
      }),
  );

  server.registerTool(
    "notify_schedule",
    {
      title: "Schedule notification",
      description:
        "Create and SCHEDULE a notification for delivery. `scheduledAt` is an " +
        "ISO timestamp; omit to send as soon as the dispatcher next runs. The " +
        "dispatch worker resolves the audience and sends pushes.",
      inputSchema: {
        title: z.string(),
        body: z.string().optional(),
        channel: channel.optional(),
        audience: audience.optional(),
        targetUsers: z.array(z.string()).optional(),
        deepLink: z.string().optional(),
        scheduledAt: z
          .string()
          .optional()
          .describe("ISO 8601 timestamp; defaults to now."),
      },
    },
    (input) =>
      runTool(async () => {
        const scheduledAt = input.scheduledAt ?? new Date().toISOString();
        const doc = await createDoc(
          ctx,
          "notifications",
          buildNotification({ ...input, scheduledAt, status: "scheduled" }),
        );
        return jsonResult({
          scheduled: true,
          id: doc.id,
          scheduledAt,
        });
      }),
  );

  server.registerTool(
    "notify_list",
    {
      title: "List notifications",
      description:
        "List recent notifications, newest first, optionally filtered by status.",
      inputSchema: {
        status: z
          .enum(["draft", "scheduled", "sending", "sent", "failed"])
          .optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    ({ status, limit }) =>
      runTool(async () => {
        const res = await findDocs(ctx, "notifications", {
          where: status ? { status: { equals: status } } : undefined,
          limit: limit ?? 20,
          sort: "-createdAt",
        });
        return jsonResult({
          total: res.totalDocs,
          results: res.docs.map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            scheduledAt: d.scheduledAt ?? null,
            sentAt: d.sentAt ?? null,
            sentCount: d.sentCount ?? 0,
          })),
        });
      }),
  );

  server.registerTool(
    "notify_cancel",
    {
      title: "Cancel a scheduled notification",
      description:
        "Unschedule a notification by moving it back to draft (only affects " +
        "notifications that haven't been sent yet).",
      inputSchema: { id: z.string() },
    },
    ({ id }) =>
      runTool(async () => {
        const doc = await updateDoc(ctx, "notifications", id, {
          status: "draft",
        });
        return jsonResult({ canceled: true, id: doc.id, status: doc.status });
      }),
  );
}

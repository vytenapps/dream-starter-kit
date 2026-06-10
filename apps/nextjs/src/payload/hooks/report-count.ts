import type { CollectionAfterChangeHook } from "payload";

import type { Report } from "@acme/cms";

/**
 * Keep the target's denormalized `reportCount` in step when a report is filed,
 * so moderators can sort by most-reported (and auto-hide past a threshold).
 * Best-effort: a failed counter update never fails the report itself.
 */
export const incrementReportCount: CollectionAfterChangeHook<Report> = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== "create") return doc;
  const target = doc.target;
  const targetId =
    typeof target.value === "object" ? target.value.id : target.value;
  // The generated Report type constrains this to community-posts | comments.
  const relationTo = target.relationTo;

  try {
    const current = await req.payload.findByID({
      collection: relationTo,
      id: targetId,
      depth: 0,
      overrideAccess: true,
      req,
    });
    await req.payload.update({
      collection: relationTo,
      id: targetId,
      data: { reportCount: (current.reportCount ?? 0) + 1 },
      depth: 0,
      overrideAccess: true,
      // Counter maintenance — marker for any future hooks to skip.
      context: { skipReportCount: true },
      req,
    });
  } catch (err) {
    req.payload.logger.warn(
      { err },
      "reports: failed to increment target reportCount",
    );
  }
  return doc;
};

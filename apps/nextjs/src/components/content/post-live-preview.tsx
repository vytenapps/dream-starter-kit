"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import type { Post } from "@acme/cms";

import { PostDetail } from "~/components/content/post-detail";
import { env } from "~/env";

/**
 * Client wrapper used only inside the Payload admin's Live Preview iframe (when
 * Next.js draft mode is on). It subscribes to the editor's live edits via
 * `useLivePreview` and re-renders the post in place — no save or refresh needed.
 */
export function PostLivePreview({ initialData }: { initialData: Post }) {
  const serverURL =
    env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const { data } = useLivePreview<Post>({ initialData, serverURL, depth: 1 });
  return <PostDetail post={data} />;
}

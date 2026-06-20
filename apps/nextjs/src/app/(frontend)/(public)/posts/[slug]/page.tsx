import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";

import { PostDetail } from "~/components/content/post-detail";
import { PostLivePreview } from "~/components/content/post-live-preview";
import { getPost } from "~/lib/payload";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug).catch(() => null);
  // Use the AI-generated OG card (then the hero) as the social-share image when
  // present — both URLs are cached on the doc by the syncImageUrls hook.
  const ogImage = post?.imageOgUrl ?? post?.imageHeroUrl ?? undefined;
  return {
    title: post?.meta?.title ?? post?.title ?? "Post",
    description: post?.meta?.description ?? post?.excerpt ?? undefined,
    ...(ogImage ? { openGraph: { images: [ogImage] } } : {}),
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // In draft mode (Payload Live Preview) hand off to the client wrapper so edits
  // stream into the admin iframe live; otherwise render server-side.
  const { isEnabled } = await draftMode();
  if (isEnabled) return <PostLivePreview initialData={post} />;
  return <PostDetail post={post} />;
}

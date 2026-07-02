import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";

import { PostDetail } from "~/components/content/post-detail";
import { PostLivePreview } from "~/components/content/post-live-preview";
import { PaywallJsonLd } from "~/components/paywall/paywall-jsonld";
import { getPremiumPlan } from "~/lib/billing-plan";
import { toPublicMediaUrl } from "~/lib/cms/media-url";
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
  const ogImage = toPublicMediaUrl(post?.imageOgUrl ?? post?.imageHeroUrl);
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

  // `getPost` enforces premium gating via Payload field access — the body is
  // already stripped from the response for a non-entitled viewer (it never left
  // the server). Its absence on a premium post is the signal to seed the paywall
  // + emit the paywalled-content markup.
  const withheld = post.accessLevel === "premium" && !post.body;
  const premiumPlan = withheld ? await getPremiumPlan() : null;

  return (
    <>
      {/* Declares the gated section as intentionally paywalled (anti-cloaking)
          — only when the body was actually withheld by access control. */}
      {withheld && <PaywallJsonLd />}
      <PostDetail post={post} premiumPlan={premiumPlan} />
    </>
  );
}

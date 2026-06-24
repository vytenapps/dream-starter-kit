import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";

import type { Post } from "@acme/cms";

import { PostDetail } from "~/components/content/post-detail";
import { PostLivePreview } from "~/components/content/post-live-preview";
import { PaywallJsonLd } from "~/components/paywall/paywall-jsonld";
import { isViewerPremium } from "~/lib/billing-entitlement";
import { getPremiumPlan } from "~/lib/billing-plan";
import { getPost } from "~/lib/payload";
import { truncateRichText } from "~/lib/rich-text-teaser";

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

  const gated = post.accessLevel === "premium";
  // Server-side entitlement: a premium post's body must NOT ship in full to a
  // non-entitled viewer (the on-page paywall only blurs it client-side). Resolve
  // the viewer's subscription server-side and withhold the locked body — sending
  // just a short teaser the gate blurs — so it never reaches the client.
  const entitled = gated ? await isViewerPremium() : true;
  // Premium posts SSR-seed the paywall with the resolved plan so the modal has
  // pricing instantly (skipped when entitled — no gate, no needless query).
  const premiumPlan = gated && !entitled ? await getPremiumPlan() : null;
  const safePost: Post =
    gated && !entitled
      ? { ...post, body: truncateRichText(post.body) as Post["body"] }
      : post;

  return (
    <>
      {/* Declares the gated section as intentionally paywalled (anti-cloaking)
          — only when the body is actually withheld. */}
      {gated && !entitled && <PaywallJsonLd />}
      <PostDetail post={safePost} premiumPlan={premiumPlan} />
    </>
  );
}

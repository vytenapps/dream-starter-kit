import type { Post } from "@acme/cms";

import type { PlanLite } from "~/lib/paywall-copy";
import { DetailLayout } from "~/components/content/detail-layout";
import { FavoriteButton } from "~/components/content/favorite-button";
import { PaywallProvider } from "~/components/paywall/paywall-provider";
import { PremiumGate } from "~/components/paywall/premium-gate";
import { CmsRichText } from "~/components/rich-text";
import { toPublicMediaUrl } from "~/lib/cms/media-url";

/**
 * Presentational render of a `posts` document. Shared by the server route
 * (published path) and the client `PostLivePreview` wrapper (draft path) so the
 * markup stays identical in both.
 *
 * Premium gating: when `accessLevel === "premium"` the body is wrapped in the
 * paywall gate — non-premium viewers see it blurred behind an on-page dock +
 * modal that reads the buyer's subscription (RLS read-own) and unlocks on
 * purchase. `premiumPlan` is the SSR-seeded plan so the modal has pricing with
 * no client fetch (omitted on the live-preview path, where it resolves
 * client-side).
 */
export function PostDetail({
  post,
  premiumPlan,
}: {
  post: Post;
  premiumPlan?: PlanLite | null;
}) {
  // Prefer an explicit featuredImage; otherwise fall back to the AI-generated
  // hero (its public URL is cached on `imageHeroUrl` by the syncImageUrls hook,
  // so no relation populate is needed).
  // Rewrite any stale/cached `/cms-api/.../file/…` URL to the public CDN object
  // (columns cached before the CDN switch, and depth:0 reads that skip the
  // storage afterRead hook, can still carry the access-controlled path).
  const image =
    typeof post.featuredImage === "object" && post.featuredImage?.url
      ? {
          url:
            toPublicMediaUrl(post.featuredImage.url) ?? post.featuredImage.url,
          alt: post.featuredImage.alt,
        }
      : post.imageHeroUrl
        ? {
            url: toPublicMediaUrl(post.imageHeroUrl) ?? post.imageHeroUrl,
            alt: post.imageAlt ?? post.title,
          }
        : null;

  const gated = post.accessLevel === "premium";
  // On a gated post the body is stripped server-side by Payload field access for
  // non-entitled viewers (it never reaches the client) — fall back to the
  // excerpt as the blurred teaser so the paywall still has a preview.
  const body = post.body ? (
    <CmsRichText data={post.body} />
  ) : gated && post.excerpt ? (
    <p className="text-muted-foreground leading-relaxed">{post.excerpt}</p>
  ) : null;

  return (
    <DetailLayout
      title={post.title}
      image={image}
      meta={
        <span className="flex items-center gap-3">
          {post.publishedAt && (
            <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
          )}
          <FavoriteButton collection="posts" itemId={String(post.id)} />
        </span>
      }
    >
      {gated ? (
        <PaywallProvider initialPlan={premiumPlan}>
          <PremiumGate>{body}</PremiumGate>
        </PaywallProvider>
      ) : (
        body
      )}
    </DetailLayout>
  );
}

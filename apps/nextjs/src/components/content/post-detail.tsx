import type { Post } from "@acme/cms";

import { DetailLayout } from "~/components/content/detail-layout";
import { CmsRichText } from "~/components/rich-text";

/**
 * Presentational render of a `posts` document. Shared by the server route
 * (published path) and the client `PostLivePreview` wrapper (draft path) so the
 * markup stays identical in both.
 */
export function PostDetail({ post }: { post: Post }) {
  // Prefer an explicit featuredImage; otherwise fall back to the AI-generated
  // hero (its public URL is cached on `imageHeroUrl` by the syncImageUrls hook,
  // so no relation populate is needed).
  const image =
    typeof post.featuredImage === "object" && post.featuredImage?.url
      ? { url: post.featuredImage.url, alt: post.featuredImage.alt }
      : post.imageHeroUrl
        ? { url: post.imageHeroUrl, alt: post.imageAlt ?? post.title }
        : null;

  return (
    <DetailLayout
      title={post.title}
      image={image}
      meta={
        post.publishedAt
          ? new Date(post.publishedAt).toLocaleDateString()
          : undefined
      }
    >
      <CmsRichText data={post.body} />
    </DetailLayout>
  );
}

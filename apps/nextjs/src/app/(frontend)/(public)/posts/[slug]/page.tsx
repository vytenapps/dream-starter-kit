import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailLayout } from "~/components/content/detail-layout";
import { CmsRichText } from "~/components/rich-text";
import { getPost } from "~/lib/payload";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug).catch(() => null);
  return {
    title: post?.meta?.title ?? post?.title ?? "Post",
    description: post?.meta?.description ?? post?.excerpt ?? undefined,
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

  const image =
    typeof post.featuredImage === "object" && post.featuredImage?.url
      ? { url: post.featuredImage.url, alt: post.featuredImage.alt }
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

import type { Metadata } from "next";

import {
  ContentCard,
  ContentEmpty,
  ContentGrid,
} from "~/components/content/content-card";
import { PageHeader } from "~/components/content/page-header";
import { Section } from "~/components/launch-ui/ui/section";
import { listPosts } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Posts",
  description: "Latest posts.",
};

export default async function PostsPage() {
  const posts = await listPosts();

  return (
    <>
      <PageHeader title="Posts" description="Long-form posts and updates." />
      <Section className="pt-8 sm:pt-12 md:pt-16">
        {posts.length > 0 ? (
          <ContentGrid>
            {posts.map((post) => {
              const image =
                typeof post.featuredImage === "object" &&
                post.featuredImage?.url
                  ? { url: post.featuredImage.url, alt: post.featuredImage.alt }
                  : null;
              return (
                <ContentCard
                  key={post.id}
                  href={`/posts/${post.slug}`}
                  title={post.title}
                  image={image}
                  meta={
                    post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : undefined
                  }
                  description={post.excerpt}
                />
              );
            })}
          </ContentGrid>
        ) : (
          <ContentEmpty>No posts yet.</ContentEmpty>
        )}
      </Section>
    </>
  );
}

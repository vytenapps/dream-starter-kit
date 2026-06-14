/**
 * The allowlist of Payload collections the MCP exposes, plus per-collection
 * metadata (human title field, free-text search fields, and a public URL
 * builder for ChatGPT search/fetch results). Editorial + community + marketing
 * content only — auth/PII-management collections (users, device-tokens,
 * feed-tokens) and internal ones (media, nav-items, kit-extensions) are
 * intentionally excluded. Per-operation authorization is still Payload's job;
 * this list just bounds the surface.
 */

export interface CollectionInfo {
  slug: string;
  label: string;
  group: string;
  /** Field used as a human-readable title. */
  titleField: string;
  /** Text fields searched with a case-insensitive `like`. */
  searchFields: string[];
  /** Build a public URL path for a doc, when the collection has a public page. */
  publicPath?: (doc: Record<string, unknown>) => string | null;
  /** Included in the ChatGPT cross-collection `search` tool. */
  chatgptSearch?: boolean;
}

const bySlug = (prefix: string) => (doc: Record<string, unknown>) =>
  typeof doc.slug === "string" ? `${prefix}/${doc.slug}` : null;

export const MCP_COLLECTIONS: CollectionInfo[] = [
  {
    slug: "posts",
    label: "Posts",
    group: "Content",
    titleField: "title",
    searchFields: ["title", "excerpt"],
    publicPath: bySlug("/posts"),
    chatgptSearch: true,
  },
  {
    slug: "pages",
    label: "Pages",
    group: "Marketing",
    titleField: "title",
    searchFields: ["title"],
    publicPath: bySlug(""),
    chatgptSearch: true,
  },
  {
    slug: "videos",
    label: "Videos",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
    publicPath: bySlug("/videos"),
    chatgptSearch: true,
  },
  {
    slug: "audio",
    label: "Audio",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
    chatgptSearch: true,
  },
  {
    slug: "photos",
    label: "Photos",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
  },
  {
    slug: "events",
    label: "Events",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
    publicPath: bySlug("/events"),
    chatgptSearch: true,
  },
  {
    slug: "locations",
    label: "Locations",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
    publicPath: bySlug("/locations"),
  },
  {
    slug: "series",
    label: "Series",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
    chatgptSearch: true,
  },
  {
    slug: "lessons",
    label: "Lessons",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
  },
  {
    slug: "categories",
    label: "Categories",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
  },
  {
    slug: "tags",
    label: "Tags",
    group: "Content",
    titleField: "title",
    searchFields: ["title"],
  },
  {
    slug: "community-spaces",
    label: "Community spaces",
    group: "Community",
    titleField: "name",
    searchFields: ["name"],
  },
  {
    slug: "community-posts",
    label: "Community posts",
    group: "Community",
    titleField: "title",
    searchFields: ["title"],
    chatgptSearch: true,
  },
  {
    slug: "comments",
    label: "Comments",
    group: "Community",
    titleField: "body",
    searchFields: ["body"],
  },
  {
    slug: "banners",
    label: "Banners",
    group: "Marketing",
    titleField: "title",
    searchFields: ["title"],
  },
  {
    slug: "onboarding",
    label: "Onboarding",
    group: "Marketing",
    titleField: "title",
    searchFields: ["title"],
  },
  {
    slug: "notifications",
    label: "Notifications",
    group: "Marketing",
    titleField: "title",
    searchFields: ["title", "body"],
  },
];

const BY_SLUG = new Map(MCP_COLLECTIONS.map((c) => [c.slug, c]));

export function getCollectionInfo(slug: string): CollectionInfo | undefined {
  return BY_SLUG.get(slug);
}

export function isAllowedCollection(slug: string): boolean {
  return BY_SLUG.has(slug);
}

/** Non-empty tuple of slugs for building a zod enum. */
export const COLLECTION_SLUGS = MCP_COLLECTIONS.map((c) => c.slug) as [
  string,
  ...string[],
];

/** A short human title for a doc, falling back across common fields. */
export function docTitle(
  info: CollectionInfo,
  doc: Record<string, unknown>,
): string {
  const candidates = [info.titleField, "title", "name", "label", "slug"];
  for (const field of candidates) {
    const value = doc[field];
    if (typeof value === "string" && value.trim()) return value;
  }
  const id = doc.id;
  return typeof id === "string" || typeof id === "number"
    ? String(id)
    : "(untitled)";
}

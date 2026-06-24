/**
 * Truncate serialized Lexical editor state to its first `maxBlocks` top-level
 * nodes — a teaser for premium content that must NOT be shipped in full to a
 * non-entitled viewer. The on-page paywall then blurs only this teaser, so the
 * locked remainder never reaches the client (DOM, props, or network payload).
 *
 * Returns the input unchanged when it isn't the expected `{ root: { children } }`
 * shape (or is already short), so non-premium / unstructured bodies pass through.
 */
export function truncateRichText(data: unknown, maxBlocks = 3): unknown {
  if (!data || typeof data !== "object") return data;
  const root = (data as { root?: { children?: unknown[] } }).root;
  if (!root || !Array.isArray(root.children)) return data;
  if (root.children.length <= maxBlocks) return data;
  return {
    ...(data as Record<string, unknown>),
    root: { ...root, children: root.children.slice(0, maxBlocks) },
  };
}

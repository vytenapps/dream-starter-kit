/**
 * Flatten a Lexical richText value to plain text (for search scoring + the
 * Ask-AI context window). Walks the node tree collecting `text` leaves — the
 * same approach as the host's estimateReadingTime walker.
 */
export function lexicalToPlainText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: unknown; children?: unknown[] };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  walk((value as { root?: unknown }).root ?? value);
  return out.join(" ");
}

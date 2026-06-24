/**
 * Google "paywalled content" structured data — declares that the gated section
 * is intentionally not free, so serving a teaser to crawlers isn't treated as
 * cloaking (https://developers.google.com/search/docs/appearance/structured-data/paywalled-content).
 *
 * ONLY render this when the content is *actually* gated server-side (the full
 * content withheld from the response). Emitting it for content that is in fact
 * readable would misrepresent the page to Google.
 */
export function PaywallJsonLd({
  type = "Article",
  cssSelector = ".premium-gate-blur",
}: {
  /** schema.org type of the page's main content. */
  type?: string;
  /** Selector(s) of the gated element(s) on the page. */
  cssSelector?: string | string[];
}) {
  const json = {
    "@context": "https://schema.org",
    "@type": type,
    isAccessibleForFree: false,
    hasPart: {
      "@type": "WebPageElement",
      isAccessibleForFree: false,
      cssSelector,
    },
  };
  return (
    <script
      type="application/ld+json"
      // Static, server-built object — no user input — safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

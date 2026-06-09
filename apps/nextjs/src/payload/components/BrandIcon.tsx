/**
 * Replaces Payload's default mark in the admin chrome (the step-nav home icon)
 * with the brand favicon — the same /favicon.svg the public header/footer
 * render. The SVG carries its own light/dark variants via an embedded
 * prefers-color-scheme rule, matching the front-end behavior.
 */
export function BrandIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden
      style={{ height: "100%", width: "auto" }}
    />
  );
}

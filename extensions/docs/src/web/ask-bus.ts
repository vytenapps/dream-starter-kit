"use client";

/**
 * Tiny window-event bus so any docs island (top-bar button, Explain-more,
 * text-selection toolbar) can open the single Ask-AI panel with an optional
 * seeded question — without threading a React context across the server-
 * component boundaries that separate them.
 */
const EVENT = "docs:ask";

export function openAskAi(prompt?: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { prompt } }));
}

export function onAskAi(handler: (prompt?: string) => void): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<{ prompt?: string }>).detail?.prompt);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function currentDocSlug(): string | undefined {
  const m = /\/docs\/([^/?#]+)/.exec(window.location.pathname);
  return m?.[1];
}

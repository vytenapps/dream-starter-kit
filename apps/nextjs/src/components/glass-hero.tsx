"use client";

import { useSyncExternalStore } from "react";
import LiquidGlass from "liquid-glass-react";

const subscribe = () => () => {
  /* no store updates — value is constant after hydration */
};

/** False on the server and the first client render, true once hydrated. */
function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Decorative liquid-glass accent for the landing hero — WEB ONLY and purely
 * ornamental. It renders client-side (after mount) and is `aria-hidden`, layered
 * *behind* the hero text, so the real heading + CTAs stay server-rendered and
 * crawlable. The Apple-style refraction only shows in Chromium; elsewhere it
 * degrades to a soft translucent panel.
 *
 * Use glass sparingly — as an accent on landing/paywall, not everywhere.
 * backdrop-blur is costly to paint and can hurt contrast (see ARCHITECTURE.md §4.4).
 */
export function GlassHero() {
  if (!useHydrated()) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 hidden items-center justify-center md:flex"
    >
      <LiquidGlass
        mode="standard"
        cornerRadius={36}
        blurAmount={0.0625}
        displacementScale={64}
        saturation={130}
        aberrationIntensity={2}
        elasticity={0.3}
        padding="0"
      >
        <div className="h-72 w-[min(82vw,40rem)]" />
      </LiquidGlass>
    </div>
  );
}

"use client";

import { Heart } from "lucide-react";

import { favoriteKey, useFavorites, useToggleFavorite } from "@acme/app";
import { cn } from "@acme/ui";

import { useCaptcha } from "~/components/captcha/captcha-provider";

/**
 * Save/unsave heart for ANY content collection (posts/videos/audio/photos/
 * locations/events) — pass the Payload collection slug + doc id. Writes
 * `public.content_favorites` via the RLS client; the first save mints an
 * anonymous account (see useToggleFavorite → ensureAnonSession), so it works
 * for logged-out visitors. The Turnstile token (when CAPTCHA is enabled) is
 * threaded through for that anonymous sign-in.
 */
export function FavoriteButton({
  collection,
  itemId,
  className,
  size = 20,
}: {
  collection: string;
  itemId: string;
  className?: string;
  size?: number;
}) {
  const { data: favorites } = useFavorites(collection);
  const toggle = useToggleFavorite();
  const { token: captchaToken, reset: resetCaptcha } = useCaptcha();

  const favorited = favorites?.has(favoriteKey(collection, itemId)) ?? false;

  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from saved" : "Save"}
      disabled={toggle.isPending}
      onClick={(e) => {
        // Cards wrap content in a link — don't navigate when toggling the save.
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({
          collection,
          itemId,
          favorited: !favorited,
          captchaToken,
        });
        resetCaptcha();
      }}
      className={cn(
        "bg-background/70 text-foreground hover:bg-background inline-flex items-center justify-center rounded-full p-2 backdrop-blur transition-colors disabled:opacity-50",
        className,
      )}
    >
      <Heart
        size={size}
        className={cn(favorited && "fill-red-500 text-red-500")}
      />
    </button>
  );
}

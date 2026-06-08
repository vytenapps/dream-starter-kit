import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";

import type { ThemeEditorInitial } from "./components/ThemeEditor";
import type { ColorSet } from "~/lib/theme/defaults";
import {
  COLOR_TOKENS,
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SANS,
  DEFAULT_FONT_SERIF,
  DEFAULT_LETTER_SPACING,
  DEFAULT_RADIUS,
  DEFAULT_SHADOW,
  DEFAULT_SPACING,
} from "~/lib/theme/defaults";
import { ThemeEditor } from "./components/ThemeEditor";

interface MaybeMedia {
  id?: number;
  url?: string | null;
}
const mediaRef = (v: unknown): ThemeEditorInitial["appIcon"] =>
  v && typeof v === "object" && "id" in v
    ? {
        id: (v as MaybeMedia).id ?? 0,
        url: (v as MaybeMedia).url ?? null,
      }
    : null;

const fillColors = (
  stored: ColorSet | undefined,
  mode: "light" | "dark",
): ColorSet =>
  Object.fromEntries(
    COLOR_TOKENS.map((t) => [t.field, stored?.[t.field] ?? t[mode]]),
  );

/**
 * Custom Payload admin view at `/admin/theme`. Server component: loads the
 * `theme-settings` global (depth 1 so media URLs resolve) and hands initial
 * values to the client editor. Staff-gated by `proxy.ts` like all of `/admin`.
 *
 * Wrapped in Payload's `DefaultTemplate` so it renders inside the standard admin
 * chrome (nav sidebar + header), cohesive with the rest of the panel.
 */
export async function ThemeView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req } = initPageResult;
  const g = (await req.payload.findGlobal({
    slug: "theme-settings",
    depth: 1,
  })) as unknown as {
    editorMode?: "simple" | "advanced" | null;
    appName?: string | null;
    appIcon?: unknown;
    logoLight?: unknown;
    logoDark?: unknown;
    colorsLight?: ColorSet;
    colorsDark?: ColorSet;
    fontSans?: string | null;
    fontSerif?: string | null;
    fontMono?: string | null;
    letterSpacing?: string | null;
    radius?: string | null;
    spacing?: string | null;
    shadow?: Partial<typeof DEFAULT_SHADOW> | null;
  };

  const initial: ThemeEditorInitial = {
    editorMode: g.editorMode ?? "simple",
    appName: g.appName ?? "",
    appIcon: mediaRef(g.appIcon),
    logoLight: mediaRef(g.logoLight),
    logoDark: mediaRef(g.logoDark),
    colorsLight: fillColors(g.colorsLight, "light"),
    colorsDark: fillColors(g.colorsDark, "dark"),
    fontSans: g.fontSans ?? DEFAULT_FONT_SANS,
    fontSerif: g.fontSerif ?? DEFAULT_FONT_SERIF,
    fontMono: g.fontMono ?? DEFAULT_FONT_MONO,
    letterSpacing: g.letterSpacing ?? DEFAULT_LETTER_SPACING,
    radius: g.radius ?? DEFAULT_RADIUS,
    spacing: g.spacing ?? DEFAULT_SPACING,
    shadow: { ...DEFAULT_SHADOW, ...(g.shadow ?? {}) },
  };

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <ThemeEditor initial={initial} />
    </DefaultTemplate>
  );
}

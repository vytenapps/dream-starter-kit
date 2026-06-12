"use client";

import type { ReactNode } from "react";

import { ExtWidgetsProvider } from "@acme/ext-kit/react";

import { extWidgets } from "~/ext/registry.client.generated";

/**
 * Wires the generated widget registry into @acme/ext-kit/react so the
 * dashboard extension (which can't import host registries) can render the
 * widget grid. The (app) layout passes the runtime-disabled extensions
 * (kit-extensions toggles) so their widgets disappear without a redeploy.
 */
export function AppExtWidgetsProvider({
  disabledSlugs,
  children,
}: {
  disabledSlugs: string[];
  children: ReactNode;
}) {
  const widgets = extWidgets.filter((w) => !disabledSlugs.includes(w.slug));
  return <ExtWidgetsProvider widgets={widgets}>{children}</ExtWidgetsProvider>;
}

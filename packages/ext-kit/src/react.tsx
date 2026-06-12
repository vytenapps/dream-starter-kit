"use client";

import type { ComponentType, ReactNode } from "react";
import { createContext, useContext } from "react";

/**
 * Widget plumbing for the dashboard/home screen (docs/EXTENSIONS-PLAN.md §8).
 *
 * Extensions can't import the host's generated registries, so the host wires
 * its `extWidgets` (filtered to enabled extensions) into this provider once —
 * web in the (app) layout, native in the Expo (app) layout — and the dashboard
 * extension renders whatever it finds via `useExtWidgets()`. Cross-platform:
 * pure React context, no DOM/RN imports.
 */
export interface ExtWidgetEntry {
  slug: string;
  Widget: ComponentType;
}

const ExtWidgetsContext = createContext<ExtWidgetEntry[]>([]);

export function ExtWidgetsProvider({
  widgets,
  children,
}: {
  widgets: ExtWidgetEntry[];
  children: ReactNode;
}) {
  return (
    <ExtWidgetsContext.Provider value={widgets}>
      {children}
    </ExtWidgetsContext.Provider>
  );
}

/** The installed-and-enabled extensions' dashboard widgets, host-provided. */
export function useExtWidgets(): ExtWidgetEntry[] {
  return useContext(ExtWidgetsContext);
}

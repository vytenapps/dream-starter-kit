"use client";

import * as React from "react";

import { APP_NAME } from "@acme/config/constants";

import type { Branding } from "~/lib/payload";

const BrandingContext = React.createContext<Branding>({
  appName: APP_NAME,
  appIconUrl: null,
  logoLightUrl: null,
  logoDarkUrl: null,
  brandLink: { url: "/", external: false, newTab: false },
});

/** Seeds branding (from the theme-settings global) into client components like
 *  the sidebar. Fed by a server fetch in the (app) layout. */
export function BrandingProvider({
  value,
  children,
}: {
  value: Branding;
  children: React.ReactNode;
}) {
  return <BrandingContext value={value}>{children}</BrandingContext>;
}

export function useBranding(): Branding {
  return React.use(BrandingContext);
}

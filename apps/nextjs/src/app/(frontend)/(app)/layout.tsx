import { redirect } from "next/navigation";

import { AppSidebar } from "~/components/app-sidebar";
import { BrandingProvider } from "~/components/branding-provider";
import { AppExtWidgetsProvider } from "~/components/ext-widgets-provider";
import { SiteHeader } from "~/components/site-header";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { ensureCmsUser, ensureFreeTag } from "~/lib/cms/mirror-user";
import { disabledExtensionSlugs } from "~/lib/ext/enabled";
import { getWebNavItems } from "~/lib/ext/nav";
import { getBranding } from "~/lib/payload";
import { createClient } from "~/lib/supabase/server";

/**
 * Server-side guard for the authenticated area (belt-and-suspenders with
 * middleware). Anything under (app) requires a session.
 *
 * Also provides the shared shadcn `dashboard-01` shell — sidebar + header — so
 * every signed-in page (dashboard, chat, reminders, notifications, profile)
 * renders inside one consistent chrome. Pages return only their content.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const [branding, navItems, disabledSlugs, profile] = await Promise.all([
    getBranding(),
    // CMS-driven menu (nav-items collection) — staff edits in /admin show up
    // without a redeploy; degrades to the generated defaults if the CMS is down.
    getWebNavItems(),
    disabledExtensionSlugs(),
    // Staff/admin flag gates the header's CMS settings shortcut (RLS read-own).
    supabase.from("profiles").select("is_staff").eq("id", user.id).single(),
    // Universal backstop for the cms.users mirror: guest-checkout buyers (and
    // any future out-of-band signup) establish their session without passing
    // through /welcome or /auth/callback, so mirror here the first time they
    // reach the app shell. Idempotent + best-effort (swallows its own errors),
    // so it never blocks render — for already-mirrored users it's one indexed
    // lookup. Skip ANONYMOUS sessions (anon-first identity): they must not
    // become permanent ghost cms.users rows — they're mirrored on conversion.
    // See lib/cms/mirror-user.ts.
    user.is_anonymous
      ? Promise.resolve()
      : ensureCmsUser({
          id: user.id,
          email: user.email,
          name:
            (user.user_metadata.display_name as string | undefined) ??
            (user.user_metadata.name as string | undefined),
          metadata: user.user_metadata,
        }),
    user.is_anonymous ? Promise.resolve() : ensureFreeTag(user.id),
  ]);
  const isStaff = profile.data?.is_staff ?? false;

  return (
    <BrandingProvider value={branding}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" navItems={navItems} />
        <SidebarInset>
          <SiteHeader isStaff={isStaff} navItems={navItems} />
          <AppExtWidgetsProvider disabledSlugs={disabledSlugs}>
            {children}
          </AppExtWidgetsProvider>
        </SidebarInset>
      </SidebarProvider>
    </BrandingProvider>
  );
}

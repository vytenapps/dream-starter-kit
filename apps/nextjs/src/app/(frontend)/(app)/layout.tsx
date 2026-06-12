import { redirect } from "next/navigation";

import { AppSidebar } from "~/components/app-sidebar";
import { BrandingProvider } from "~/components/branding-provider";
import { SiteHeader } from "~/components/site-header";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
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

  const [branding, navItems] = await Promise.all([
    getBranding(),
    // CMS-driven menu (nav-items collection) — staff edits in /admin show up
    // without a redeploy; degrades to the generated defaults if the CMS is down.
    getWebNavItems(),
  ]);

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
          <SiteHeader navItems={navItems} />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </BrandingProvider>
  );
}

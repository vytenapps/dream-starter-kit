import { defineExtension } from "@acme/ext-kit";

/**
 * Dashboard — the app's home surface on both platforms, claimed via mount
 * overrides (web "/a", native "index" — which marks it `system` in
 * kit-extensions). Renders core quick links plus the WIDGET GRID: every
 * installed-and-enabled extension's declared `widgets` component, provided by
 * the host through @acme/ext-kit/react. This is what makes the home screen
 * extensible instead of hand-edited.
 */
export default defineExtension({
  slug: "dashboard",
  name: "Dashboard",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "The extensible home screen: quick links + extension widgets.",
  nav: {
    web: [{ title: "Dashboard", href: "/a", icon: "IconDashboard", order: 10 }],
  },
  routes: {
    web: [{ path: "", component: "DashboardPage", mount: "/a" }],
    native: [{ path: "", component: "HomeScreen", mount: "index" }],
  },
});

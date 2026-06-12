/**
 * Core (host-owned) menu defaults — seeded into the `nav-items` collection by
 * the boot reconcile alongside extension nav defaults, so staff manage the
 * whole menu uniformly in /admin. As features are extracted into extensions
 * (EXTENSIONS-PLAN.md §8), their entries move from here into the extension
 * manifests.
 *
 * Keys are `core:<href>` — href is the stable identity of a menu entry; a
 * changed href reads as remove + add (staff edits on the old row are dropped).
 */
export interface CoreNavItem {
  key: string;
  label: string;
  href: string;
  icon?: string;
  /** Creation order — initial menu position (staff drag-reorder owns it after). */
  order: number;
  platforms: ("web" | "native")[];
}

export const CORE_NAV_ITEMS: CoreNavItem[] = [
  {
    key: "core:/a",
    label: "Dashboard",
    href: "/a",
    icon: "IconDashboard",
    order: 10,
    platforms: ["web"],
  },
  {
    key: "core:/content/posts",
    label: "Posts",
    href: "/content/posts",
    order: 15,
    platforms: ["native"],
  },
  {
    key: "core:/billing",
    label: "Billing",
    href: "/billing",
    icon: "IconCreditCard",
    order: 50,
    platforms: ["web"],
  },
  {
    key: "core:/pricing",
    label: "Pricing",
    href: "/pricing",
    order: 55,
    platforms: ["native"],
  },
  {
    key: "core:/profile",
    label: "Profile",
    href: "/profile",
    order: 60,
    platforms: ["native"],
  },
];

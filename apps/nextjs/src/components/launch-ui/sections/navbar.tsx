import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";

import { cn } from "@acme/ui";

import type { NavItem } from "../ui/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { isExternalUrl } from "~/lib/site-chrome";
import LaunchUI from "../logos/launch-ui";
import { Button, buttonVariants } from "../ui/button";
import {
  Navbar as NavbarComponent,
  NavbarLeft,
  NavbarRight,
} from "../ui/navbar";
import Navigation from "../ui/navigation";

interface NavbarLink {
  text: string;
  href: string;
}

export interface NavbarActionProps {
  text: string;
  href: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  icon?: ReactNode;
  iconRight?: ReactNode;
  isButton?: boolean;
}

export interface NavbarProps {
  logo?: ReactNode;
  name?: string;
  homeUrl?: string;
  /** Open the brand link in a new tab (set for external brand links). */
  homeNewTab?: boolean;
  items?: NavItem[];
  mobileLinks?: NavbarLink[];
  actions?: NavbarActionProps[];
  /**
   * Optional client-rendered replacement for the right-side `actions`. When
   * provided it owns the right side entirely (e.g. an auth-aware element that
   * swaps the actions for a signed-in user's avatar menu); `actions` is then
   * rendered by the slot, not here.
   */
  actionsSlot?: ReactNode;
  showNavigation?: boolean;
  className?: string;
}

export default function Navbar({
  logo = <LaunchUI />,
  name = "Acme",
  homeUrl = "/",
  homeNewTab = false,
  items = [],
  mobileLinks = [],
  actions = [],
  actionsSlot,
  showNavigation = true,
  className,
}: NavbarProps) {
  return (
    <header className={cn("sticky top-0 z-50 -mb-4 px-4 pb-4", className)}>
      <div className="fade-bottom bg-background/15 absolute left-0 h-24 w-full backdrop-blur-lg"></div>
      <div className="max-w-container relative mx-auto">
        <NavbarComponent>
          <NavbarLeft>
            <a
              href={homeUrl}
              {...(homeNewTab
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="flex items-center gap-2 text-xl font-bold"
            >
              {logo}
              {/* Wordmark pinned to Geist so the brand name stays consistent
                  regardless of the theme's selected body font. */}
              <span className="font-[family-name:var(--font-geist-sans)] whitespace-nowrap">
                {name}
              </span>
            </a>
            {showNavigation && items.length > 0 && <Navigation items={items} />}
          </NavbarLeft>
          <NavbarRight>
            {actionsSlot ??
              actions.map((action) =>
                action.isButton ? (
                  <Button
                    key={`${action.href}-${action.text}`}
                    variant={action.variant ?? "default"}
                    asChild
                  >
                    <a href={action.href}>
                      {action.icon}
                      {action.text}
                      {action.iconRight}
                    </a>
                  </Button>
                ) : (
                  <a
                    key={`${action.href}-${action.text}`}
                    href={action.href}
                    className="hidden text-sm md:block"
                  >
                    {action.text}
                  </a>
                ),
              )}
            <Sheet>
              {/* Style the radix trigger directly instead of `asChild` + <Button>:
                  radix Slot cloning a component child (Button) doesn't render on
                  the server in this radix-ui + React 19 setup, so the trigger was
                  absent from SSR HTML and hydration mismatched on every page. */}
              <SheetTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "shrink-0 md:hidden",
                )}
              >
                <Menu className="size-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Site navigation links.
                </SheetDescription>
                <nav className="grid gap-6 p-6 text-lg font-medium">
                  <a
                    href={homeUrl}
                    className="flex items-center gap-2 text-xl font-bold"
                  >
                    <span>{name}</span>
                  </a>
                  {mobileLinks.map((link) => (
                    <a
                      key={`${link.href}-${link.text}`}
                      href={link.href}
                      {...(isExternalUrl(link.href)
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {link.text}
                    </a>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </NavbarRight>
        </NavbarComponent>
      </div>
    </header>
  );
}

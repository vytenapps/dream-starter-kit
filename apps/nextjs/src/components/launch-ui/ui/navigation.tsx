"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@acme/ui";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "./navigation-menu";

export interface NavSubItem {
  title: string;
  href: string;
  description?: string;
}

export interface NavItem {
  title: string;
  href?: string;
  submenu?: NavSubItem[];
}

interface NavigationProps {
  items?: NavItem[];
  className?: string;
}

/**
 * Launch UI navigation, adapted to be data-driven: top-level links render as
 * plain links; items with a `submenu` render a dropdown (NavigationMenu) of
 * titled/described sub-links. Fed from the SiteSettings header config.
 */
export default function Navigation({ items = [], className }: NavigationProps) {
  if (items.length === 0) return null;

  return (
    <NavigationMenu className={cn("hidden md:flex", className)}>
      <NavigationMenuList>
        {items.map((item) => (
          <NavigationMenuItem key={item.title}>
            {item.submenu && item.submenu.length > 0 ? (
              <>
                <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[320px] gap-1 p-2 md:w-[420px] md:grid-cols-2">
                    {item.submenu.map((sub) => (
                      <ListItem
                        key={`${sub.href}-${sub.title}`}
                        href={sub.href}
                        title={sub.title}
                      >
                        {sub.description}
                      </ListItem>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                asChild
              >
                <Link href={item.href ?? "#"}>{item.title}</Link>
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function ListItem({
  className,
  title,
  children,
  href,
  ...props
}: React.ComponentProps<typeof Link> & { title: string }) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          data-slot="list-item"
          className={cn(
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline outline-hidden transition-colors select-none",
            className,
          )}
          {...props}
        >
          <div className="text-sm leading-none font-medium">{title}</div>
          {children && (
            <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
              {children}
            </p>
          )}
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

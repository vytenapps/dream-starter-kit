import type { ReactNode } from "react";

import { cn } from "@acme/ui";
import { ThemeToggle } from "@acme/ui/theme";

import LaunchUI from "../logos/launch-ui";
import {
  Footer,
  FooterBottom,
  FooterColumn,
  FooterContent,
} from "../ui/footer";

interface FooterLink {
  text: string;
  href: string;
}

export interface FooterColumnProps {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  logo?: ReactNode;
  name?: string;
  /** Optional link for the brand lockup. When omitted, the brand isn't linked. */
  homeUrl?: string;
  /** Open the brand link in a new tab (set for external brand links). */
  homeNewTab?: boolean;
  columns?: FooterColumnProps[];
  copyright?: string;
  policies?: FooterLink[];
  showModeToggle?: boolean;
  className?: string;
}

export default function FooterSection({
  logo = <LaunchUI />,
  name = "Acme",
  homeUrl,
  homeNewTab = false,
  columns = [],
  copyright,
  policies = [],
  showModeToggle = true,
  className,
}: FooterProps) {
  return (
    <footer className={cn("bg-background w-full px-4", className)}>
      <div className="max-w-container mx-auto">
        <Footer>
          <FooterContent>
            <FooterColumn className="col-span-2 sm:col-span-3 md:col-span-1">
              {(() => {
                const brand = (
                  <>
                    {logo}
                    <h3 className="font-[family-name:var(--font-geist-sans)] text-xl font-bold">
                      {name}
                    </h3>
                  </>
                );
                return homeUrl ? (
                  <a
                    href={homeUrl}
                    {...(homeNewTab
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="flex items-center gap-2"
                  >
                    {brand}
                  </a>
                ) : (
                  <div className="flex items-center gap-2">{brand}</div>
                );
              })()}
            </FooterColumn>
            {columns.map((column) => (
              <FooterColumn key={column.title}>
                <h3 className="text-md pt-1 font-semibold">{column.title}</h3>
                {column.links.map((link) => (
                  <a
                    key={`${link.href}-${link.text}`}
                    href={link.href}
                    className="text-muted-foreground text-sm"
                  >
                    {link.text}
                  </a>
                ))}
              </FooterColumn>
            ))}
          </FooterContent>
          <FooterBottom>
            <div>{copyright ?? `© ${new Date().getFullYear()} ${name}`}</div>
            <div className="flex items-center gap-4">
              {policies.map((policy) => (
                <a key={`${policy.href}-${policy.text}`} href={policy.href}>
                  {policy.text}
                </a>
              ))}
              {showModeToggle && <ThemeToggle />}
            </div>
          </FooterBottom>
        </Footer>
      </div>
    </footer>
  );
}

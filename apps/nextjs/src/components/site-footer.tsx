import Link from "next/link";

import { APP_NAME } from "@acme/config/constants";

const LEGAL = [
  { label: "About", url: "/about" },
  { label: "Contact", url: "/contact" },
  { label: "Terms", url: "/terms" },
  { label: "Privacy", url: "/privacy" },
];

/** Public site footer (static legal/links + copyright). */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-8 text-sm sm:flex-row">
        <p>
          © {new Date().getFullYear()} {APP_NAME}
        </p>
        <div className="flex gap-4">
          {LEGAL.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className="hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

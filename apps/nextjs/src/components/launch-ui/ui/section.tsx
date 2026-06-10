import * as React from "react";

import { cn } from "@acme/ui";

function Section({ className, ...props }: React.ComponentProps<"section">) {
  // Tighter vertical rhythm than upstream Launch UI (py-12 sm:py-24 md:py-32),
  // whose 128px paddings stack to ~256px of whitespace between adjacent
  // sections and push the home page content below the fold.
  return (
    <section
      data-slot="section"
      className={cn("line-b px-4 py-8 sm:py-12 md:py-16", className)}
      {...props}
    />
  );
}

export { Section };

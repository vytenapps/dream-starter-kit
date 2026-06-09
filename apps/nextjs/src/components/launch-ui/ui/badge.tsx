import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@acme/ui";

const badgeVariants = cva(
  "border-border/100 dark:border-border/20 focus:ring-ring inline-flex items-center gap-2 rounded-full border text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-transparent dark:border-transparent dark:shadow-sm",
        brand:
          "bg-brand text-primary-foreground border-transparent dark:border-transparent dark:shadow-sm",
        "brand-secondary":
          "bg-brand-foreground/20 text-brand border-transparent dark:border-transparent",
        secondary:
          "bg-secondary text-secondary-foreground border-transparent dark:border-transparent dark:shadow-sm",
        destructive:
          "bg-destructive/30 text-destructive-foreground border-transparent dark:border-transparent dark:shadow-sm",
        outline: "text-foreground",
      },
      size: {
        default: "px-2.5 py-1",
        sm: "px-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };

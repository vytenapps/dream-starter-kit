import type { VariantProps } from "class-variance-authority";
import React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@acme/ui";

const mockupVariants = cva(
  "border-border/70 dark:border-border/5 dark:border-t-border/15 relative z-10 flex overflow-hidden border shadow-2xl",
  {
    variants: {
      type: {
        mobile: "max-w-[350px] rounded-[48px]",
        responsive: "rounded-md",
      },
    },
    defaultVariants: {
      type: "responsive",
    },
  },
);

export type MockupProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof mockupVariants>;

function Mockup({ className, type, ...props }: MockupProps) {
  return (
    <div
      data-slot="mockup"
      className={cn(mockupVariants({ type, className }))}
      {...props}
    />
  );
}

const frameVariants = cva(
  "bg-border/50 dark:bg-border/10 relative z-10 flex overflow-hidden rounded-2xl",
  {
    variants: {
      size: {
        small: "p-2",
        large: "p-4",
      },
    },
    defaultVariants: {
      size: "small",
    },
  },
);

export type MockupFrameProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof frameVariants>;

function MockupFrame({ className, size, ...props }: MockupFrameProps) {
  return (
    <div
      data-slot="mockup-frame"
      className={cn(frameVariants({ size, className }))}
      {...props}
    />
  );
}

export { Mockup, MockupFrame };

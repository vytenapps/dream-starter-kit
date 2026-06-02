import type { TextProps } from "react-native";
import { Text as RNText } from "react-native";

import { cn } from "~/lib/cn";

export function Text({
  className,
  ...props
}: TextProps & { className?: string }) {
  return <RNText className={cn("text-foreground", className)} {...props} />;
}

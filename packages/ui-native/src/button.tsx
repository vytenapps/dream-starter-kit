import type { PressableProps } from "react-native";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { cn } from "./cn";

type Variant = "default" | "outline" | "destructive" | "ghost";

const container: Record<Variant, string> = {
  default: "bg-primary",
  outline: "border border-input bg-transparent",
  destructive: "bg-destructive",
  ghost: "bg-transparent",
};

const label: Record<Variant, string> = {
  default: "text-primary-foreground",
  outline: "text-foreground",
  destructive: "text-white",
  ghost: "text-foreground",
};

export function Button({
  title,
  variant = "default",
  loading = false,
  disabled,
  className,
  ...props
}: PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
}) {
  const isDisabled = disabled ?? loading;
  return (
    <Pressable
      className={cn(
        "h-12 flex-row items-center justify-center rounded-md px-4",
        container[variant],
        isDisabled && "opacity-50",
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={cn("text-base font-medium", label[variant])}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

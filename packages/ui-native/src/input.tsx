import type { TextInputProps } from "react-native";
import { TextInput } from "react-native";

import { cn } from "./cn";

export function Input({
  className,
  ...props
}: TextInputProps & { className?: string }) {
  return (
    <TextInput
      className={cn(
        "border-input bg-background text-foreground h-12 rounded-md border px-3 text-base",
        className,
      )}
      placeholderTextColor="#9ca3af"
      {...props}
    />
  );
}

"use client";

import { HexColorInput, HexColorPicker } from "react-colorful";

import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { formatOklch, hexToOklch, toHex } from "~/lib/theme/color";

/**
 * A single color token control: a swatch that opens a `react-colorful` picker +
 * hex input. Values are stored as `oklch(...)` strings (theme format); the
 * picker works in hex and converts on the way in/out.
 */
export function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (oklch: string) => void;
  disabled?: boolean;
}) {
  const hex = toHex(value);
  const setHex = (h: string) => onChange(formatOklch(hexToOklch(h)));

  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-foreground/90 text-sm font-normal">{label}</Label>
      <Popover>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            className="border-border flex items-center gap-2 rounded-md border px-2 py-1 disabled:opacity-50"
          >
            <span
              className="size-5 rounded-sm border"
              style={{ backgroundColor: hex }}
            />
            <span className="text-muted-foreground font-mono text-xs uppercase">
              {hex}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto space-y-3">
          <HexColorPicker color={hex} onChange={setHex} />
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-sm">#</span>
            <HexColorInput
              color={hex}
              onChange={setHex}
              className="border-input bg-background h-8 w-full rounded-md border px-2 font-mono text-sm uppercase"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  BombIcon,
  ListIcon,
  PaletteIcon,
  PenLineIcon,
  PenSquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { cn } from "../../lib/utils";

export type SlashCommand = {
  name: string;
  description: string;
  icon: ReactNode;
  action: string;
  shortcut?: string;
};

export const slashCommands: SlashCommand[] = [
  {
    name: "new",
    description: "Start a new chat",
    icon: <PenSquareIcon className="size-3.5" />,
    action: "new",
  },
  {
    name: "clear",
    description: "Clear current chat",
    icon: <Trash2Icon className="size-3.5" />,
    action: "clear",
  },
  {
    name: "rename",
    description: "Rename current chat",
    icon: <PenLineIcon className="size-3.5" />,
    action: "rename",
  },
  {
    name: "model",
    description: "Change the AI model",
    icon: <ListIcon className="size-3.5" />,
    action: "model",
  },
  {
    name: "theme",
    description: "Toggle dark/light mode",
    icon: <PaletteIcon className="size-3.5" />,
    action: "theme",
  },
  {
    name: "delete",
    description: "Delete current chat",
    icon: <XIcon className="size-3.5" />,
    action: "delete",
  },
  {
    name: "purge",
    description: "Delete all chats",
    icon: <BombIcon className="size-3.5" />,
    action: "purge",
  },
];

type SlashCommandMenuProps = {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  selectedIndex: number;
};

export function SlashCommandMenu({
  query,
  onSelect,
  onClose: _onClose,
  selectedIndex,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const filtered = slashCommands.filter((cmd) =>
    cmd.name.startsWith(query.toLowerCase()),
  );

  useEffect(() => {
    const selected = menuRef.current?.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, []);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div
      className="border-border/50 bg-card/95 absolute right-0 bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border shadow-[var(--shadow-float)] backdrop-blur-xl"
      ref={menuRef}
    >
      <div className="text-muted-foreground/40 px-4 py-2.5 text-[10px] font-medium tracking-wider uppercase">
        Commands
      </div>
      <div className="no-scrollbar max-h-64 overflow-y-auto pb-1">
        {filtered.map((cmd, index) => (
          <button
            className={cn(
              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
              index === selectedIndex ? "bg-muted/70" : "hover:bg-muted/40",
            )}
            data-selected={index === selectedIndex}
            key={cmd.name}
            onClick={() => onSelect(cmd)}
            onMouseDown={(e) => e.preventDefault()}
            type="button"
          >
            <div className="text-muted-foreground/60 flex size-6 shrink-0 items-center justify-center">
              {cmd.icon}
            </div>
            <span className="text-foreground font-mono text-[13px]">
              /{cmd.name}
            </span>
            <span className="text-muted-foreground/50 text-[12px]">
              {cmd.description}
            </span>
            {cmd.shortcut && (
              <span className="text-muted-foreground/30 ml-auto text-[11px]">
                {cmd.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

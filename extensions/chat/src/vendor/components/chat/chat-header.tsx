"use client";

// KIT ADAPTATION (see VENDOR.md): upstream's header carried the sidebar
// toggle, Vercel branding and the visibility selector. The kit's app shell
// owns the global header, so this is a slim chat-area bar: a mobile history
// drawer (the lg+ history panel lives in the chat screen) and a new-chat
// action.

import { HistoryIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { CHAT_PATH } from "../../lib/constants";
import type { VisibilityType } from "./visibility-selector";
import { SidebarHistory } from "./sidebar-history";

function PureChatHeader({
  user,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  user?: { id: string } | null;
}) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="flex h-12 items-center gap-2 px-3 lg:hidden">
      <Sheet onOpenChange={setHistoryOpen} open={historyOpen}>
        <SheetTrigger asChild>
          <Button size="icon-sm" variant="ghost">
            <HistoryIcon className="size-4" />
            <span className="sr-only">Chat history</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-80 overflow-y-auto p-2" side="left">
          <SheetHeader className="px-2 py-1">
            <SheetTitle className="text-sm">Chats</SheetTitle>
          </SheetHeader>
          <SidebarHistory setOpenMobile={setHistoryOpen} user={user} />
        </SheetContent>
      </Sheet>

      <Button
        className="ml-auto"
        onClick={() => router.push(CHAT_PATH)}
        size="sm"
        variant="outline"
      >
        <PlusIcon className="size-4" />
        New chat
      </Button>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.user?.id === nextProps.user?.id
  );
});

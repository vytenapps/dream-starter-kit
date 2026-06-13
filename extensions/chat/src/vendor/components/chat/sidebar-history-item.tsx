// KIT ADAPTATION (see VENDOR.md): upstream rendered into the app sidebar via
// shadcn sidebar primitives and offered a public/private share submenu. The
// kit renders chat history as an in-page panel (the host shell owns the app
// sidebar) and chats are private-only this phase, so this is a plain row with
// a delete action.
import Link from "next/link";
import { memo } from "react";
import { CHAT_PATH } from "../../lib/constants";
import type { Chat } from "../../lib/db/schema";
import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { MoreHorizontalIcon, TrashIcon } from "./icons";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  return (
    <div
      className={cn(
        "group/item relative flex h-8 items-center rounded-md text-[13px] transition-colors",
        isActive
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Link
        className="min-w-0 flex-1 truncate px-2 py-1.5"
        href={`${CHAT_PATH}/${chat.id}`}
        onClick={() => setOpenMobile(false)}
      >
        <span className="truncate">{chat.title}</span>
      </Link>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
              isActive
                ? ""
                : "opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100 data-[state=open]:opacity-100",
            )}
            type="button"
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem
            onSelect={() => onDelete(chat.id)}
            variant="destructive"
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  return true;
});

"use client";

// KIT ADAPTATION (see VENDOR.md): upstream rendered into the app sidebar via
// shadcn sidebar primitives with a next-auth User. The kit's host shell owns
// the app sidebar, so this renders as an in-page history panel; the user prop
// is the minimal { id } shape from the Supabase session. Fetch URLs go
// through the extension dispatcher (API_BASE) and chat links use CHAT_PATH.
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { motion } from "motion/react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";

import type { Chat } from "../../lib/db/schema";
import { API_BASE, CHAT_PATH } from "../../lib/constants";
import { fetcher } from "../../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { LoaderIcon } from "./icons";
import { ChatItem } from "./sidebar-history-item";

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `${API_BASE}/history?limit=${PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `${API_BASE}/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

const GROUP_LABEL_CLASS =
  "px-2 py-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.12em]";

export function SidebarHistory({
  user,
  setOpenMobile = () => undefined,
}: {
  user: { id: string } | null | undefined;
  setOpenMobile?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const id = pathname?.startsWith(`${CHAT_PATH}/`)
    ? pathname.slice(CHAT_PATH.length + 1).split("/")[0]
    : null;

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(
    user ? getChatHistoryPaginationKey : () => null,
    fetcher,
    { fallbackData: [], revalidateOnFocus: false },
  );

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = () => {
    const chatToDelete = deleteId;
    const isCurrentChat = pathname === `${CHAT_PATH}/${chatToDelete}`;

    setShowDeleteDialog(false);

    if (isCurrentChat) {
      router.replace(CHAT_PATH);
    }

    void mutate((chatHistories) => {
      if (chatHistories) {
        return chatHistories.map((chatHistory) => ({
          ...chatHistory,
          chats: chatHistory.chats.filter((chat) => chat.id !== chatToDelete),
        }));
      }
    });

    void fetch(`${API_BASE}/thread?id=${chatToDelete}`, { method: "DELETE" });

    toast.success("Chat deleted");
  };

  if (!user) {
    return (
      <div className="text-muted-foreground flex w-full flex-row items-center justify-center gap-2 px-2 py-4 text-[13px]">
        Login to save and revisit previous chats!
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <div className={GROUP_LABEL_CLASS}>History</div>
        <div className="flex flex-col gap-0.5 px-1">
          {[44, 32, 28, 64, 52].map((item) => (
            <div
              className="flex h-8 items-center gap-2 rounded-lg px-2"
              key={item}
            >
              <div
                className="bg-muted-foreground/10 h-3 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md"
                style={
                  {
                    "--skeleton-width": `${item}%`,
                  } as React.CSSProperties
                }
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <div>
        <div className={GROUP_LABEL_CLASS}>History</div>
        <div className="text-muted-foreground flex w-full flex-row items-center justify-center gap-2 px-2 py-2 text-[13px]">
          Your conversations will appear here once you start chatting!
        </div>
      </div>
    );
  }

  const renderGroup = (label: string, chats: Chat[]) =>
    chats.length > 0 ? (
      <div>
        <div className={GROUP_LABEL_CLASS}>{label}</div>
        {chats.map((chat) => (
          <ChatItem
            chat={chat}
            isActive={chat.id === id}
            key={chat.id}
            onDelete={(chatId) => {
              setDeleteId(chatId);
              setShowDeleteDialog(true);
            }}
            setOpenMobile={setOpenMobile}
          />
        ))}
      </div>
    ) : null;

  return (
    <>
      <div className="flex flex-col px-1">
        {paginatedChatHistories &&
          (() => {
            const chatsFromHistory = paginatedChatHistories.flatMap(
              (paginatedChatHistory) => paginatedChatHistory.chats,
            );

            const groupedChats = groupChatsByDate(chatsFromHistory);

            return (
              <div className="flex flex-col gap-4">
                {renderGroup("Today", groupedChats.today)}
                {renderGroup("Yesterday", groupedChats.yesterday)}
                {renderGroup("Last 7 days", groupedChats.lastWeek)}
                {renderGroup("Last 30 days", groupedChats.lastMonth)}
                {renderGroup("Older", groupedChats.older)}
              </div>
            );
          })()}

        <motion.div
          onViewportEnter={() => {
            if (!isValidating && !hasReachedEnd) {
              void setSize((size) => size + 1);
            }
          }}
        />

        {hasReachedEnd ? null : (
          <div className="text-muted-foreground mt-1 flex flex-row items-center gap-2 px-4 py-2">
            <div className="animate-spin">
              <LoaderIcon />
            </div>
            <div className="text-[11px]">Loading...</div>
          </div>
        )}
      </div>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

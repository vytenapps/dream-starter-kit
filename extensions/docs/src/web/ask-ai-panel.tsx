"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { SendIcon, SparklesIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";

import { currentDocSlug, onAskAi } from "./ask-bus";

const SUGGESTIONS = [
  "How do I install the kit?",
  "How does GitHub doc sync work?",
  "What is an extension?",
];

/**
 * The "Ask AI" side panel (shadcn-styled radix Dialog as a right sheet).
 * Streams a grounded answer from POST /api/ext/docs/ask with the current page
 * as extra context; renders cited sources. Opens via the ask-bus, so the top
 * bar, Explain-more, and the selection toolbar all drive this one instance.
 * The /ask route is authed (golden rule #6); an anonymous visitor's request
 * 401s, which flips this to a sign-in CTA.
 */
export function AskAiPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const seededRef = useRef<string | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ext/docs/ask",
      prepareSendMessagesRequest({ messages }) {
        return {
          body: { messages, currentSlug: currentDocSlug() },
        };
      },
    }),
    onError: (error) => {
      if (/401|unauthor/i.test(error.message)) setNeedsAuth(true);
    },
  });
  const signedIn = !needsAuth;

  useEffect(
    () =>
      onAskAi((prompt) => {
        setOpen(true);
        if (prompt) seededRef.current = prompt;
      }),
    [],
  );

  // Send a seeded prompt once the panel is open.
  useEffect(() => {
    if (open && seededRef.current && signedIn) {
      const text = seededRef.current;
      seededRef.current = null;
      void sendMessage({ role: "user", parts: [{ type: "text", text }] });
    }
  }, [open, sendMessage, signedIn]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setInput("");
    void sendMessage({ role: "user", parts: [{ type: "text", text: value }] });
  };

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="bg-background data-[state=open]:animate-in data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <Dialog.Title className="flex items-center gap-2 text-sm font-semibold">
              <SparklesIcon className="size-4" /> Ask AI
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost">
                <XIcon className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Ask anything about the docs — answers are grounded in these
                  pages with links to the sources.
                </p>
                {signedIn ? (
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        className="text-muted-foreground hover:border-foreground/30 hover:text-foreground rounded-md border px-3 py-2 text-left transition-colors"
                        key={s}
                        onClick={() => submit(s)}
                        type="button"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              messages.map((m) => (
                <div
                  className={
                    m.role === "user" ? "text-foreground" : "text-foreground"
                  }
                  key={m.id}
                >
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    {m.role === "user" ? "You" : "AI"}
                  </div>
                  <div className="leading-relaxed whitespace-pre-wrap">
                    {m.parts
                      .filter((p) => p.type === "text")
                      .map((p) => (p as { text: string }).text)
                      .join("")}
                  </div>
                </div>
              ))
            )}
            {status === "submitted" || status === "streaming" ? (
              <div className="text-muted-foreground text-xs">Thinking…</div>
            ) : null}
          </div>

          <div className="border-t p-3">
            {signedIn ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(input);
                }}
              >
                <Input
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question…"
                  value={input}
                />
                <Button
                  disabled={!input.trim() || status === "streaming"}
                  size="icon"
                  type="submit"
                >
                  <SendIcon className="size-4" />
                </Button>
              </form>
            ) : (
              <a
                className="bg-foreground text-background block rounded-md px-3 py-2 text-center text-sm"
                href="/sign-in?redirectTo=/docs"
              >
                Sign in to ask the AI assistant
              </a>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

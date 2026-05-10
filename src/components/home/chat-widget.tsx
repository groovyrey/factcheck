"use client";

import { useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Loader2, MessageSquare, RotateCcw, Send, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UiChatMessage } from "./types";

export function ChatWidget(props: {
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onRestart: () => void;
  messages: UiChatMessage[];
  input: string;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const {
    isOpen,
    onToggleOpen,
    onClose,
    onRestart,
    messages,
    input,
    onInputChange,
    onSubmit,
    isLoading,
    error,
    onRetry,
  } = props;

  const visibleMessages = messages.filter((m) => m.role !== "system");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [isOpen, visibleMessages.length, isLoading]);

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40" onClick={onClose} />}

      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-4 max-w-[calc(100vw-2rem)]">
        {isOpen && (
          <Card className="w-full sm:w-[450px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Sparkles className="size-4" />
                  Chat with Shiki
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Ask Shiki questions based on the search findings
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRestart}
                  title="Restart Conversation"
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-3 sm:p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 p-2 bg-muted/5 rounded-md border min-h-0">
                {visibleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] rounded-lg p-3 text-sm break-words [overflow-wrap:anywhere] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <div
                        className={`prose prose-sm max-w-full overflow-x-auto space-y-3 ${
                          msg.role === "user"
                            ? "prose-invert dark:prose-neutral"
                            : "dark:prose-invert"
                        }`}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}

                {visibleMessages.length === 0 && (
                  <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-muted-foreground/50 italic text-xs gap-2">
                    <MessageSquare className="size-8 opacity-20" />
                    No messages yet. Ask something!
                  </div>
                )}

                {isLoading && visibleMessages[visibleMessages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-start">
                    <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm w-full">
                      <strong>Error:</strong>{" "}
                      {error.message || "An error occurred while fetching the response."}
                      <Button
                        variant="link"
                        size="sm"
                        className="text-destructive h-auto p-0 ml-2"
                        onClick={onRetry}
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={onSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={onInputChange}
                  placeholder="Ask a question..."
                  disabled={isLoading}
                  className="h-9 text-sm"
                />
                <Button type="submit" disabled={isLoading || !input.trim()} size="sm">
                  <Send className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Button
          size="lg"
          className="size-12 sm:size-14 rounded-full shadow-2xl transition-all duration-300 active:scale-95"
          onClick={onToggleOpen}
        >
          {isOpen ? (
            <X className="size-5 sm:size-6 animate-in zoom-in-50 duration-200" />
          ) : (
            <MessageSquare className="size-5 sm:size-6 animate-in zoom-in-50 duration-200" />
          )}
        </Button>
      </div>
    </>
  );
}

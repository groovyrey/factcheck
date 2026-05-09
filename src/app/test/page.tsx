"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, MessageSquare, X, RotateCcw, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function TestPage() {
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleChat = async () => {
    if (!chatInput || chatLoading) return;
    
    setError(null);
    const newUserMessage = { role: "user", content: chatInput };
    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/cloudflare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: updatedMessages
        }),
      });
      
      const data = await res.json();
      if (res.ok && data.text) {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.text }]);
      } else {
        setError(data.error || "Failed to get response from Cloudflare AI");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setChatLoading(false);
    }
  };

  const handleRestartChat = () => {
    setChatMessages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 container mx-auto max-w-4xl px-2 sm:px-4 py-4 sm:py-8 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col shadow-xl overflow-hidden mb-2 sm:mb-4 border-x-0 sm:border-x rounded-none sm:rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b px-4">
            <div className="space-y-1">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <MessageSquare className="size-5" />
                Chat Interface
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Testing Cloudflare AI with Kimi-k2.6</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRestartChat} title="Clear Chat">
              <RotateCcw className="size-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 bg-muted/5">
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12 sm:py-20">
                <div className="size-12 sm:size-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-6 sm:size-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-base sm:text-lg">Start a conversation</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm max-w-[280px] sm:max-w-sm">
                    Ask anything to the Cloudflare AI model. Your session is powered by Kimi-k2.6.
                  </p>
                </div>
              </div>
            )}
            
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 shadow-sm break-words [overflow-wrap:anywhere] ${
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-card text-card-foreground border rounded-tl-none"
                }`}>
                  <div className={`prose prose-sm ${msg.role === "user" ? "prose-invert" : "dark:prose-invert"} max-w-full overflow-x-auto`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-card border p-3 sm:p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="text-xs sm:text-sm text-muted-foreground italic">Thinking...</span>
                </div>
              </div>
            )}
            
            {error && (
              <div className="bg-destructive/10 text-destructive text-xs sm:text-sm p-3 sm:p-4 rounded-lg border border-destructive/20">
                <strong>Error:</strong> {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-3 sm:p-4 border-t bg-card">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => e.key === "Enter" && handleChat()}
                disabled={chatLoading}
                className="flex-1 py-4 sm:py-6 shadow-sm text-sm"
              />
              <Button onClick={handleChat} disabled={chatLoading || !chatInput} size="lg" className="px-4 sm:px-6">
                {chatLoading ? <Loader2 className="animate-spin" /> : <Send className="size-5" />}
              </Button>
            </div>
            <p className="text-[9px] sm:text-[10px] text-center text-muted-foreground mt-2 sm:mt-3 uppercase tracking-widest font-medium">
              Powered by Cloudflare AI & Kimi-k2.6
            </p>
          </div>
        </Card>
      </main>

      <footer className="border-t py-4">
        <div className="container mx-auto max-w-4xl px-4 flex justify-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            <span className="text-foreground font-bold">Research Tool</span> &copy; 2026
          </p>
        </div>
      </footer>
    </div>
  );
}

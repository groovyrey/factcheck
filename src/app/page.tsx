"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Sparkles, Loader2, Globe, ExternalLink, MessageSquare, X, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
  </svg>
);

const BingIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M13.2 2.5 5.5 8.1v13.4l8.5-4.4 7.5-3.3V2.5l-8.3 0z" />
  </svg>
);

const BaiduIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.28 2C6.98 2 2.68 6.3 2.68 11.6c0 5.3 4.3 9.6 9.6 9.6 5.3 0 9.6-4.3 9.6-9.6C21.88 6.3 17.58 2 12.28 2zm3.3 12.8c-0.6 0.6-1.5 1.1-2.4 1.2-1.3 0.2-2.7-0.1-3.6-1.1-0.9-1-1.1-2.4-0.6-3.7 0.5-1.3 1.8-2.1 3.2-2 1.3 0.1 2.3 0.9 2.7 2.1 0.1 0.4 0.1 0.8 0 1.2-0.1 0.4-0.3 0.7-0.5 1-0.8 0.9-1.9 1.1-2.8 0.9-0.9-0.2-1.6-0.8-1.8-1.7-0.2-0.9 0.1-1.9 0.8-2.5 0.7-0.6 1.7-0.8 2.6-0.6 0.9 0.2 1.6 0.8 1.9 1.6 0.2 0.5 0.2 1 0.1 1.5l-0.3 0.5z" />
  </svg>
);

const ScholarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zM5.63 11.09 12 14.6l6.37-3.51L12 7.59l-6.37 3.5z" />
  </svg>
);

const SEARCH_ENGINES = [
  { id: "langsearch", name: "Lang Search (Web)", icon: Globe },
  { id: "google", name: "Google Search (SerpApi)", icon: GoogleIcon },
  { id: "google_scholar", name: "Google Scholar (SerpApi)", icon: ScholarIcon },
  { id: "bing", name: "Bing Search (SerpApi)", icon: BingIcon },
  { id: "baidu", name: "Baidu Search (SerpApi)", icon: BaiduIcon },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState("langsearch");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [gemmaResponse, setGemmaResponse] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isChatOpen) {
      // Small delay to ensure the DOM is ready if it just opened
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [chatMessages, isChatOpen]);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setResults(null);
    setGemmaResponse("");
    setChatMessages([]);
    try {
      const searchPath = engine === "langsearch" ? "/api/search" : "/api/search/serp";
      const searchRes = await fetch(searchPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, engine }),
      });
      const searchData = await searchRes.json();
      const newResults = searchData.results || [];
      setResults(newResults);
      
      // Initialize chat with context
      if (newResults.length > 0) {
        const contextString = newResults.map((r: any, i: number) => 
          `[Result ${i+1}]\nTitle: ${r.name}\nURL: ${r.url}\nSnippet: ${r.snippet}`
        ).join("\n\n");

        setChatMessages([
          {
            role: "system",
            content: `You are SourceCheck, a world-class research and fact-checking assistant. Your goal is to provide comprehensive, verified, and well-structured answers.

CORE PROTOCOLS:
1. **Primary Source of Truth:** Use the provided search results for "${query}" as your starting point. Always prioritize information found in these results or through the "fetch_url" tool.
2. **Detailed Analysis:** Don't just provide a summary; analyze the content. Look for consensus among different sources and highlight any contradictions or conflicting information.
3. **Structured Formatting:** Use Markdown to make your answers easy to read. Utilize headings (##), bullet points, and bold text for key terms.
4. **Explicit Citations:** Every claim you make should ideally be linked to a source. Use format like "[Source: Website Name]" or "[Source 1]".
5. **Tool Usage Strategy:**
   - Use "fetch_url" if a snippet is too short or if you suspect critical details are missing.
   - Use "google_search" if the current results are insufficient to answer the user's question or if a new angle of research is required.
6. **Strict Disclosure:** If you must use your internal training knowledge to provide context or fill gaps, you MUST explicitly state: "Note: The following information is based on my general training data and was not found in the live search results."
7. **Proactive Assistance:** At the end of your response, suggest 2-3 logical follow-up questions or areas for deeper research based on what you found.

SEARCH RESULTS CONTEXT:
${contextString}`
          }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!results || results.length === 0) return;
    setSummarizing(true);
    try {
      const gemmaRes = await fetch("/api/gemma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          systemInstruction: "Provide ONLY a concise summary of the search results. Start directly with the findings. Do NOT include any introductory text, greetings, preamble, or concluding remarks. No 'Here is a summary' or similar phrases. Just the raw summary content in Markdown.",
          prompt: `QUERY: ${query}\n\nSEARCH RESULTS:\n${JSON.stringify(results, null, 2)}`
        }),
      });
      const gemmaData = await gemmaRes.json();
      setGemmaResponse(gemmaData.text);
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizing(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput || chatLoading) return;
    const newUserMessage = { role: "user", content: chatInput };
    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: updatedMessages
        }),
      });
      const data = await res.json();
      if (data.text) {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.text }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleRestartChat = () => {
    // Keep system message if results exist
    if (results && results.length > 0) {
      const systemMessage = chatMessages.find(m => m.role === "system");
      setChatMessages(systemMessage ? [systemMessage] : []);
    } else {
      setChatMessages([]);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8 flex-1">
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">Search</h1>
            <p className="text-muted-foreground">Find what you need.</p>
          </div>

          <Card>
            <CardContent className="p-3 sm:p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1 min-w-0">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter search term..."
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-muted/30 h-10 sm:h-12"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="flex-1 md:w-64">
                  <Select value={engine} onValueChange={setEngine}>
                    <SelectTrigger className="bg-muted/30 h-10 sm:h-12">
                      <SelectValue placeholder="Engine">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {(() => {
                            const selectedEngine = SEARCH_ENGINES.find((e) => e.id === engine);
                            const Icon = selectedEngine?.icon || Search;
                            return <Icon className="size-3.5 shrink-0" />;
                          })()}
                          <span className="truncate">
                            {(() => {
                              const selectedEngine = SEARCH_ENGINES.find((e) => e.id === engine);
                              return selectedEngine?.name || "Engine";
                            })()}
                          </span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SEARCH_ENGINES.map((eng) => (
                        <SelectItem key={eng.id} value={eng.id}>
                          <div className="flex items-center gap-2">
                            <eng.icon className="size-3.5" />
                            <span>{eng.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSearch} disabled={loading} size="lg" className="h-10 sm:h-12 px-6">
                  {loading ? <Loader2 className="animate-spin" /> : "Go"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="animate-spin size-8 text-primary/40" />
            <p className="text-sm text-muted-foreground font-medium">Looking...</p>
          </div>
        )}

        {results && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">Results</CardTitle>
                    <CardDescription>AI summary of findings</CardDescription>
                  </div>
                  <Button 
                    onClick={handleSummarize} 
                    disabled={summarizing || results.length === 0}
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                  >
                    {summarizing ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                    {gemmaResponse ? "Update" : "Summarize"}
                  </Button>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  {summarizing ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="animate-spin size-8 text-primary/20" />
                      <p className="text-sm text-muted-foreground">AI is writing your summary...</p>
                    </div>
                  ) : gemmaResponse ? (
                    <div className="flex justify-start">
                      <div className="max-w-full rounded-lg p-4 text-sm break-words [overflow-wrap:anywhere] bg-muted text-foreground border shadow-sm">
                        <div className="prose prose-sm dark:prose-invert max-w-full">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {gemmaResponse}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-muted/10 rounded-lg border border-dashed">
                      <Sparkles className="size-8 text-muted-foreground/20" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">No summary yet</p>
                        <p className="text-xs text-muted-foreground max-w-[240px]">
                          Click the Summarize button to get an AI-generated report from these results.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Search Results</h2>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold text-muted-foreground">
                  {results.length} NODES
                </span>
              </div>
              
              <div className="space-y-4">
                {results.map((res: any, i: number) => (
                  <Card key={i} className="hover:border-primary/50 transition-colors shadow-none">
                    <CardHeader className="p-4 pb-2">
                      <a 
                        href={res.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="font-bold text-sm leading-tight hover:underline flex items-start justify-between gap-2"
                      >
                        <span className="flex-1 line-clamp-2">{res.name}</span>
                        <ExternalLink className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                      </a>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                        {res.snippet}
                      </p>
                      {res.url && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase truncate border-t pt-2">
                          <Globe className="size-2.5" />
                          {new URL(res.url).hostname}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-6 mt-12">
        <div className="container mx-auto max-w-6xl px-4 flex justify-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Developed and Maintained by: <span className="text-foreground font-bold">Rey</span>
          </p>
        </div>
      </footer>

      {/* Floating Chat Widget Backdrop */}
      {isChatOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsChatOpen(false)}
        />
      )}

      {/* Floating Chat Widget */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-4 max-w-[calc(100vw-2rem)]">
        {isChatOpen && (
          <Card className="w-full sm:w-[450px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Sparkles className="size-4" />
                  Chat about Results
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Ask questions based on the search findings</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleRestartChat} title="Restart Conversation">
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-3 sm:p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 p-2 bg-muted/5 rounded-md border min-h-0">
                {chatMessages.filter(m => m.role !== "system").map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[90%] sm:max-w-[85%] rounded-lg p-3 text-sm break-words [overflow-wrap:anywhere] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      <div className={`prose prose-sm ${msg.role === "user" ? "prose-invert" : "dark:prose-invert"} max-w-full overflow-x-auto`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {chatMessages.filter(m => m.role !== "system").length === 0 && (
                  <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-muted-foreground/50 italic text-xs gap-2">
                    <MessageSquare className="size-8 opacity-20" />
                    No messages yet. Ask something!
                  </div>
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question..."
                  onKeyDown={(e) => e.key === "Enter" && handleChat()}
                  disabled={chatLoading}
                  className="h-9 text-sm"
                />
                <Button onClick={handleChat} disabled={chatLoading} size="sm">
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Button 
          size="lg" 
          className="size-12 sm:size-14 rounded-full shadow-2xl transition-all duration-300 active:scale-95"
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          {isChatOpen ? (
            <X className="size-5 sm:size-6 animate-in zoom-in-50 duration-200" />
          ) : (
            <MessageSquare className="size-5 sm:size-6 animate-in zoom-in-50 duration-200" />
          )}
        </Button>
      </div>
    </div>
  );
}

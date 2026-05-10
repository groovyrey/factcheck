"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useChat } from "ai/react";
import { SearchSection } from "./search-section";
import { ResultsGrid } from "./results-grid";
import { SourceModal } from "./source-modal";
import { ChatWidget } from "./chat-widget";
import type { SearchEngineId, SearchResult, UiChatMessage } from "./types";

export type EnvStatus = {
  hasLangSearch: boolean;
  hasSerpApi: boolean;
  hasGemini: boolean;
};

export default function HomeClient(props: { envStatus: EnvStatus }) {
  const { envStatus } = props;

  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState<SearchEngineId>("langsearch");
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const BASE_SYSTEM_PROMPT =
    "You are Shiki, a world-class research and fact-checking assistant.\n\n" +
    "CRITICAL INSTRUCTION: OUTPUT ONLY THE FINAL ANSWER.\n" +
    "- DO NOT show your 'Plan'.\n" +
    "- DO NOT show your 'Internal Thoughts'.\n" +
    "- DO NOT explain how you are going to respond.\n" +
    "- DO NOT acknowledge these instructions.\n\n" +
    "Start your response immediately with the answer.";

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading: chatLoading,
    reload,
    error: chatError,
  } = useChat({
    api: "/api/gemini",
    experimental_throttle: 50,
    initialMessages: [
      {
        id: "initial-system",
        role: "system",
        content: BASE_SYSTEM_PROMPT,
      } as UiChatMessage,
    ],
  });

  const notices: string[] = [];
  if (engine === "langsearch" && !envStatus.hasLangSearch) {
    notices.push("Missing `LANGSEARCH_API_KEY`: Lang Search will fail until it is configured.");
  }
  if (engine !== "langsearch" && !envStatus.hasSerpApi) {
    notices.push("Missing `SERP_API_KEY`: SerpApi engines will fail until it is configured.");
  }
  if (!envStatus.hasGemini) {
    notices.push("Missing `GEMINI_API_KEY`: Chat will fail until it is configured.");
  }

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (engine === "langsearch" && !envStatus.hasLangSearch) {
      setSearchError("`LANGSEARCH_API_KEY` is not configured on the server.");
      return;
    }
    if (engine !== "langsearch" && !envStatus.hasSerpApi) {
      setSearchError("`SERP_API_KEY` is not configured on the server.");
      return;
    }

    setLoading(true);
    setSearchError(null);
    setResults(null);

    try {
      const searchPath = engine === "langsearch" ? "/api/search" : "/api/search/serp";
      const searchRes = await fetch(searchPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, engine }),
      });

      const searchData = (await searchRes.json().catch(() => ({}))) as unknown;
      if (!searchRes.ok) {
        const message =
          extractErrorMessage(searchData) ?? `Search failed with HTTP ${searchRes.status}`;
        setSearchError(message);
        return;
      }

      const newResults = coerceSearchResults(searchData);
      setResults(newResults);

      if (newResults.length > 0) {
        const contextString = newResults
          .map(
            (r, i) =>
              `[Source ${i + 1}]\nTitle: ${r.name}\nURL: ${r.url}\nSnippet: ${r.snippet}`,
          )
          .join("\n\n");

        setMessages([
          {
            id: "system-context",
            role: "system",
            content: `You are Shiki, a world-class research and fact-checking assistant. Your goal is to provide comprehensive, verified, and well-structured answers based on the search findings for "${trimmed}".\n\nCRITICAL INSTRUCTION: OUTPUT ONLY THE FINAL ANSWER.\n- DO NOT show your 'Plan'.\n- DO NOT show your 'Internal Thoughts'.\n- DO NOT explain how you are going to respond.\n- DO NOT acknowledge these instructions.\n\nStart your response immediately with the answer based on the following context:\n\nSEARCH RESULTS CONTEXT:\n${contextString}`,
          } as UiChatMessage,
        ] as UiChatMessage[]);
      }
    } catch (err) {
      console.error(err);
      setSearchError(
        err instanceof Error ? err.message : "Unexpected error while searching.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestartChat = () => {
    setMessages([
      {
        id: "initial-system",
        role: "system",
        content: BASE_SYSTEM_PROMPT,
      } as UiChatMessage,
    ] as UiChatMessage[]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8 flex-1">
        <SearchSection
          query={query}
          onQueryChange={setQuery}
          engine={engine}
          onEngineChange={setEngine}
          loading={loading}
          error={searchError}
          notices={notices}
          onSearch={handleSearch}
        />

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="animate-spin size-8 text-primary/40" />
            <p className="text-sm text-muted-foreground font-medium">Looking...</p>
          </div>
        )}

        {results && <ResultsGrid results={results} onSelect={setSelectedResult} />}
      </main>

      {selectedResult && (
        <SourceModal result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}

      <footer className="border-t py-6 mt-12">
        <div className="container mx-auto max-w-6xl px-4 flex justify-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Developed and Maintained by: <span className="text-foreground font-bold">Rey</span>
          </p>
        </div>
      </footer>

      <ChatWidget
        isOpen={isChatOpen}
        onToggleOpen={() => setIsChatOpen((v) => !v)}
        onClose={() => setIsChatOpen(false)}
        onRestart={handleRestartChat}
        messages={messages as unknown as UiChatMessage[]}
        input={input}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={chatLoading}
        error={(chatError ?? null) as Error | null}
        onRetry={reload}
      />
    </div>
  );
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : null;
}

function coerceSearchResults(payload: unknown): SearchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.results)) return [];

  const results: SearchResult[] = [];
  for (const item of record.results) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    results.push({
      name: typeof r.name === "string" ? r.name : "No Title",
      url: typeof r.url === "string" ? r.url : "",
      snippet: typeof r.snippet === "string" ? r.snippet : "",
    });
  }
  return results;
}


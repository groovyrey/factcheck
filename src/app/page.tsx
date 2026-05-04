"use client";

import { useState } from "react";
import { Search, Sparkles, Loader2, Globe, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
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

const SEARCH_ENGINES = [
  { id: "langsearch", name: "Lang Search (Web)", icon: Globe },
  { id: "google", name: "Google Search (SerpApi)", icon: Search },
  { id: "google_scholar", name: "Google Scholar (SerpApi)", icon: Search },
  { id: "bing", name: "Bing Search (SerpApi)", icon: Search },
  { id: "baidu", name: "Baidu Search (SerpApi)", icon: Search },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState("langsearch");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [gemmaResponse, setGemmaResponse] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setResults(null);
    setGemmaResponse("");
    try {
      const searchPath = engine === "langsearch" ? "/api/search" : "/api/search/serp";
      const searchRes = await fetch(searchPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, engine }),
      });
      const searchData = await searchRes.json();
      setResults(searchData.results || []);
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
          systemInstruction: "You are a neutral research assistant. Your ONLY task is to summarize the search results provided by the user. Do NOT repeat these instructions. Do NOT include any introduction, preamble, or concluding remarks. Do NOT mention the search engine or the process. Use clean Markdown formatting. Start directly with the findings.",
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-bold tracking-tight text-lg">Research Tool</span>
          </div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider bg-muted px-2 py-1 rounded">
            v1.0.0
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">Search and Summarize</h1>
            <p className="text-muted-foreground">Pick a search engine and get an AI summary of the results.</p>
          </div>

          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you want to search for?"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-muted/30"
                />
              </div>
              <div className="md:w-64">
                <Select value={engine} onValueChange={setEngine}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue placeholder="Select Engine" />
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
              <Button onClick={handleSearch} disabled={loading} size="lg">
                {loading ? <Loader2 className="animate-spin" /> : "Search"}
              </Button>
            </CardContent>
          </Card>
        </section>

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="animate-spin size-8 text-primary/40" />
            <p className="text-sm text-muted-foreground font-medium">Searching {engine.replace("_", " ")}...</p>
          </div>
        )}

        {results && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">AI Summary</CardTitle>
                    <CardDescription>Synthesized intelligence report</CardDescription>
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
                <CardContent className="pt-6 overflow-x-auto">
                  {summarizing ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="animate-spin size-8 text-primary/20" />
                      <p className="text-sm text-muted-foreground">AI is writing your summary...</p>
                    </div>
                  ) : gemmaResponse ? (
                    <div className="prose prose-sm dark:prose-invert max-w-full [overflow-wrap:anywhere] [word-break:break-word] overflow-hidden">
                      <ReactMarkdown>
                        {gemmaResponse}
                      </ReactMarkdown>
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
    </div>
  );
}

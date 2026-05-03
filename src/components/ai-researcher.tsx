"use client";

import { FormEvent, useState, useEffect } from "react";
import {
  ArrowRight,
  Clipboard,
  Database,
  Download,
  ExternalLink,
  Globe2,
  ListChecks,
  Loader2,
  Search,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type WebSearchResult = {
  id: string;
  name: string;
  url: string;
  snippet: string;
};

type WebSearchImage = {
  name: string;
  thumbnailUrl: string;
  contentUrl: string;
  hostPageUrl: string;
};

type WebSearchVideo = {
  name: string;
  thumbnailUrl: string;
  contentUrl: string;
  hostPageUrl: string;
  embedHtml: string;
};

type AnalysisResult = {
  analysis: ResearchAnalysis;
  model: string;
};

type ResearchEvidence = {
  source?: string;
  url?: string;
  note?: string;
};

type ResearchAnalysis = {
  entity?: string;
  summary?: string;
  credibilityScore?: number;
  verdict?: "likely_reliable" | "unclear" | "potentially_misleading" | string;
  confidence?: "low" | "medium" | "high" | string;
  positiveSignals?: string[];
  negativeSignals?: string[];
  evidence?: ResearchEvidence[];
  relatedEntities?: string[];
  recommendedNextStep?: string;
  searchQueries?: string[];
  rawText?: string;
  parseWarning?: string;
};

const EXAMPLE_QUERY = "A viral claim that a city banned cash payments in 2026";

export function AiResearcher() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WebSearchResult[]>([]);
  const [images, setImages] = useState<WebSearchImage[]>([]);
  const [videos, setVideos] = useState<WebSearchVideo[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"input" | "results">("input");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("reywright-research");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setQuery(parsed.query || "");
        setResults(parsed.results || []);
        setImages(parsed.images || []);
        setVideos(parsed.videos || []);
        setAnalysis(parsed.analysis || null);
        if (parsed.results?.length > 0 || parsed.analysis) {
          setMobilePanel("results");
        }
      } catch (e) {
        console.error("Failed to parse saved research session", e);
      }
    }
  }, []);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (!query) return;

    setLoading(true);
    setError("");
    setResults([]);
    setImages([]);
    setVideos([]);
    setAnalysis(null);

    try {
      const response = await fetch("/api/search/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, count: 5 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setResults(data.results || []);
      setImages(data.images || []);
      setVideos(data.videos || []);
      setMobilePanel("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (results.length === 0) return;

    setAnalyzing(true);
    try {
      const response = await fetch("/api/ai/analyze-author", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          author: query, 
          webSearch: { results, images, videos } 
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data);
      setMobilePanel("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  const copySummary = () => {
    const summary = analysis?.analysis.summary || analysis?.analysis.rawText || "";
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const buildMarkdown = () => {
    if (!analysis) return "";
    const itemList = (items?: string[]) => items?.map((item) => `- ${item}`).join("\n") || "- None";
    const evidence = analysis.analysis.evidence
      ?.map((item) => `- [${item.source || "Source"}](${item.url || "#"}) - ${item.note || ""}`)
      .join("\n") || "- None";

    return `# Research Report: ${analysis.analysis.entity || query}

## Summary
${analysis.analysis.summary || analysis.analysis.rawText || "No summary returned."}

## Assessment
- Verdict: ${analysis.analysis.verdict || "Unknown"}
- Confidence: ${analysis.analysis.confidence || "Unknown"}
- Credibility score: ${analysis.analysis.credibilityScore ?? "Unknown"}

## Positive Signals
${itemList(analysis.analysis.positiveSignals)}

## Red Flags
${itemList(analysis.analysis.negativeSignals)}

## Evidence
${evidence}

## Next Step
${analysis.analysis.recommendedNextStep || "No next step returned."}
`;
  };

  const downloadMarkdown = () => {
    const markdown = buildMarkdown();
    if (!markdown) return;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "research-report.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveSession = () => {
    if (!analysis) return;
    localStorage.setItem("reywright-research", JSON.stringify({ query, results, images, videos, analysis }));
  };

  const verdictLabel = analysis?.analysis.verdict?.replaceAll("_", " ") || "Unscored";
  const credibility = analysis?.analysis.credibilityScore ?? 0;

  return (
    <div className="w-full min-w-0 space-y-8 animate-in fade-in duration-700 lg:space-y-12">
      <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1 lg:hidden">
        <Button variant={mobilePanel === "input" ? "secondary" : "ghost"} size="sm" onClick={() => setMobilePanel("input")}>
          Input
        </Button>
        <Button variant={mobilePanel === "results" ? "secondary" : "ghost"} size="sm" onClick={() => setMobilePanel("results")}>
          Results
        </Button>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-12">
        {/* Input Section */}
        <div className={`${mobilePanel === "input" ? "block" : "hidden"} min-w-0 space-y-6 lg:col-span-3 lg:block`}>
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Globe2 className="size-3" />
              Intelligence Query
            </h2>
          </div>
          <form onSubmit={handleSearch} className="flex flex-col gap-8">
            <div className="relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter topic, entity, or fragment to investigate..."
                className="h-36 w-full resize-y border-none bg-transparent p-0 font-serif text-sm leading-relaxed outline-none ring-0 placeholder:text-muted-foreground/20 focus:ring-0 sm:h-40"
              />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button type="submit" disabled={loading} className="h-auto min-h-9 w-full whitespace-normal rounded-md px-4 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm sm:w-auto sm:px-6 sm:tracking-widest">
                  {loading ? <Loader2 className="animate-spin size-3" /> : "Initiate Signal Discovery"}
                </Button>
                <Button type="button" variant="ghost" className="h-9 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" onClick={() => setQuery(EXAMPLE_QUERY)}>
                  Try Example
                </Button>
              </div>
            </div>
          </form>

          {error && (
            <div className="p-4 rounded-lg bg-destructive/5 text-destructive border border-destructive/10">
              <p className="text-[10px] font-bold">{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className={`${mobilePanel === "results" ? "block" : "hidden"} min-w-0 space-y-8 border-t pt-8 lg:sticky lg:top-20 lg:col-span-2 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-auto lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0`}>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 border-b pb-2">
            <ArrowRight className="size-3" />
            Intelligence Stream
          </h2>

          {results.length === 0 && !loading && !analyzing && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/5 p-8 py-16 text-center text-muted-foreground">
              <Search className="size-5 opacity-35" />
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">No evidence collected yet</p>
                <p className="max-w-xs text-[11px] leading-relaxed">Search a claim, source, person, organization, or topic to build a research trail.</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-20 flex flex-col items-center justify-center text-center animate-pulse">
              <Loader2 className="animate-spin size-6 text-primary/40 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Mapping Web signals</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Source Nodes</h3>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={handleAnalyze} 
                    disabled={analyzing}
                    className="gap-2 p-0 h-auto font-bold text-primary text-[9px] uppercase tracking-tighter"
                  >
                    {analyzing ? <Loader2 className="animate-spin size-3" /> : "Run Synthesis"}
                  </Button>
                </div>
                <div className="space-y-8">
                  {results.map((result, i) => (
                    <div key={i} className="group min-w-0 space-y-1">
                      <a href={result.url} target="_blank" rel="noreferrer" className="block break-words text-xs font-bold leading-tight transition-colors hover:text-primary">
                        {result.name}
                      </a>
                      <p className="line-clamp-3 whitespace-pre-wrap break-words font-serif text-[10px] leading-relaxed text-muted-foreground">
                        {result.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-8 border-t">
                <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Visual Data</h3>
                {images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {images.slice(0, 4).map((img, i) => (
                      <a
                        key={i}
                        href={img.hostPageUrl || img.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md grayscale hover:grayscale-0 transition-all duration-700 border border-black/5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.thumbnailUrl}
                          alt={img.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] italic text-muted-foreground">No visual nodes detected.</p>
                )}
              </div>

              {analysis && (
                <div className="space-y-6 border-t pt-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Research Report</h3>
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase px-1.5 py-0.5 rounded border border-black/5">
                      {analysis.model}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border bg-muted/10 p-3">
                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Credibility</p>
                      <p className="mt-1 text-2xl font-black">{credibility}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
                        <div className="h-full rounded bg-primary" style={{ width: `${Math.min(Math.max(credibility, 0), 100)}%` }} />
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/10 p-3">
                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Verdict</p>
                      <p className="mt-2 break-words text-xs font-black capitalize">{verdictLabel}</p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{analysis.analysis?.confidence || "unknown"} confidence</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      <ListChecks className="size-3" />
                      Summary
                    </h4>
                    <p className="whitespace-pre-wrap break-words border-l-2 border-primary/10 pl-4 font-serif text-xs leading-relaxed text-foreground/75">
                      {analysis.analysis?.summary || analysis.analysis?.rawText || "No summary returned."}
                    </p>
                  </div>

                  <div className="grid gap-4 min-[520px]:grid-cols-2">
                    <div className="space-y-3">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Signals</h4>
                      {(analysis.analysis?.positiveSignals || []).slice(0, 4).map((signal, i) => (
                        <p key={i} className="break-words rounded-md bg-muted/20 p-2 text-[10px] leading-relaxed text-foreground/70">{signal}</p>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        <ShieldAlert className="size-3" />
                        Red Flags
                      </h4>
                      {(analysis.analysis?.negativeSignals || []).slice(0, 4).map((signal, i) => (
                        <p key={i} className="break-words rounded-md bg-destructive/5 p-2 text-[10px] leading-relaxed text-foreground/70">{signal}</p>
                      ))}
                    </div>
                  </div>

                  {(analysis.analysis?.evidence || []).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Evidence Trail</h4>
                      {analysis.analysis?.evidence?.slice(0, 5).map((item, i) => (
                        <a key={i} href={item.url} target="_blank" rel="noreferrer" className="block min-w-0 rounded-md border p-3 transition-colors hover:bg-muted/20">
                          <span className="flex items-center justify-between gap-3">
                            <span className="break-words text-xs font-bold">{item.source || "Source"}</span>
                            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                          </span>
                          <span className="mt-1 block break-words text-[10px] leading-relaxed text-muted-foreground">{item.note}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Next Moves</h4>
                    <p className="break-words text-xs leading-relaxed text-foreground/75">{analysis.analysis?.recommendedNextStep || "No next step returned."}</p>
                    <div className="flex flex-wrap gap-2">
                      {(analysis.analysis?.searchQueries || []).slice(0, 3).map((item) => (
                        <button key={item} onClick={() => setQuery(item)} className="rounded border bg-muted/20 px-2 py-1 text-left text-[9px] font-bold uppercase tracking-tighter text-muted-foreground transition-colors hover:text-foreground">
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t pt-4">
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={copySummary}>
                      <Clipboard className="size-3" />
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={downloadMarkdown}>
                      <Download className="size-3" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={saveSession}>
                      <Database className="size-3" />
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

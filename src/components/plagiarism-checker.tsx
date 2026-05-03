"use client";

import { useEffect, useState } from "react";
import {
  Clipboard,
  Database,
  Download,
  ShieldCheck,
  Loader2,
  ExternalLink,
  AlertTriangle,
  FileText,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type PlagiarismEvidence = {
  originUrl: string;
  sourceTitle: string;
  matchCertainty: "low" | "medium" | "high";
  collidingSnippet: string;
  localFragment: string;
};

type PlagiarismAnalysis = {
  module: string;
  integrityReport: {
    attributionScore: number;
    verdict: string;
    riskLevel: string;
    forensicSummary: string;
  };
  evidenceChain: PlagiarismEvidence[];
  metadata?: {
    scannedPhrases?: string[];
    searchDepth?: string;
  };
};

const EXAMPLE_TEXT = "A new study proves that most people only use 10 percent of their brain, according to researchers who say the finding will change education forever.";

export function PlagiarismChecker() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PlagiarismAnalysis | null>(null);
  const [error, setError] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"input" | "results">("input");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("reywright-source-check");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setText(parsed.text || "");
        setAnalysis(parsed.analysis || null);
        if (parsed.analysis) {
          setMobilePanel("results");
        }
      } catch (e) {
        console.error("Failed to parse saved source-check session", e);
      }
    }
  }, []);

  async function handleCheck() {
    if (!text.trim()) return;

    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/ai/plagiarism", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Plagiarism check failed");
      setAnalysis(data.analysis);
      setMobilePanel("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Plagiarism check failed");
    } finally {
      setLoading(false);
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical":
        return "text-destructive";
      case "moderate":
        return "text-amber-600";
      default:
        return "text-green-600";
    }
  };

  const copySummary = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis.integrityReport.forensicSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const exportMarkdown = () => {
    if (!analysis) return;
    const markdown = `# Source Check Report

## Verdict
- Attribution match: ${analysis.integrityReport.attributionScore}%
- Verdict: ${analysis.integrityReport.verdict}
- Risk: ${analysis.integrityReport.riskLevel}

## Summary
${analysis.integrityReport.forensicSummary}

## Evidence Chain
${analysis.evidenceChain.map((item) => `- [${item.sourceTitle}](${item.originUrl}) (${item.matchCertainty}): ${item.collidingSnippet}`).join("\n") || "- No matching sources found."}

## Scanned Phrases
${analysis.metadata?.scannedPhrases?.map((item) => `- ${item}`).join("\n") || "- Not returned"}
`;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "source-check-report.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveSession = () => {
    if (!analysis) return;
    localStorage.setItem("reywright-source-check", JSON.stringify({ text, analysis }));
  };

  return (
    <div className="w-full min-w-0 space-y-8 animate-in fade-in duration-700">
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
              <FileText className="size-3" />
              Content Fragment
            </h2>
          </div>
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Submit content for source attribution intelligence..."
              className="h-72 w-full resize-y border-none bg-transparent p-0 font-serif text-sm leading-relaxed outline-none ring-0 placeholder:text-muted-foreground/20 focus:ring-0 sm:h-96 lg:h-[500px]"
            />
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <Button
                onClick={handleCheck}
                disabled={loading || !text.trim()}
                className="h-auto min-h-9 whitespace-normal rounded-md px-4 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm sm:px-6 sm:tracking-widest"
              >
                {loading ? (
                  <Loader2 className="animate-spin size-3 mr-2" />
                ) : (
                  <Search className="size-3 mr-2" />
                )}
                Analyze Origin Traces
              </Button>
              <Button variant="ghost" className="h-9 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" onClick={() => setText(EXAMPLE_TEXT)}>
                Try Example
              </Button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className={`${mobilePanel === "results" ? "block" : "hidden"} min-w-0 space-y-8 border-t pt-8 lg:sticky lg:top-20 lg:col-span-2 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-auto lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0`}>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 border-b pb-2">
            <ShieldCheck className="size-3" />
            Integrity Report
          </h2>

          {!analysis && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/5 p-8 py-16 text-center text-muted-foreground">
              <AlertTriangle className="size-5 opacity-35" />
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">No source scan yet</p>
                <p className="max-w-xs text-[11px] leading-relaxed">Paste a passage to search for distinctive phrase collisions and attribution risk.</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-20 flex flex-col items-center justify-center text-center animate-pulse">
              <div className="relative mb-4">
                <Loader2 className="animate-spin size-6 text-primary/40" />
                <ShieldCheck className="absolute inset-0 size-3 m-auto text-primary animate-pulse" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Scanning Origin Traces</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-destructive/5 text-destructive border border-destructive/10">
              <p className="text-[10px] font-bold">{error}</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
              {/* Score Gauge */}
              <div className="space-y-4">
                <div className="flex flex-col gap-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/60">Attribution Match</div>
                    <div className={`text-3xl font-black ${(analysis.integrityReport?.attributionScore ?? 0) > 20 ? 'text-destructive' : 'text-primary'}`}>
                      {analysis.integrityReport?.attributionScore ?? 0}%
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
                      <div className={`h-full rounded ${(analysis.integrityReport?.attributionScore ?? 0) > 20 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(Math.max(analysis.integrityReport?.attributionScore ?? 0, 0), 100)}%` }} />
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1 min-[420px]:text-right">
                    <div className="mb-1 inline-block rounded border border-current px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter">
                      {analysis.integrityReport?.verdict ?? "Unknown"}
                    </div>
                    <div className={`text-[9px] font-bold uppercase tracking-widest ${getRiskColor(analysis.integrityReport?.riskLevel ?? "low")}`}>
                      {analysis.integrityReport?.riskLevel ?? "unknown"} risk
                    </div>
                  </div>
                </div>
                <p className="whitespace-pre-wrap break-words border-l-2 border-primary/20 py-1 pl-4 text-xs leading-relaxed text-foreground/70 italic">
                  {analysis.integrityReport?.forensicSummary ?? "No summary provided."}
                </p>
              </div>

              {(analysis.metadata?.scannedPhrases || []).length > 0 && (
                <div className="space-y-3 border-t pt-8">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Search Fingerprints</h3>
                  {analysis.metadata?.scannedPhrases?.map((phrase) => (
                    <p key={phrase} className="break-words rounded-md bg-muted/20 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">{phrase}</p>
                  ))}
                </div>
              )}

              {/* Evidence Chain */}
              {analysis.evidenceChain.length > 0 && (
                <div className="space-y-6 border-t pt-8">
                  <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Evidence Chain</h3>
                  <div className="space-y-10">
                    {analysis.evidenceChain.map((evidence, i) => (
                      <div key={i} className="group min-w-0 space-y-2 rounded-md border-l-2 border-primary/10 pl-4">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <h4 className="min-w-0 break-words text-xs font-bold tracking-tight">
                            {evidence.sourceTitle}
                          </h4>
                          <a href={evidence.originUrl} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground transition-colors hover:text-primary">
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[8px] text-muted-foreground uppercase font-black flex items-center gap-1.5">
                            <span className={`size-1.5 rounded-full ${evidence.matchCertainty === 'high' ? 'bg-destructive' : 'bg-amber-500'}`} />
                            Collision Detected
                          </p>
                          <p className="whitespace-pre-wrap break-words border-l pl-3 font-mono text-[10px] leading-relaxed text-muted-foreground/80">
                            {evidence.collidingSnippet}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 border-t pt-4">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={copySummary}>
                  <Clipboard className="size-3" />
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={exportMarkdown}>
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
      </div>
    </div>
  );
}

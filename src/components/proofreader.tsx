"use client";

import { useEffect, useState } from "react";
import {
  Clipboard,
  Database,
  Download,
  Loader2,
  Sparkles,
  Type,
  AlignLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ProofreadDeviation = {
  category: "grammar" | "orthography" | "syntax" | "tone_clash";
  fragment: string;
  correction: string;
  rationale: string;
  criticality: "low" | "medium" | "high";
};

type ProofreadAnalysis = {
  module: string;
  audit: {
    authenticityScore: number;
    detectedTone: string;
    readabilityIndex: string;
    lexicalDensity: string;
    clarity?: {
      score: number;
      assessment: string;
    };
    conciseness?: {
      score: number;
      assessment: string;
    };
    engagement?: {
      score: number;
      assessment: string;
    };
  };
  deviations: ProofreadDeviation[];
  structuralImprovements: string[];
  reconstructedContent: string;
};

const EXAMPLE_TEXT = "The report are mostly accurate, but it don't explain where the numbers came from. This makes the claim sound stronger than it is.";

export function Proofreader() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ProofreadAnalysis | null>(null);
  const [error, setError] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"input" | "results">("input");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("reywright-proofread");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setText(parsed.text || "");
        setAnalysis(parsed.analysis || null);
        if (parsed.analysis) {
          setMobilePanel("results");
        }
      } catch (e) {
        console.error("Failed to parse saved proofread session", e);
      }
    }
  }, []);

  async function handleProofread() {
    if (!text.trim()) return;

    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/ai/proofread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Proofreading failed");
      setAnalysis(data.analysis);
      setMobilePanel("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Proofreading failed");
    } finally {
      setLoading(false);
    }
  }

  const applySuggestion = (deviation: ProofreadDeviation) => {
    if (!analysis) return;
    const newText = text.replace(deviation.fragment, deviation.correction);
    setText(newText);
    setAnalysis({
      ...analysis,
      deviations: analysis.deviations.filter((d) => d !== deviation),
    });
  };

  const copyResult = () => {
    if (!analysis?.reconstructedContent) return;
    navigator.clipboard.writeText(analysis.reconstructedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const exportMarkdown = () => {
    if (!analysis) return;
    const markdown = `# Proofread Report

## Audit
- Authenticity: ${analysis.audit.authenticityScore}%
- Tone: ${analysis.audit.detectedTone}
- Readability: ${analysis.audit.readabilityIndex}
- Lexical density: ${analysis.audit.lexicalDensity}
- Clarity: ${analysis.audit.clarity?.score ?? "Not scored"}% - ${analysis.audit.clarity?.assessment ?? "Not returned"}
- Conciseness: ${analysis.audit.conciseness?.score ?? "Not scored"}% - ${analysis.audit.conciseness?.assessment ?? "Not returned"}
- Engagement: ${analysis.audit.engagement?.score ?? "Not scored"}% - ${analysis.audit.engagement?.assessment ?? "Not returned"}

## Deviations
${analysis.deviations.map((item) => `- ${item.category} (${item.criticality}): ${item.fragment} -> ${item.correction}. ${item.rationale}`).join("\n") || "- None"}

## Structural Improvements
${analysis.structuralImprovements.map((item) => `- ${item}`).join("\n") || "- None"}

## Reconstructed Text
${analysis.reconstructedContent}
`;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "proofread-report.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveSession = () => {
    if (!analysis) return;
    localStorage.setItem("reywright-proofread", JSON.stringify({ text, analysis }));
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case "high":
        return "text-destructive border-destructive/20 bg-destructive/5";
      case "medium":
        return "text-amber-600 border-amber-600/20 bg-amber-50";
      default:
        return "text-blue-600 border-blue-600/20 bg-blue-50";
    }
  };

  const qualityMetrics = analysis
    ? [
        { label: "Clarity", metric: analysis.audit?.clarity },
        { label: "Conciseness", metric: analysis.audit?.conciseness },
        { label: "Engagement", metric: analysis.audit?.engagement },
      ]
    : [];

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
          <div className="flex flex-col gap-2 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <Type className="size-3" />
              Source Manuscript
            </h2>
            <div className="text-[9px] font-bold text-muted-foreground/50 uppercase">
              {text.length} chars | {text.split(/\s+/).filter(Boolean).length} words
            </div>
          </div>
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Submit text for forensic linguistic analysis..."
              className="h-72 w-full resize-y border-none bg-transparent p-0 font-serif text-sm leading-relaxed outline-none ring-0 placeholder:text-muted-foreground/20 focus:ring-0 sm:h-96 lg:h-[500px]"
            />
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
              <Button
                onClick={handleProofread}
                disabled={loading || !text.trim()}
                className="h-auto min-h-9 whitespace-normal rounded-md px-4 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm sm:px-6 sm:tracking-widest"
              >
                {loading ? (
                  <Loader2 className="animate-spin size-3 mr-2" />
                ) : (
                  <Sparkles className="size-3 mr-2" />
                )}
                Run Forensic Audit
              </Button>
              <Button
                onClick={() => setText("")}
                variant="ghost"
                className="h-9 text-muted-foreground text-[10px] font-bold uppercase tracking-wider"
              >
                Clear
              </Button>
              <Button
                onClick={() => setText(EXAMPLE_TEXT)}
                variant="ghost"
                className="h-9 text-muted-foreground text-[10px] font-bold uppercase tracking-wider"
              >
                Try Example
              </Button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className={`${mobilePanel === "results" ? "block" : "hidden"} min-w-0 space-y-8 border-t pt-8 lg:sticky lg:top-20 lg:col-span-2 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-auto lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0`}>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 border-b pb-2">
            <AlignLeft className="size-3" />
            Audit Report
          </h2>

          {!analysis && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/5 p-8 py-16 text-center text-muted-foreground">
              <AlignLeft className="size-5 opacity-35" />
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Ready to review</p>
                <p className="max-w-xs text-[11px] leading-relaxed">Paste a draft to get severity-ranked edits, tone notes, and a clean reconstruction.</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-20 flex flex-col items-center justify-center text-center animate-pulse">
              <Loader2 className="animate-spin size-6 text-primary/40 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Audit in Progress</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-destructive/5 text-destructive border border-destructive/10">
              <p className="text-[10px] font-bold">{error}</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
              {/* Score Card */}
              <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 min-[420px]:gap-x-8 min-[420px]:gap-y-6">
                <div className="min-w-0 space-y-1">
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/60">Authenticity</div>
                  <div className="text-xl font-bold text-primary">{analysis.audit?.authenticityScore ?? 0}%</div>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/60">Tone</div>
                  <div className="break-words text-xs font-bold">{analysis.audit?.detectedTone ?? "Unknown"}</div>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/60">Readability</div>
                  <div className="break-words text-xs font-bold">{analysis.audit?.readabilityIndex ?? "Unknown"}</div>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/60">Lexical</div>
                  <div className="break-words text-xs font-bold">{analysis.audit?.lexicalDensity ?? "Unknown"}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-1.5 overflow-hidden rounded bg-muted">
                  <div className="h-full rounded bg-primary" style={{ width: `${Math.min(Math.max(analysis.audit?.authenticityScore ?? 0, 0), 100)}%` }} />
                </div>
              </div>

              {qualityMetrics.some((item) => item.metric) && (
                <div className="grid gap-3 border-t pt-8">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Writing Quality</h3>
                  {qualityMetrics.map(({ label, metric }) => (
                    metric && (
                      <div key={label} className="rounded-md border bg-muted/10 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                          <p className="text-sm font-black">{metric.score}%</p>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
                          <div className="h-full rounded bg-primary" style={{ width: `${Math.min(Math.max(metric.score, 0), 100)}%` }} />
                        </div>
                        <p className="mt-2 break-words text-[10px] leading-relaxed text-muted-foreground">{metric.assessment}</p>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Deviations List */}
              <div className="space-y-6 border-t pt-8">
                <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                  Linguistic Deviations ({analysis.deviations.length})
                </h3>
                {analysis.deviations.length === 0 ? (
                  <p className="text-[10px] italic text-muted-foreground">No structural deviations detected.</p>
                ) : (
                  <div className="space-y-8">
                    {analysis.deviations.map((deviation, i) => (
                      <div key={i} className="group min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${getCriticalityColor(deviation.criticality)}`}>
                            {deviation.category}
                          </span>
                          <Button
                            size="sm"
                            variant="link"
                            className="h-auto p-0 text-primary font-bold text-[9px] uppercase tracking-tighter opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                            onClick={() => applySuggestion(deviation)}
                          >
                            Apply Fix
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                          <span className="line-through opacity-20 mr-2">{deviation.fragment}</span>
                          <span className="font-bold border-b border-primary/20">{deviation.correction}</span>
                        </p>
                        <p className="break-words text-[10px] leading-tight text-muted-foreground italic">{deviation.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reconstructed Text Preview */}
              <div className="space-y-3 pt-8 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Reconstructed</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-[9px] font-bold text-primary uppercase tracking-tighter"
                    onClick={() => setText(analysis.reconstructedContent)}
                  >
                    Adopt Changes
                  </Button>
                </div>
                <p className="whitespace-pre-wrap break-words border-l-2 border-primary/10 pl-4 font-serif text-xs leading-relaxed text-foreground/70 italic">
                  {analysis.reconstructedContent}
                </p>
              </div>

              {analysis.structuralImprovements.length > 0 && (
                <div className="space-y-3 border-t pt-8">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Structure Notes</h3>
                  {analysis.structuralImprovements.map((item, i) => (
                    <p key={i} className="break-words rounded-md bg-muted/20 p-3 text-[10px] leading-relaxed text-foreground/70">{item}</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 border-t pt-4">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={copyResult}>
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

"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Database,
  Download,
  Type,
  Layers,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const WRITING_STYLES = [
  { label: "Forensic/Investigative", value: "Forensic/Investigative", description: "Objective, precise, and analytical" },
  { label: "Formal/Academic", value: "Formal/Academic", description: "Sophisticated and structured" },
  { label: "Professional/Corporate", value: "Professional/Corporate", description: "Clear, direct, and authoritative" },
  { label: "Casual/Conversational", value: "Casual/Conversational", description: "Friendly and approachable" },
  { label: "Creative/Narrative", value: "Creative/Narrative", description: "Expressive and evocative" },
  { label: "Concise/Minimalist", value: "Concise/Minimalist", description: "Brief and high-impact" },
];

const INTENTS = ["Formal", "Casual", "Persuasive"];
const TONES = ["Confident", "Friendly", "Professional"];
const EXAMPLE_TEXT = "Our team reviewed the claims in the article and found several parts that need clearer sourcing before publication.";

type ParaphraseAnalysis = {
  module: string;
  transformation: {
    originalStyle: string;
    targetStyleApplied: string;
    intentApplied?: string;
    toneApplied?: string;
    semanticPreservationScore: number;
    complexityShift: string;
    clarityScore?: number;
    concisenessScore?: number;
    engagementScore?: number;
  };
  reencodedText: string;
  keyChanges: { type: string; note: string }[];
  alternativeOptions: string[];
};

export function Paraphraser() {
  const [text, setText] = useState("");
  const [targetStyle, setTargetStyle] = useState(WRITING_STYLES[0].value);
  const [intent, setIntent] = useState("Formal");
  const [tone, setTone] = useState("Professional");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ParaphraseAnalysis | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"input" | "results">("input");

  useEffect(() => {
    const saved = localStorage.getItem("reywright-rewrite");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setText(parsed.text || "");
        setTargetStyle(parsed.targetStyle || WRITING_STYLES[0].value);
        setIntent(parsed.intent || "Formal");
        setTone(parsed.tone || "Professional");
        setAnalysis(parsed.analysis || null);
        if (parsed.analysis) {
          setMobilePanel("results");
        }
      } catch (e) {
        console.error("Failed to parse saved rewrite session", e);
      }
    }
  }, []);

  async function handleParaphrase() {
    if (!text.trim()) return;

    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/ai/paraphrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetStyle, intent: intent.toLowerCase(), tone: tone.toLowerCase() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Paraphrasing failed");
      setAnalysis(data.analysis);
      setMobilePanel("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Paraphrasing failed");
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportMarkdown = () => {
    if (!analysis) return;
    const markdown = `# Rewrite Report

## Transformation
- Original style: ${analysis.transformation.originalStyle}
- Target style: ${analysis.transformation.targetStyleApplied}
- Intent: ${analysis.transformation.intentApplied || intent}
- Tone: ${analysis.transformation.toneApplied || tone}
- Semantic preservation: ${analysis.transformation.semanticPreservationScore}%
- Complexity shift: ${analysis.transformation.complexityShift}
- Clarity: ${analysis.transformation.clarityScore ?? "Not scored"}%
- Conciseness: ${analysis.transformation.concisenessScore ?? "Not scored"}%
- Engagement: ${analysis.transformation.engagementScore ?? "Not scored"}%

## Rewritten Text
${analysis.reencodedText}

## Key Changes
${analysis.keyChanges.map((item) => `- ${item.type}: ${item.note}`).join("\n") || "- None"}

## Alternatives
${analysis.alternativeOptions.map((item) => `- ${item}`).join("\n") || "- None"}
`;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "rewrite-report.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveSession = () => {
    if (!analysis) return;
    localStorage.setItem("reywright-rewrite", JSON.stringify({ text, targetStyle, intent, tone, analysis }));
  };

  const rewriteMetrics = analysis
    ? [
        { label: "Clarity", value: analysis.transformation?.clarityScore },
        { label: "Conciseness", value: analysis.transformation?.concisenessScore },
        { label: "Engagement", value: analysis.transformation?.engagementScore },
      ]
    : [];

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
        <div className={`${mobilePanel === "input" ? "block" : "hidden"} min-w-0 space-y-10 lg:col-span-3 lg:block`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Type className="size-3" />
                Input Fragment
              </h2>
            </div>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to re-encode into a new style..."
                className="h-56 w-full resize-y border-none bg-transparent p-0 font-serif text-sm leading-relaxed outline-none ring-0 placeholder:text-muted-foreground/20 focus:ring-0 sm:h-64"
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Layers className="size-2.5" />
              Target Style
            </h3>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {WRITING_STYLES.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setTargetStyle(style.value)}
                  className={`rounded-md border px-3 py-2 text-left text-[9px] font-black uppercase tracking-tighter transition-all ${
                    targetStyle === style.value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/30 hover:bg-muted/50 text-muted-foreground border-transparent"
                  }`}
                >
                  <span className="block">{style.label}</span>
                  <span className="mt-1 block text-[9px] font-medium normal-case tracking-normal opacity-70">{style.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 border-t pt-6 sm:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Intent</h3>
              <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted/30 p-1">
                {INTENTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setIntent(item)}
                    className={`h-8 rounded text-[9px] font-black uppercase tracking-tighter transition-colors ${intent === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tone</h3>
              <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted/30 p-1">
                {TONES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTone(item)}
                    className={`h-8 rounded text-[9px] font-black uppercase tracking-tighter transition-colors ${tone === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={handleParaphrase}
              disabled={loading || !text.trim()}
              className="h-auto min-h-11 flex-1 whitespace-normal rounded-md px-4 py-2 text-[11px] font-black uppercase tracking-wider shadow-sm sm:tracking-[0.2em]"
            >
              {loading ? (
                <Loader2 className="animate-spin size-3" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Execute Semantic Shift
            </Button>
            <Button variant="ghost" className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" onClick={() => setText(EXAMPLE_TEXT)}>
              Try Example
            </Button>
          </div>
        </div>

        {/* Results Section */}
        <div className={`${mobilePanel === "results" ? "block" : "hidden"} min-w-0 space-y-8 border-t pt-8 lg:sticky lg:top-20 lg:col-span-2 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-auto lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0`}>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 border-b pb-2">
            <Zap className="size-3" />
            Encoded Result
          </h2>

          {!analysis && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/5 p-8 py-16 text-center text-muted-foreground">
              <RefreshCw className="size-5 opacity-35" />
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Ready to rewrite</p>
                <p className="max-w-xs text-[11px] leading-relaxed">Choose a target voice and generate a rewritten version with traceable change notes.</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-20 flex flex-col items-center justify-center text-center animate-pulse">
              <Loader2 className="animate-spin size-6 text-primary/40 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Processing Shift</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-destructive/5 text-destructive border border-destructive/10">
              <p className="text-[10px] font-bold">{error}</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
              {/* Main Output */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] uppercase tracking-widest font-black text-primary">
                      {analysis.transformation?.intentApplied || intent} / {analysis.transformation?.toneApplied || tone}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-[9px] font-bold text-muted-foreground hover:text-primary uppercase tracking-tighter"
                    onClick={() => copyToClipboard(analysis.reencodedText)}
                  >
                    {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="whitespace-pre-wrap break-words font-serif text-lg font-bold leading-tight tracking-tight text-foreground sm:text-xl">
                  {analysis.reencodedText}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Preservation</p>
                  <p className="mt-1 text-2xl font-black">{analysis.transformation?.semanticPreservationScore ?? 0}%</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
                    <div className="h-full rounded bg-primary" style={{ width: `${Math.min(Math.max(analysis.transformation?.semanticPreservationScore ?? 0, 0), 100)}%` }} />
                  </div>
                </div>
                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Complexity</p>
                  <p className="mt-2 break-words text-xs font-black">{analysis.transformation?.complexityShift ?? "Unknown"}</p>
                </div>
              </div>

              {rewriteMetrics.some((item) => typeof item.value === "number") && (
                <div className="grid gap-3 border-t pt-8">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Readability Fit</h3>
                  {rewriteMetrics.map(({ label, value }) => (
                    typeof value === "number" && (
                      <div key={label} className="rounded-md border bg-muted/10 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                          <p className="text-sm font-black">{value}%</p>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
                          <div className="h-full rounded bg-primary" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Key Changes */}
              <div className="grid grid-cols-1 gap-4 border-t pt-8">
                {analysis.keyChanges.slice(0, 3).map((change, i) => (
                  <div key={i} className="space-y-1">
                    <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">{change.type}</span>
                    <p className="whitespace-pre-wrap break-words text-[10px] leading-snug text-muted-foreground">{change.note}</p>
                  </div>
                ))}
              </div>

              {/* Alternatives */}
              <div className="space-y-4 pt-8 border-t">
                <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Variant Encodes</h3>
                <div className="space-y-6">
                  {analysis.alternativeOptions.map((opt, i) => (
                    <div
                      key={i}
                      className="group cursor-pointer border-l-2 border-transparent pl-4 transition-all hover:border-primary/20"
                      onClick={() => copyToClipboard(opt)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="whitespace-pre-wrap break-words text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                          {opt}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t pt-4 min-[460px]:grid-cols-4">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={() => copyToClipboard(analysis.reencodedText)}>
                  <Copy className="size-3" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={() => setText(analysis.reencodedText)}>
                  <Check className="size-3" />
                  Adopt
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

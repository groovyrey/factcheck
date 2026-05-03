"use client";

import { useState } from "react";
import {
  Sparkles,
  PenTool,
  SearchCode,
  ShieldCheck,
  RefreshCw,
  BookOpenCheck,
} from "lucide-react";

import { AiResearcher } from "@/components/ai-researcher";
import { Proofreader } from "@/components/proofreader";
import { PlagiarismChecker } from "@/components/plagiarism-checker";
import { Paraphraser } from "@/components/paraphraser";
import { CitationFinder } from "@/components/citation-finder";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [mode, setMode] = useState<"research" | "proofread" | "plagiarism" | "paraphrase" | "citation">("proofread");

  return (
    <main className="min-h-screen bg-[#F9FAFB] text-foreground selection:bg-primary/10">
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:min-h-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </div>
            <p className="text-xs font-bold tracking-tight">Reywright</p>
          </div>

          <div className="grid w-full grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1 sm:w-auto sm:grid-cols-5 sm:p-0.5">
            <Button 
              variant={mode === "research" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 min-w-0 gap-1.5 rounded px-2 text-[10px] font-bold uppercase tracking-normal sm:h-7 sm:px-2.5"
              onClick={() => setMode("research")}
            >
              <SearchCode className="size-3" />
              Research
            </Button>
            <Button 
              variant={mode === "proofread" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 min-w-0 gap-1.5 rounded px-2 text-[10px] font-bold uppercase tracking-normal sm:h-7 sm:px-2.5"
              onClick={() => setMode("proofread")}
            >
              <PenTool className="size-3" />
              Proofread
            </Button>
            <Button 
              variant={mode === "plagiarism" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 min-w-0 gap-1.5 rounded px-2 text-[10px] font-bold uppercase tracking-normal sm:h-7 sm:px-2.5"
              onClick={() => setMode("plagiarism")}
            >
              <ShieldCheck className="size-3" />
              Source Check
            </Button>
            <Button 
              variant={mode === "paraphrase" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 min-w-0 gap-1.5 rounded px-2 text-[10px] font-bold uppercase tracking-normal sm:h-7 sm:px-2.5"
              onClick={() => setMode("paraphrase")}
            >
              <RefreshCw className="size-3" />
              Rewrite
            </Button>
            <Button 
              variant={mode === "citation" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 min-w-0 gap-1.5 rounded px-2 text-[10px] font-bold uppercase tracking-normal sm:h-7 sm:px-2.5"
              onClick={() => setMode("citation")}
            >
              <BookOpenCheck className="size-3" />
              Citations
            </Button>
          </div>

          <div className="hidden sm:block">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded">
              v1.4.0 Forensic
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
        <div className="flex flex-col gap-6 sm:gap-10">
          <div className="space-y-2 border-l-2 border-primary/20 pl-4 sm:pl-6">
            <h1 className="text-xl font-bold tracking-tight text-foreground/90 sm:text-2xl">
              {mode === "research" ? "Linguistic Intelligence & Discovery" : 
               mode === "proofread" ? "Precision Proofreading Desk" : 
               mode === "plagiarism" ? "Source Attribution Check" : 
               mode === "paraphrase" ? "Style Rewrite Workshop" :
               "Citation Finder"}
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {mode === "research" 
                ? "Deep-scan discovery for entity profiling, claim verification, and follow-up leads."
                : mode === "proofread"
                ? "Grammar, tone, readability, and structure review with adoptable fixes."
                : mode === "plagiarism"
                ? "Origin tracing, match severity, and an evidence trail for source collisions."
                : mode === "paraphrase"
                ? "Controlled semantic rewriting with before-and-after actions and style variants."
                : "Find scholarly sources, extract reference details, and format citations in APA, MLA, Chicago, and IEEE."}
            </p>
          </div>

          <div className="min-h-[520px] rounded-lg border border-black/5 bg-background p-4 shadow-[0_0_50px_-12px_rgba(0,0,0,0.1)] sm:p-6 lg:p-8">
            <div className={mode === "research" ? "block" : "hidden"}>
              <AiResearcher />
            </div>
            <div className={mode === "proofread" ? "block" : "hidden"}>
              <Proofreader />
            </div>
            <div className={mode === "plagiarism" ? "block" : "hidden"}>
              <PlagiarismChecker />
            </div>
            <div className={mode === "paraphrase" ? "block" : "hidden"}>
              <Paraphraser />
            </div>
            <div className={mode === "citation" ? "block" : "hidden"}>
              <CitationFinder />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

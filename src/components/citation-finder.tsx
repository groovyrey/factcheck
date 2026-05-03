"use client";

import { FormEvent, useState, useEffect } from "react";
import {
  BookOpenCheck,
  Clipboard,
  Database,
  Download,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type CitationReference = {
  title?: string;
  authors?: string[];
  year?: string;
  sourceTitle?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  database?: string;
  sourceType?: string;
  abstractOrSummary?: string;
  relevance?: string;
  citedByCount?: number;
  isOpenAccess?: boolean;
  openAccessUrl?: string;
  pdfUrl?: string;
  validationIssues?: string[];
  bibtex?: string;
  ris?: string;
  verificationStatus?: string;
  citationFormats?: {
    apa?: string;
    mla?: string;
    chicago?: string;
    ieee?: string;
  };
};

type CitationAnalysis = {
  topic?: string;
  searchAssessment?: {
    coverage?: "low" | "medium" | "high" | string;
    note?: string;
  };
  references?: CitationReference[];
  recommendedFollowUpSearches?: string[];
  rawText?: string;
  parseWarning?: string;
};

type CitationResponse = {
  query: string;
  optimizedQuery?: string;
  provider?: string;
  providerWarnings?: string[];
  researchRoute?: {
    domain?: string;
    providers?: string[];
    searchHint?: string;
  };
  searchResultCount?: number;
  webSearchUrl: string;
  sources: string[];
  resultCount: number;
  analysis: CitationAnalysis;
  model: string;
};

const EXAMPLE_QUERY = "The integration of Large Language Models (LLMs) in higher education requires a balanced approach to ensure academic integrity while fostering innovation. Research should explore how AI-assisted grading impacts student learning outcomes and the potential for bias in automated feedback systems.";
const CITATION_STYLES = ["apa", "mla", "chicago", "ieee"] as const;

export function CitationFinder() {
  const [query, setQuery] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<(typeof CITATION_STYLES)[number]>("apa");
  const [response, setResponse] = useState<CitationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"input" | "results">("input");

  useEffect(() => {
    const saved = localStorage.getItem("reywright-citations");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setQuery(parsed.query || "");
        setSelectedStyle(parsed.selectedStyle || "apa");
        setResponse(parsed.response || null);
        if (parsed.response) {
          setMobilePanel("results");
        }
      } catch (e) {
        console.error("Failed to parse saved citation session", e);
      }
    }
  }, []);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;

    setMobilePanel("results");
    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const citationResponse = await fetch("/api/research/citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, count: 8 }),
      });
      const data = await citationResponse.json();
      if (!citationResponse.ok) throw new Error(data.error || "Citation search failed");
      setResponse(data);
      setMobilePanel("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Citation search failed");
    } finally {
      setLoading(false);
    }
  }

  const references = response?.analysis.references || [];

  const copyCitation = (reference: CitationReference, index: number) => {
    const citation = reference.citationFormats?.[selectedStyle] || reference.citationFormats?.apa || "";
    if (!citation) return;
    navigator.clipboard.writeText(citation);
    setCopiedId(`${index}-${selectedStyle}`);
    setTimeout(() => setCopiedId(""), 1600);
  };

  const exportMarkdown = () => {
    if (!response) return;
    const markdown = `# Citation Finder: ${response.analysis.topic || response.query}

## Search Assessment
Coverage: ${response.analysis.searchAssessment?.coverage || "unknown"}

${response.analysis.searchAssessment?.note || ""}

## References
${references.map((reference, index) => formatReferenceMarkdown(reference, index + 1)).join("\n\n")}

## Follow-up Searches
${response.analysis.recommendedFollowUpSearches?.map((item) => `- ${item}`).join("\n") || "- None"}
`;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "citation-references.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBibliography = (format: "bibtex" | "ris") => {
    if (!response) return;
    const content = references
      .map((reference) => reference[format])
      .filter(Boolean)
      .join("\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = format === "bibtex" ? "references.bib" : "references.ris";
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveSession = () => {
    if (!response) return;
    localStorage.setItem("reywright-citations", JSON.stringify({ query, selectedStyle, response }));
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
        <div className={`${mobilePanel === "input" ? "block" : "hidden"} min-w-0 space-y-8 lg:col-span-3 lg:block`}>
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <BookOpenCheck className="size-3" />
              Research Statement Intelligence
            </h2>
          </div>

          <form onSubmit={handleSearch} className="space-y-6">
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Paste your research statement, thesis paragraph, or a detailed claim to find supporting scholarly citations..."
              className="h-48 w-full resize-y border-none bg-transparent p-0 font-serif text-sm leading-relaxed outline-none ring-0 placeholder:text-muted-foreground/20 focus:ring-0 sm:h-56"
            />

            <div className="space-y-3 border-t pt-6">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Citation Format</h3>
              <div className="grid grid-cols-4 gap-1 rounded-md border bg-muted/30 p-1">
                {CITATION_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setSelectedStyle(style)}
                    className={`h-8 rounded text-[9px] font-black uppercase tracking-tighter transition-colors ${selectedStyle === style ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                disabled={loading || !query.trim()}
                className="h-auto min-h-9 whitespace-normal rounded-md px-4 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm sm:px-6 sm:tracking-widest"
              >
                {loading ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
                {loading ? "Searching..." : "Find Research Citations"}
              </Button>
              <Button type="button" variant="ghost" className="h-9 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" onClick={() => setQuery(EXAMPLE_QUERY)}>
                Try Example
              </Button>
            </div>
          </form>

          {error && (
            <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-4 text-destructive">
              <p className="text-[10px] font-bold">{error}</p>
            </div>
          )}
        </div>

        <div className={`${mobilePanel === "results" ? "block" : "hidden"} min-w-0 space-y-8 border-t pt-8 lg:sticky lg:top-20 lg:col-span-2 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-auto lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0`}>
          <h2 className="flex items-center gap-2 border-b pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <Database className="size-3" />
            Reference Details
          </h2>

          {!response && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/5 p-8 py-16 text-center text-muted-foreground">
              <BookOpenCheck className="size-5 opacity-35" />
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Ready for scholarly search</p>
                <p className="max-w-xs text-[11px] leading-relaxed">Search verified research indexes and publisher sources, then format the results as references.</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
              <Loader2 className="mb-4 size-6 animate-spin text-primary/40" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Searching scholarly sources</p>
            </div>
          )}

          {response && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    {response.analysis.topic || response.query}
                  </h3>
                  <span className="rounded border border-black/5 px-1.5 py-0.5 text-[8px] font-black uppercase text-muted-foreground/60">
                    {response.searchResultCount ?? response.resultCount} hits
                  </span>
                </div>
                {response.optimizedQuery && response.optimizedQuery !== response.query && (
                  <p className="text-[9px] text-muted-foreground italic break-words">
                    AI-optimized search: &quot;{response.optimizedQuery}&quot;
                  </p>
                )}
                <p className="break-words border-l-2 border-primary/10 pl-4 text-xs leading-relaxed text-foreground/70">
                  {response.analysis.searchAssessment?.note || "Citation extraction completed from scholarly-domain search results."}
                </p>
                {(response.providerWarnings || []).length > 0 && (
                  <div className="rounded-md border border-amber-600/20 bg-amber-50 p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-700">Provider Fallback</p>
                    {response.providerWarnings?.map((warning) => (
                      <p key={warning} className="mt-1 break-words text-[10px] leading-relaxed text-amber-800">{warning}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-5">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={exportMarkdown}>
                  <Download className="size-3" />
                  MD
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={() => exportBibliography("bibtex")}>
                  <Download className="size-3" />
                  BibTeX
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={() => exportBibliography("ris")}>
                  <Download className="size-3" />
                  RIS
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" onClick={saveSession}>
                  <Database className="size-3" />
                  Save
                </Button>
                {response.webSearchUrl ? (
                  <a
                    href={response.webSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[9px] font-bold uppercase transition-colors hover:bg-muted"
                  >
                    <ExternalLink className="size-3" />
                    Search
                  </a>
                ) : (
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-[9px] font-bold uppercase" disabled>
                    Search
                  </Button>
                )}
              </div>

              {response.researchRoute && (
                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Route</p>
                  <p className="mt-1 text-xs font-bold capitalize">{response.researchRoute.domain?.replaceAll("_", " ")}</p>
                  <p className="mt-2 break-words text-[10px] leading-relaxed text-muted-foreground">
                    {(response.researchRoute.providers || response.sources).join(", ")}
                  </p>
                </div>
              )}

              {references.length === 0 ? (
                <p className="rounded-md border bg-muted/10 p-4 text-[10px] text-muted-foreground">
                  No structured references were returned. Try a narrower title, DOI, author name, or field-specific keyword.
                </p>
              ) : (
                <div className="space-y-8">
                  {references.map((reference, index) => {
                    const citation = reference.citationFormats?.[selectedStyle] || reference.citationFormats?.apa || "";
                    return (
                      <article key={`${reference.title}-${index}`} className="min-w-0 space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="break-words text-sm font-bold leading-tight">{reference.title || "Untitled reference"}</h3>
                            {reference.url && (
                              <a href={reference.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground transition-colors hover:text-primary">
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                          <p className="break-words text-[10px] leading-relaxed text-muted-foreground">
                            {(reference.authors || []).join(", ") || "Authors unavailable"} {reference.year ? `(${reference.year})` : ""}
                          </p>
                        </div>

                        <div className="rounded-md bg-muted/20 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{selectedStyle}</span>
                            <Button variant="ghost" size="sm" className="h-auto p-0 text-[9px] font-bold uppercase text-primary" onClick={() => copyCitation(reference, index)}>
                              <Clipboard className="size-3" />
                              {copiedId === `${index}-${selectedStyle}` ? "Copied" : "Copy"}
                            </Button>
                          </div>
                          <p className="break-words font-serif text-xs leading-relaxed text-foreground/80">{citation || "Citation unavailable for this style."}</p>
                        </div>

                        <dl className="grid grid-cols-1 gap-3 text-[10px] min-[460px]:grid-cols-2">
                          <Detail label="Source" value={reference.sourceTitle} />
                          <Detail label="Database" value={reference.database} />
                          <Detail label="Type" value={reference.sourceType} />
                          <Detail label="Status" value={reference.verificationStatus} />
                          <Detail label="DOI" value={reference.doi} />
                          <Detail label="Pages" value={reference.pages} />
                          <Detail label="Citations" value={typeof reference.citedByCount === "number" ? String(reference.citedByCount) : ""} />
                          <Detail label="Open Access" value={reference.isOpenAccess ? "Available" : ""} />
                        </dl>

                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${reference.verificationStatus === "verified" ? "border-green-600/20 bg-green-50 text-green-700" : "border-amber-600/20 bg-amber-50 text-amber-700"}`}>
                            {reference.verificationStatus || "needs review"}
                          </span>
                          {(reference.validationIssues || []).length === 0 ? (
                            <span className="rounded border border-green-600/20 bg-green-50 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-green-700">
                              citation ready
                            </span>
                          ) : (
                            reference.validationIssues?.map((issue) => (
                              <span key={issue} className="rounded border border-amber-600/20 bg-amber-50 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-700">
                                {issue}
                              </span>
                            ))
                          )}
                        </div>

                        {(reference.openAccessUrl || reference.pdfUrl) && (
                          <div className="flex flex-wrap gap-2">
                            {reference.openAccessUrl && (
                              <a href={reference.openAccessUrl} target="_blank" rel="noreferrer" className="rounded border bg-muted/20 px-2 py-1 text-[9px] font-bold uppercase tracking-tighter text-muted-foreground transition-colors hover:text-foreground">
                                Open Access
                              </a>
                            )}
                            {reference.pdfUrl && (
                              <a href={reference.pdfUrl} target="_blank" rel="noreferrer" className="rounded border bg-muted/20 px-2 py-1 text-[9px] font-bold uppercase tracking-tighter text-muted-foreground transition-colors hover:text-foreground">
                                PDF
                              </a>
                            )}
                          </div>
                        )}

                        {(reference.abstractOrSummary || reference.relevance) && (
                          <div className="space-y-2">
                            {reference.abstractOrSummary && (
                              <p className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-muted-foreground">{reference.abstractOrSummary}</p>
                            )}
                            {reference.relevance && (
                              <p className="break-words border-l-2 border-primary/10 pl-3 text-[10px] leading-relaxed text-foreground/70">{reference.relevance}</p>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {(response.analysis.recommendedFollowUpSearches || []).length > 0 && (
                <div className="space-y-3 border-t pt-6">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Follow-up Searches</h3>
                  <div className="flex flex-wrap gap-2">
                    {response.analysis.recommendedFollowUpSearches?.map((item) => (
                      <button key={item} onClick={() => setQuery(item)} className="rounded border bg-muted/20 px-2 py-1 text-left text-[9px] font-bold uppercase tracking-tighter text-muted-foreground transition-colors hover:text-foreground">
                        {item}
                      </button>
                    ))}
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

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <div className="min-w-0">
      <dt className="font-black uppercase tracking-widest text-muted-foreground/60">{label}</dt>
      <dd className="mt-1 break-words font-medium text-foreground/75">{value}</dd>
    </div>
  );
}

function formatReferenceMarkdown(reference: CitationReference, index: number) {
  return `### ${index}. ${reference.title || "Untitled reference"}

- Authors: ${(reference.authors || []).join(", ") || "Unavailable"}
- Year: ${reference.year || "Unavailable"}
- Source: ${reference.sourceTitle || "Unavailable"}
- Publisher: ${reference.publisher || "Unavailable"}
- Volume/Issue/Pages: ${[reference.volume, reference.issue, reference.pages].filter(Boolean).join(", ") || "Unavailable"}
- DOI: ${reference.doi || "Unavailable"}
- URL: ${reference.url || "Unavailable"}
- Database: ${reference.database || "Unavailable"}
- Type: ${reference.sourceType || "Unavailable"}
- Verification: ${reference.verificationStatus || "Unavailable"}
- Validation: ${reference.validationIssues?.join("; ") || "Citation ready"}
- Cited by: ${typeof reference.citedByCount === "number" ? reference.citedByCount : "Unavailable"}
- Open access URL: ${reference.openAccessUrl || "Unavailable"}
- PDF URL: ${reference.pdfUrl || "Unavailable"}

APA: ${reference.citationFormats?.apa || "Unavailable"}

MLA: ${reference.citationFormats?.mla || "Unavailable"}

Chicago: ${reference.citationFormats?.chicago || "Unavailable"}

IEEE: ${reference.citationFormats?.ieee || "Unavailable"}

BibTeX:
\`\`\`bibtex
${reference.bibtex || "Unavailable"}
\`\`\`

RIS:
\`\`\`ris
${reference.ris || "Unavailable"}
\`\`\`

Summary: ${reference.abstractOrSummary || "Unavailable"}

Relevance: ${reference.relevance || "Unavailable"}`;
}

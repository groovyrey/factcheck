"use client";

import { FormEvent, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Search,
  Loader2,
  Sparkles,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Extraction = {
  authorName: string;
  authorSlug: string;
  canonicalUrl: string;
  captureMode: "public_metadata";
  content: string;
  description: string;
  engagementText: string;
  image: string;
  isTruncated: boolean;
  platform: "facebook";
  postId: string;
  sourceUrl: string;
  status: "complete" | "partial";
  title: string;
  warnings: string[];
  authorType: "profile" | "page" | "unknown";
  authorImage: string;
  media: Array<{ type: "image" | "video"; url: string; thumbnailUrl?: string }>;
  metadata?: Record<string, string>;
};

type AiResult = {
  analysis: unknown;
  model: string;
};

type AuthorAnalysisResult = {
  analysis: unknown;
  model: string;
};

type WebSearchResult = {
  id: string;
  name: string;
  url: string;
  displayUrl: string;
  snippet: string;
  summary: string;
  datePublished: string;
  dateLastCrawled: string;
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

type WebSearchPayload = {
  query: string;
  webSearchUrl: string;
  results: WebSearchResult[];
  images?: WebSearchImage[];
  videos?: WebSearchVideo[];
};

export function FacebookPostImporter() {
  const [url, setUrl] = useState("");
  const [post, setPost] = useState<Extraction | null>(null);
  const [analysis, setAnalysis] = useState<AiResult | null>(null);
  const [authorSearch, setAuthorSearch] = useState<WebSearchPayload | null>(null);
  const [authorAnalysis, setAuthorAnalysis] = useState<AuthorAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [authorSearchError, setAuthorSearchError] = useState("");
  const [authorAnalysisError, setAuthorAnalysisError] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [authorSearching, setAuthorSearching] = useState(false);
  const [authorAnalyzing, setAuthorAnalyzing] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAnalysisError("");
    setAuthorSearchError("");
    setAuthorAnalysisError("");
    setPost(null);
    setAnalysis(null);
    setAuthorSearch(null);
    setAuthorAnalysis(null);
    setLoading(true);

    try {
      const response = await fetch("/api/extract/facebook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to extract this post.");
      }

      setPost(payload.post);
      setAuthorSearch(null);
      setAuthorAnalysis(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to extract this post.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!post) {
      return;
    }

    setAnalysisError("");
    setAnalysis(null);
    setAnalyzing(true);

    try {
      const response = await fetch("/api/ai/analyze-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ post }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to analyze this post.");
      }

      setAnalysis(payload);
    } catch (requestError) {
      setAnalysisError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to analyze this post.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function runAuthorAuthenticity(extraction: Extraction) {
    const author = extraction.authorName.trim() || extraction.title.trim();

    if (!author) {
      return;
    }

    setAuthorSearchError("");
    setAuthorAnalysisError("");
    setAuthorSearch(null);
    setAuthorAnalysis(null);
    setAuthorSearching(true);

    let authorSearchPayload: WebSearchPayload | null = null;

    try {
      const searchResponse = await fetch("/api/search/web", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: author, count: 5 }),
      });
      const searchPayload = await searchResponse.json();

      if (!searchResponse.ok) {
        throw new Error(searchPayload.error ?? "Unable to search the author.");
      }

      authorSearchPayload = searchPayload;
      setAuthorSearch(searchPayload);
    } catch (requestError) {
      setAuthorSearchError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to search the author.",
      );
      setAuthorSearching(false);
      return;
    } finally {
      setAuthorSearching(false);
    }

    setAuthorAnalyzing(true);

    try {
      const analysisResponse = await fetch("/api/ai/analyze-author", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          author,
          post: extraction,
          webSearch: authorSearchPayload ?? undefined,
        }),
      });
      const analysisPayload = await analysisResponse.json();

      if (!analysisResponse.ok) {
        throw new Error(
          analysisPayload.error ?? "Unable to analyze the author.",
        );
      }

      setAuthorAnalysis(analysisPayload);
    } catch (requestError) {
      setAuthorAnalysisError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to analyze the author.",
      );
    } finally {
      setAuthorAnalyzing(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="min-w-0 rounded-lg border bg-card p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">
              Import Facebook post
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a public Facebook post URL. SourceCheck will extract the
              public preview content Facebook exposes to this server.
            </p>
          </div>
          <div className="hidden rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground sm:block">
            Beta
          </div>
        </div>

        <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="post-url">
            Facebook post URL
          </label>
          <div className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-3 focus-within:ring-ring/30">
            <Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              id="post-url"
              name="post-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.facebook.com/.../posts/..."
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              required
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full px-4 sm:w-auto"
            disabled={loading}
          >
            {loading ? "Extracting" : "Extract"}
            {loading ? (
              <Loader2 data-icon="inline-end" className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRight data-icon="inline-end" className="size-4" aria-hidden="true" />
            )}
          </Button>
        </form>

        {error ? (
          <div className="mt-4 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        {post ? (
          <div className="mt-5 space-y-5">
            {/* Post Card */}
            <div className="min-w-0 rounded-lg border bg-background p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  {post.isTruncated
                    ? "Truncated preview"
                    : post.status === "complete"
                      ? "Extracted"
                      : "Partial extract"}
                </span>
                {post.postId ? (
                  <span className="rounded-lg border px-2.5 py-1 font-mono text-xs text-muted-foreground">
                    {post.postId}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="size-12 shrink-0 overflow-hidden rounded-full border bg-muted sm:size-14">
                  {post.authorImage ? (
                    <img
                      src={post.authorImage}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <div className={cn("flex h-full w-full items-center justify-center text-muted-foreground", post.authorImage ? "hidden" : "")}>
                    <User className="size-6 sm:size-8" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-heading text-base font-semibold sm:text-lg">
                    {post.authorName || post.title}
                  </h3>
                  {post.authorSlug ? (
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      @{post.authorSlug}
                    </p>
                  ) : null}
                </div>
              </div>

              {post.engagementText ? (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                  {post.engagementText}
                </p>
              ) : null}

              {post.media?.length ? (
                <div className={cn(
                  "mt-4 grid gap-2",
                  post.media.length === 1 ? "grid-cols-1" : post.media.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
                )}>
                  {post.media.map((item, idx) => (
                    <div key={idx} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                      {item.type === "image" ? (
                        <img
                          src={item.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-black/10">
                          <ExternalLink className="size-6 text-muted-foreground" />
                        </div>
                      )}
                      {item.type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="rounded-full bg-white/80 p-1.5 text-black">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {post.content || "No readable post text was exposed."}
              </p>
              <a
                href={post.canonicalUrl || post.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex max-w-full items-center gap-1.5 break-all text-sm font-medium underline-offset-4 hover:underline"
              >
                Open source
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>

            {/* Author Authenticity Card */}
            <div className="rounded-lg border bg-background p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4" aria-hidden="true" />
                  <h4 className="font-heading text-sm font-semibold">
                    Author authenticity
                  </h4>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={authorSearching || authorAnalyzing || !post}
                    onClick={() => post && runAuthorAuthenticity(post)}
                  >
                    {authorSearching || authorAnalyzing ? "Finding..." : "Find background"}
                    {authorSearching || authorAnalyzing ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Search className="size-3" aria-hidden="true" />
                    )}
                  </Button>
                  <span className="rounded-lg border px-2.5 py-1 text-xs text-muted-foreground">
                    {authorSearching
                      ? "Searching"
                      : authorAnalyzing
                        ? "Analyzing"
                      : authorAnalysis
                        ? "Done"
                        : post.authorName
                          ? "Queued"
                          : "Waiting"}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                The app searches the author name on the web, then asks Gemma for a credibility score and supporting signals.
              </p>

              {authorSearchError ? (
                <div className="mt-3 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>{authorSearchError}</p>
                </div>
              ) : null}

              {authorAnalysisError ? (
                <div className="mt-3 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>{authorAnalysisError}</p>
                </div>
              ) : null}

              {authorAnalysis ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <StatPill
                      label="Credibility score"
                      value={extractField(authorAnalysis.analysis, "credibilityScore") || "0"}
                    />
                    <StatPill
                      label="Verdict"
                      value={extractField(authorAnalysis.analysis, "authenticityVerdict")}
                    />
                    <StatPill
                      label="Confidence"
                      value={extractField(authorAnalysis.analysis, "confidence")}
                    />
                    <StatPill
                      label="Author"
                      value={extractField(authorAnalysis.analysis, "author") || post.authorName}
                    />
                  </div>

                  {extractField(authorAnalysis.analysis, "credibilitySummary") ? (
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Credibility Summary
                      </p>
                      <p className="mt-2 text-sm leading-relaxed">
                        {extractField(authorAnalysis.analysis, "credibilitySummary")}
                      </p>
                    </div>
                  ) : null}

                  <pre className="max-h-80 max-w-full overflow-auto rounded-lg border bg-muted/40 p-3 text-[0.7rem] leading-5 sm:text-xs">
                    <code>{JSON.stringify(authorAnalysis.analysis, null, 2)}</code>
                  </pre>
                </div>
              ) : null}

              {authorSearch ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Web evidence for {authorSearch.query}
                  </p>
                  <div className="space-y-2">
                    {authorSearch.results.map((result) => (
                      <div
                        key={result.id || result.url}
                        className="rounded-lg border bg-background p-3"
                      >
                        <p className="break-words text-sm font-medium">{result.name}</p>
                        {result.summary || result.snippet ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {(result.summary || result.snippet).length > 50
                              ? (result.summary || result.snippet).substring(0, 50) + "..."
                              : (result.summary || result.snippet)}
                          </p>
                        ) : null}
                        <div className="mt-3 flex justify-end">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                            >
                              View full content
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  {authorSearch.images?.length ? (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Images</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {authorSearch.images.map((img, idx) => (
                          <a
                            key={idx}
                            href={img.hostPageUrl || img.contentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-md border bg-muted"
                            title={img.name}
                          >
                            <img
                              src={img.thumbnailUrl}
                              alt={img.name}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {authorSearch.videos?.length ? (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Videos</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {authorSearch.videos.map((vid, idx) => (
                          <a
                            key={idx}
                            href={vid.hostPageUrl || vid.contentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-md border bg-muted"
                            title={vid.name}
                          >
                            <img
                              src={vid.thumbnailUrl}
                              alt={vid.name}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <div className="rounded-full bg-white/80 p-1.5 text-black">
                                <ArrowRight className="h-4 w-4" />
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* AI Analysis Card */}
            <div className="rounded-lg border bg-background p-3 sm:p-4">
              <Button
                type="button"
                variant="secondary"
                className="h-10 w-full sm:w-auto"
                disabled={analyzing || !post.content}
                onClick={handleAnalyze}
              >
                {analyzing ? "Analyzing" : "Analyze with Gemma 4"}
                {analyzing ? (
                  <Loader2 data-icon="inline-end" className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles data-icon="inline-end" className="size-4" aria-hidden="true" />
                )}
              </Button>

              {analysisError ? (
                <div className="mt-3 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>{analysisError}</p>
                </div>
              ) : null}

              {analysis ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-heading text-sm font-semibold">
                      AI analysis
                    </h4>
                    <span className="rounded-lg border px-2.5 py-1 font-mono text-[0.7rem] text-muted-foreground">
                      {analysis.model}
                    </span>
                  </div>
                  <pre className="mt-3 max-h-80 max-w-full overflow-auto rounded-lg border bg-muted/40 p-3 text-[0.7rem] leading-5 sm:text-xs">
                    <code>{JSON.stringify(analysis.analysis, null, 2)}</code>
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-5">
        {/* Sidebar Header Card */}
        <div className="rounded-lg border bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-semibold">Extracted content</h2>
            <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {post ? post.status : "Waiting"}
            </span>
          </div>
        </div>

        {post ? (
          <>
            {/* Sidebar Metadata Card */}
            <div className="rounded-lg border bg-card p-3 shadow-sm sm:p-4">
              <div className="space-y-3">
                <PreviewRow label="Platform" value="Facebook" />
                <div className="flex items-center gap-3">
                  <div className="size-10 shrink-0 overflow-hidden rounded-full border bg-muted">
                    {post.authorImage ? (
                      <img
                        src={post.authorImage}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={cn("flex h-full w-full items-center justify-center text-muted-foreground", post.authorImage ? "hidden" : "")}>
                      <User className="size-5" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <PreviewRow label="Author" value={post.authorName ?? ""} />
                  </div>
                </div>
                <PreviewRow label="Author type" value={post.authorType ?? "unknown"} />
                <PreviewRow label="Author slug" value={post.authorSlug ?? ""} />
                <PreviewRow label="Engagement" value={post.engagementText ?? ""} />
                <PreviewRow
                  label="Content status"
                  value={post.isTruncated ? "Truncated public preview" : "Available preview"}
                />
                <PreviewRow label="Canonical URL" value={post.canonicalUrl ?? ""} />
                {normalizeText(post.description) !== normalizeText(post.content) ? (
                  <PreviewRow label="Description" value={post.description} />
                ) : null}
              </div>
            </div>

            {/* Sidebar Warnings Card */}
            {post.warnings.length ? (
              <div className="rounded-lg border bg-card p-3 shadow-sm sm:p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Warnings</p>
                <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                  {post.warnings.map((warning) => (
                    <div key={warning} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <p>{warning}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Sidebar JSON Card */}
            <div className="rounded-lg border bg-card p-3 shadow-sm sm:p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Full extraction JSON
              </p>
              <pre className="mt-2 max-h-64 max-w-full overflow-auto rounded-lg border bg-background p-3 text-[0.7rem] leading-5 sm:max-h-80">
                <code>{JSON.stringify(post, null, 2)}</code>
              </pre>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return "";
  }

  const field = (value as Record<string, unknown>)[key];

  return typeof field === "string" ? field : String(field ?? "");
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium">{value || "Not available"}</p>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm">{value || "Not available"}</p>
    </div>
  );
}

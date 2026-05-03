const GEMMA_MODEL = "gemma-4-31b-it";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent`;
const CROSSREF_ENDPOINT = "https://api.crossref.org/works";
const SERP_ENDPOINT = "https://serpapi.com/search";

type CitationRequest = {
  query?: string;
  count?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type CitationSource = {
  provider: "SerpAPI" | "Crossref";
  id: string;
  title: string;
  authors: string[];
  year: string;
  sourceTitle: string;
  publisher: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  url: string;
  pdfUrl: string;
  openAccessUrl: string;
  sourceType: string;
  abstractOrSummary: string;
  citedByCount?: number;
  isOpenAccess?: boolean;
  validationIssues: string[];
  bibtex: string;
  ris: string;
  verificationStatus: "verified" | "likely_verified" | "needs_manual_review";
};

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  author?: Array<{
    given?: string;
    family?: string;
    name?: string;
  }>;
  issued?: {
    "date-parts"?: number[][];
  };
  "container-title"?: string[];
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
  type?: string;
  URL?: string;
  abstract?: string;
};

type CrossrefResponse = {
  status?: string;
  message?: CrossrefWork;
};

type CrossrefSearchResponse = {
  status?: string;
  message?: {
    items?: CrossrefWork[];
  };
};

type SerpScholarResult = {
  title?: string;
  result_id?: string;
  link?: string;
  snippet?: string;
  publication_info?: {
    summary?: string;
  };
  resources?: Array<{
    title?: string;
    file_format?: string;
    link?: string;
  }>;
  inline_links?: {
    cited_by?: {
      total?: number;
      link?: string;
    };
  };
};

type SerpResponse = {
  organic_results?: SerpScholarResult[];
  scholar_results?: SerpScholarResult[];
  error?: string;
};

export async function POST(request: Request) {
  const serpKey = process.env.SERP_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!serpKey || !geminiKey) {
    return Response.json(
      { error: "SERP_API_KEY and GEMINI_API_KEY must be configured." },
      { status: 500 },
    );
  }

  let body: CitationRequest;

  try {
    body = (await request.json()) as CitationRequest;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const count = clampCount(typeof body.count === "number" ? body.count : 8);

  if (!query) {
    return Response.json({ error: "Research query is required." }, { status: 400 });
  }

  // Step 1: Let AI optimize the search query for Google Scholar
  let optimizedQuery = query;
  try {
    const queryResponse = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Task: Generate a single Google Scholar search query.
Input: A research statement or paragraph.
Constraint: Return ONLY the search query string. NO explanation. NO reasoning. NO chat. NO quotes. NO conversational filler.

Research Statement:
${query}

Search Query:`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100,
        },
      }),
    });

    const queryPayload = await queryResponse.json();
    let aiGeneratedQuery = queryPayload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (aiGeneratedQuery) {
      // Cleanup: if the AI returned multiple lines or a block of text, try to find the actual query
      // Usually, it's the last line or the only line if it followed instructions.
      const lines = aiGeneratedQuery.split('\n').map((l: string) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        // If it looks like it leaked reasoning, try to find a line that looks like a query (often quoted or the last line)
        const lastLine = lines[lines.length - 1];
        if (lastLine.includes('"') || lastLine.length > 10) {
          aiGeneratedQuery = lastLine.replace(/^Query:\s*/i, "").replace(/^Search Query:\s*/i, "").replace(/^"|"$/g, "");
        }
      } else {
        aiGeneratedQuery = aiGeneratedQuery.replace(/^Query:\s*/i, "").replace(/^Search Query:\s*/i, "").replace(/^"|"$/g, "");
      }
      
      optimizedQuery = aiGeneratedQuery;
    }
  } catch (e) {
    console.error("AI query generation failed, falling back to original query", e);
  }

  const serpUrl = new URL(SERP_ENDPOINT);
  serpUrl.searchParams.set("engine", "google_scholar");
  serpUrl.searchParams.set("q", optimizedQuery);
  serpUrl.searchParams.set("api_key", serpKey);
  serpUrl.searchParams.set("num", String(count));

  const serpResponse = await fetch(serpUrl.toString());
  const serpPayloadResult = await readJsonResponse<SerpResponse>(serpResponse, "SerpAPI");

  if (!serpPayloadResult.ok) {
    return Response.json({ error: serpPayloadResult.error }, { status: 502 });
  }

  const serpResults = serpPayloadResult.data.scholar_results || serpPayloadResult.data.organic_results || [];
  const serpSources = serpResults.map(normalizeSerpResult);
  
  // Try to enrich with Crossref if DOI is found
  const enrichedSources = await Promise.all(
    serpSources.map(async (source: CitationSource) => {
      if (source.doi) {
        const crossref = await fetchCrossrefSource(source.doi);
        if (crossref) return finalizeSource(mergeSources(source, crossref));
      }
      return finalizeSource(source);
    })
  );

  const crossrefFallbackSources =
    enrichedSources.length === 0 ? await fetchCrossrefSearchSources(query, count) : [];

  const combinedSources = [...enrichedSources, ...crossrefFallbackSources];

  if (combinedSources.length === 0) {
    return Response.json(
      { error: "No citation providers returned usable results." },
      { status: 502 },
    );
  }

  const citationResponse = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildCitationPrompt(query, combinedSources),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    }),
  });

  const citationPayloadResult = await readJsonResponse<GeminiResponse>(citationResponse, "Gemini");

  if (!citationPayloadResult.ok) {
    return Response.json(
      { error: citationPayloadResult.error, preview: citationPayloadResult.preview },
      { status: 502 },
    );
  }

  const citationPayload = citationPayloadResult.data;
  const citationText = citationPayload.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();

  if (!citationText) {
    return Response.json({ error: "Gemma returned an empty citation response." }, { status: 502 });
  }

  try {
    const analysis = JSON.parse(extractJsonText(citationText));
    return Response.json({
      query,
      optimizedQuery,
      provider: serpSources.length > 0 ? "SerpAPI (Scholar)" : "Crossref fallback",
      searchResultCount: serpSources.length,
      resultCount: combinedSources.length,
      sources: ["SerpAPI", "Crossref"],
      analysis,
      model: GEMMA_MODEL,
    });
  } catch {
    return Response.json({
      query,
      optimizedQuery,
      provider: serpSources.length > 0 ? "SerpAPI (Scholar)" : "Crossref fallback",
      searchResultCount: serpSources.length,
      resultCount: combinedSources.length,
      sources: ["SerpAPI", "Crossref"],
      analysis: {
        rawText: citationText,
        parseWarning: "Gemma did not return valid citation JSON.",
      },
      model: GEMMA_MODEL,
    });
  }
}

function normalizeSerpResult(result: SerpScholarResult): CitationSource {
  const summary = result.publication_info?.summary || "";
  // Simple regex for year in summary like "J Doe, 2024 - journal.com"
  const yearMatch = summary.match(/\b(19|20)\d{2}\b/);
  const pdfResource = result.resources?.find(r => r.file_format === "PDF");
  const doi = extractDoi(`${result.title} ${result.snippet} ${result.link}`);

  return {
    provider: "SerpAPI",
    id: result.result_id || "",
    title: result.title || "",
    authors: summary.split("-")[0]?.split(",").map(a => a.trim()).filter(Boolean) || [],
    year: yearMatch ? yearMatch[0] : "",
    sourceTitle: summary.split("-")[1]?.trim() || "",
    publisher: "",
    volume: "",
    issue: "",
    pages: "",
    doi,
    url: result.link || "",
    pdfUrl: pdfResource?.link || "",
    openAccessUrl: pdfResource?.link || "",
    sourceType: "journal_article",
    abstractOrSummary: result.snippet || "",
    citedByCount: result.inline_links?.cited_by?.total ?? 0,
    isOpenAccess: !!pdfResource,
    validationIssues: [],
    bibtex: "",
    ris: "",
    verificationStatus: doi ? "verified" : "needs_manual_review",
  };
}

async function fetchCrossrefSource(doi: string): Promise<CitationSource | null> {
  try {
    const response = await fetch(`${CROSSREF_ENDPOINT}/${encodeURIComponent(doi)}`);
    if (!response.ok) return null;
    const payloadResult = await readJsonResponse<CrossrefResponse>(response, "Crossref");
    if (!payloadResult.ok) return null;
    const work = payloadResult.data.message;
    if (!work) return null;

    const issued = work.issued?.["date-parts"]?.[0]?.[0];
    const authors = (work.author ?? [])
      .map((author: { name?: string; given?: string; family?: string }) => author.name || [author.given, author.family].filter(Boolean).join(" "))
      .filter(Boolean);

    return {
      provider: "Crossref",
      id: work.URL ?? "",
      title: work.title?.[0] ?? "",
      authors,
      year: issued ? String(issued) : "",
      sourceTitle: work["container-title"]?.[0] ?? "",
      publisher: work.publisher ?? "",
      volume: work.volume ?? "",
      issue: work.issue ?? "",
      pages: work.page ?? "",
      doi: work.DOI ?? doi,
      url: work.URL ?? `https://doi.org/${doi}`,
      pdfUrl: "",
      openAccessUrl: "",
      sourceType: work.type ?? "unknown",
      abstractOrSummary: stripHtml(work.abstract ?? ""),
      validationIssues: [],
      bibtex: "",
      ris: "",
      verificationStatus: "verified",
    };
  } catch {
    return null;
  }
}

async function fetchCrossrefSearchSources(query: string, count: number) {
  try {
    const params = new URLSearchParams({
      "query.bibliographic": query,
      rows: String(count),
      sort: "is-referenced-by-count",
      order: "desc",
    });
    const response = await fetch(`${CROSSREF_ENDPOINT}?${params.toString()}`);
    const payloadResult = await readJsonResponse<CrossrefSearchResponse>(response, "Crossref");
    if (!response.ok || !payloadResult.ok) return [];

    return (payloadResult.data.message?.items ?? [])
      .map(normalizeCrossrefWork)
      .filter((source: CitationSource) => source.title || source.doi)
      .map(finalizeSource);
  } catch {
    return [];
  }
}

function normalizeCrossrefWork(work: CrossrefWork): CitationSource {
  const issued = work.issued?.["date-parts"]?.[0]?.[0];
  const authors = (work.author ?? [])
    .map((author) => author.name || [author.given, author.family].filter(Boolean).join(" "))
    .filter(Boolean);
  const doi = work.DOI ?? "";

  return {
    provider: "Crossref",
    id: work.URL ?? "",
    title: work.title?.[0] ?? "",
    authors,
    year: issued ? String(issued) : "",
    sourceTitle: work["container-title"]?.[0] ?? "",
    publisher: work.publisher ?? "",
    volume: work.volume ?? "",
    issue: work.issue ?? "",
    pages: work.page ?? "",
    doi,
    url: work.URL ?? (doi ? `https://doi.org/${doi}` : ""),
    pdfUrl: "",
    openAccessUrl: "",
    sourceType: work.type ?? "unknown",
    abstractOrSummary: stripHtml(work.abstract ?? ""),
    validationIssues: [],
    bibtex: "",
    ris: "",
    verificationStatus: doi ? "verified" : "likely_verified",
  };
}

function mergeSources(primary: CitationSource, enrichment: CitationSource | null) {
  if (!enrichment) return primary;

  return {
    ...primary,
    title: primary.title || enrichment.title,
    authors: primary.authors.length > 0 ? primary.authors : enrichment.authors,
    year: primary.year || enrichment.year,
    sourceTitle: primary.sourceTitle || enrichment.sourceTitle,
    publisher: primary.publisher || enrichment.publisher,
    volume: primary.volume || enrichment.volume,
    issue: primary.issue || enrichment.issue,
    pages: primary.pages || enrichment.pages,
    doi: primary.doi || enrichment.doi,
    url: primary.url || enrichment.url,
    sourceType: primary.sourceType || enrichment.sourceType,
    abstractOrSummary: primary.abstractOrSummary || enrichment.abstractOrSummary,
    verificationStatus: "verified" as const,
  };
}

function finalizeSource(source: CitationSource): CitationSource {
  const finalized = {
    ...source,
    validationIssues: buildValidationIssues(source),
  };

  return {
    ...finalized,
    bibtex: buildBibtex(finalized),
    ris: buildRis(finalized),
  };
}

function buildCitationPrompt(query: string, sources: CitationSource[]) {
  return `You are a strict citation extraction and reference formatting API. Return exactly one parseable JSON object with no prose and no markdown fences.

Research query:
${query}

Source records from scholarly search:
${JSON.stringify(sources, null, 2)}

Rules:
1. Prefer records with DOIs and full metadata.
2. Do not invent authors, dates, journals, DOI values, pages, or publishers. If missing, use an empty string or empty array.
3. Format citations from the provided metadata in APA 7th, MLA 9th, Chicago author-date, and IEEE.
4. Preserve validationIssues, bibtex, ris, openAccessUrl, pdfUrl, citedByCount, and isOpenAccess fields when present.

JSON shape:
{
  "topic": "normalized research topic",
  "searchAssessment": {
    "coverage": "low|medium|high",
    "note": "brief note about source quality and gaps"
  },
  "references": [
    {
      "title": "paper title",
      "authors": ["Author names"],
      "year": "publication year",
      "sourceTitle": "journal or conference",
      "publisher": "publisher",
      "volume": "volume",
      "issue": "issue",
      "pages": "pages",
      "doi": "DOI",
      "url": "URL",
      "database": "SerpAPI|Crossref|publisher|other",
      "sourceType": "journal_article|conference_paper|preprint|book|chapter|report|dataset|web_source|unknown",
      "abstractOrSummary": "summary",
      "relevance": "why this is useful",
      "citedByCount": 0,
      "isOpenAccess": false,
      "openAccessUrl": "URL",
      "pdfUrl": "URL",
      "validationIssues": [],
      "bibtex": "BibTeX",
      "ris": "RIS",
      "verificationStatus": "verified|likely_verified|needs_manual_review",
      "citationFormats": {
        "apa": "APA",
        "mla": "MLA",
        "chicago": "Chicago",
        "ieee": "IEEE"
      }
    }
  ],
  "recommendedFollowUpSearches": ["searches"]
}`;
}

function buildValidationIssues(source: CitationSource) {
  const issues: string[] = [];
  if (!source.title) issues.push("missing title");
  if (source.authors.length === 0) issues.push("missing authors");
  if (!source.year) issues.push("missing publication year");
  if (!source.sourceTitle) issues.push("missing journal/source title");
  if (!source.doi) issues.push("missing DOI");
  return issues;
}

function buildBibtex(source: CitationSource) {
  const author = source.authors[0]?.split(/\s+/).at(-1)?.replace(/\W/g, "") || "source";
  const year = source.year || "nd";
  const key = `${author}${year}`.toLowerCase();
  const type = source.sourceType.includes("book") ? "book" : "article";
  const fields = [
    ["title", source.title],
    ["author", source.authors.join(" and ")],
    ["year", source.year],
    ["journal", source.sourceTitle],
    ["publisher", source.publisher],
    ["volume", source.volume],
    ["number", source.issue],
    ["pages", source.pages],
    ["doi", source.doi],
    ["url", source.url],
  ].filter(([, value]) => value);
  return `@${type}{${key},\n${fields.map(([f, v]) => `  ${f} = {${v}}`).join(",\n")}\n}`;
}

function buildRis(source: CitationSource) {
  const type = source.sourceType.includes("book") ? "BOOK" : "JOUR";
  return [
    `TY  - ${type}`,
    ...source.authors.map((a) => `AU  - ${a}`),
    source.title ? `TI  - ${source.title}` : "",
    source.year ? `PY  - ${source.year}` : "",
    source.sourceTitle ? `JO  - ${source.sourceTitle}` : "",
    source.doi ? `DO  - ${source.doi}` : "",
    source.url ? `UR  - ${source.url}` : "",
    "ER  -",
  ].filter(Boolean).join("\n");
}

function extractDoi(value: string) {
  return value.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)?.[0] ?? "";
}

async function readJsonResponse<T>(response: Response, serviceName: string): Promise<any> {
  const text = await response.text();
  if (!response.ok) return { ok: false, error: `${serviceName} error: ${text.slice(0, 100)}` };
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: `${serviceName} invalid JSON` };
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

function extractJsonText(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  return start !== -1 && end > start ? value.slice(start, end + 1) : value;
}

function clampCount(count: number) {
  return Math.max(3, Math.min(10, Math.trunc(count) || 8));
}

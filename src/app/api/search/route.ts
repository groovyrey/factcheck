import { logger } from "@/lib/logger";

type LangSearchResponse = {
  code?: number;
  msg?: string | null;
  data?: {
    queryContext?: {
      originalQuery?: string;
    };
    webPages?: {
      webSearchUrl?: string;
      value?: Array<{
        id?: string;
        name?: string;
        url?: string;
        displayUrl?: string;
        snippet?: string;
        summary?: string;
        datePublished?: string;
        dateLastCrawled?: string;
      }>;
    };
    images?: {
      value?: Array<{
        name?: string;
        thumbnailUrl?: string;
        contentUrl?: string;
        hostPageUrl?: string;
      }>;
    };
    videos?: {
      value?: Array<{
        name?: string;
        thumbnailUrl?: string;
        contentUrl?: string;
        hostPageUrl?: string;
        embedHtml?: string;
      }>;
    };
  };
};

type SearchRequest = {
  query?: string;
  count?: number;
};

export async function POST(request: Request) {
  const apiKey = process.env.LANGSEARCH_API_KEY;

  if (!apiKey) {
    logger.error("POST /api/search: LANGSEARCH_API_KEY is not configured.");
    return Response.json(
      { error: "LANGSEARCH_API_KEY is not configured." },
      { status: 500 },
    );
  }

  let body: SearchRequest;

  try {
    body = (await request.json()) as SearchRequest;
    logger.info("POST /api/search: Request received", { query: body.query, count: body.count });
  } catch (e) {
    logger.error("POST /api/search: Failed to parse request body", e);
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const count = typeof body.count === "number" ? body.count : 5;

  if (!query) {
    logger.warn("POST /api/search: Missing query");
    return Response.json({ error: "Search query is required." }, { status: 400 });
  }

  logger.info("POST /api/search: Calling LangSearch API", { query, count });
  const response = await fetch("https://api.langsearch.com/v1/web-search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      freshness: "noLimit",
      summary: true,
      count: clampCount(count),
    }),
  });

  let payload: LangSearchResponse;
  const contentType = response.headers.get("content-type");
  
  if (contentType && contentType.includes("application/json")) {
    try {
      payload = (await response.json()) as LangSearchResponse;
    } catch (e) {
      logger.error("POST /api/search: Failed to parse LangSearch JSON", { status: response.status, error: e });
      return Response.json(
        { error: `Failed to parse LangSearch response as JSON. Status: ${response.status}` },
        { status: 502 },
      );
    }
  } else {
    const text = await response.text();
    logger.error("POST /api/search: LangSearch returned non-JSON response", { status: response.status, bodyPreview: text.slice(0, 200) });
    return Response.json(
      { error: `LangSearch returned non-JSON response. Status: ${response.status}`, details: text.slice(0, 200) },
      { status: 502 },
    );
  }

  if (!response.ok) {
    logger.error("POST /api/search: LangSearch API error", { status: response.status, message: payload.msg });
    return Response.json(
      {
        error:
          payload.msg ??
          `LangSearch returned HTTP ${response.status}.`,
      },
      { status: 502 },
    );
  }

  const results = payload.data?.webPages?.value ?? [];
  logger.info("POST /api/search: Results obtained", { 
    resultsCount: results.length,
    imagesCount: payload.data?.images?.value?.length ?? 0,
    videosCount: payload.data?.videos?.value?.length ?? 0
  });

  return Response.json({
    query: payload.data?.queryContext?.originalQuery ?? query,
    webSearchUrl: payload.data?.webPages?.webSearchUrl ?? "",
    results: results.map((result) => ({
      id: result.id ?? "",
      name: result.name ?? "",
      url: result.url ?? "",
      displayUrl: result.displayUrl ?? "",
      snippet: result.snippet ?? "",
      summary: result.summary ?? "",
      datePublished: result.datePublished ?? "",
      dateLastCrawled: result.dateLastCrawled ?? "",
    })),
    images: (payload.data?.images?.value ?? []).map((img) => ({
      name: img.name ?? "",
      thumbnailUrl: img.thumbnailUrl ?? "",
      contentUrl: img.contentUrl ?? "",
      hostPageUrl: img.hostPageUrl ?? "",
    })),
    videos: (payload.data?.videos?.value ?? []).map((vid) => ({
      name: vid.name ?? "",
      thumbnailUrl: vid.thumbnailUrl ?? "",
      contentUrl: vid.contentUrl ?? "",
      hostPageUrl: vid.hostPageUrl ?? "",
      embedHtml: vid.embedHtml ?? "",
    })),
  });
}

function clampCount(count: number) {
  return Math.max(1, Math.min(10, Math.trunc(count) || 5));
}

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
    return Response.json(
      { error: "LANGSEARCH_API_KEY is not configured." },
      { status: 500 },
    );
  }

  let body: SearchRequest;

  try {
    body = (await request.json()) as SearchRequest;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const count = typeof body.count === "number" ? body.count : 5;

  if (!query) {
    return Response.json({ error: "Search query is required." }, { status: 400 });
  }

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

  const payload = (await response.json()) as LangSearchResponse;

  if (!response.ok) {
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
  const images = payload.data?.images?.value ?? [];
  const videos = payload.data?.videos?.value ?? [];

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
    images: images.map((img) => ({
      name: img.name ?? "",
      thumbnailUrl: img.thumbnailUrl ?? "",
      contentUrl: img.contentUrl ?? "",
      hostPageUrl: img.hostPageUrl ?? "",
    })),
    videos: videos.map((vid) => ({
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

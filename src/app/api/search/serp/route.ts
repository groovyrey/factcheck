import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const SERP_ENDPOINT = "https://serpapi.com/search";

export async function POST(req: NextRequest) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    logger.error("POST /api/search/serp: SERP_API_KEY is not set");
    return NextResponse.json({ error: "SERP_API_KEY is not set" }, { status: 500 });
  }

  try {
    const { query, engine = "google" } = await req.json();
    logger.info("POST /api/search/serp: Request received", { query, engine });

    if (!query) {
      logger.warn("POST /api/search/serp: Missing query");
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const url = new URL(SERP_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("engine", engine);
    url.searchParams.set("api_key", apiKey);

    logger.info("POST /api/search/serp: Calling SerpApi", { engine, query });
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      logger.error("POST /api/search/serp: SerpApi error", { status: response.status, error: data.error });
      return NextResponse.json({ error: data.error || "SerpApi error" }, { status: response.status });
    }

    // Normalize results to match our UI expectations
    const organicResults = data.organic_results || data.scholar_results || [];
    const results = organicResults.map((res: any) => ({
      name: res.title || res.name || "No Title",
      url: res.link || res.url || "",
      snippet: res.snippet || res.description || "",
    }));

    logger.info("POST /api/search/serp: Results obtained", { count: results.length });
    return NextResponse.json({ results });
  } catch (error: any) {
    logger.error("POST /api/search/serp: Unexpected error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

const SERP_ENDPOINT = "https://serpapi.com/search";

export async function POST(req: NextRequest) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    logger.error("POST /api/search/serp: SERP_API_KEY is not set");
    return NextResponse.json({ error: "SERP_API_KEY is not set" }, { status: 500 });
  }

  try {
    const body = SerpBodySchema.parse(await req.json());
    const query = body.query;
    const engine = body.engine;
    logger.info("POST /api/search/serp: Request received", { query, engine });

    const url = new URL(SERP_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("engine", engine);
    url.searchParams.set("api_key", apiKey);

    logger.info("POST /api/search/serp: Calling SerpApi", { engine, query });
    const response = await fetch(url.toString());
    const data = (await response.json().catch(() => ({}))) as unknown;

    if (!response.ok) {
      const err = extractStringField(data, "error") ?? "SerpApi error";
      logger.error("POST /api/search/serp: SerpApi error", { status: response.status, error: err });
      return NextResponse.json({ error: err }, { status: response.status });
    }

    // Normalize results to match our UI expectations
    const organicResults =
      extractArrayField(data, "organic_results") ??
      extractArrayField(data, "scholar_results") ??
      [];
    const results = organicResults.map((res) => {
      const r = res && typeof res === "object" ? (res as Record<string, unknown>) : {};
      const name =
        extractStringField(r, "title") ?? extractStringField(r, "name") ?? "No Title";
      const url = extractStringField(r, "link") ?? extractStringField(r, "url") ?? "";
      const snippet =
        extractStringField(r, "snippet") ?? extractStringField(r, "description") ?? "";
      return { name, url, snippet };
    });

    logger.info("POST /api/search/serp: Results obtained", { count: results.length });
    return NextResponse.json({ results });
  } catch (error: unknown) {
    logger.error("POST /api/search/serp: Unexpected error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const SerpBodySchema = z.object({
  query: z.string().min(1, "Query is required"),
  engine: z.string().default("google"),
});

function extractArrayField(payload: unknown, key: string): unknown[] | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return Array.isArray(record[key]) ? (record[key] as unknown[]) : null;
}

function extractStringField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return typeof record[key] === "string" ? (record[key] as string) : null;
}

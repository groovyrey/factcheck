import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import { logger } from "@/lib/logger";

import { rateLimit } from "@/lib/rate-limit";
import { fetchUrlTextBestEffort } from "@/lib/url-fetch";

export const runtime = "nodejs";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemma-4-26b-a4b-it";
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta",
});

const SERP_ENDPOINT = "https://serpapi.com/search";

async function googleSearch(query: string) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return "Error: SERP_API_KEY is not set";

  const limiter = await rateLimit("google_search", 5, 10 * 60 * 1000);
  if (!limiter.success) {
    const minutes = Math.ceil((limiter.resetIn || 0) / 60000);
    return `Error: Google Search rate limit exceeded. Please wait ${minutes} minutes.`;
  }

  try {
    const url = new URL(SERP_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("engine", "google");
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString());
    const data = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      const err = extractStringField(data, "error") ?? "SerpApi error";
      return `Error performing search: ${err}`;
    }

    const organic = extractArrayField(data, "organic_results") ?? [];
    const results = organic
      .slice(0, 5)
      .map((item) => {
        const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const title = extractStringField(r, "title") ?? "No Title";
        const link = extractStringField(r, "link") ?? "";
        const snippet = extractStringField(r, "snippet") ?? "";
        return `Title: ${title}\nURL: ${link}\nSnippet: ${snippet}`;
      })
      .join("\n\n");
    return results || "No results found.";
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return `Error performing search: ${message}`;
  }
}

export async function POST(req: Request) {
  try {
    const body = GeminiBodySchema.parse(await req.json());
    const messages = body.messages;
    logger.info("POST /api/gemini: Request received", { model: GEMINI_MODEL });

    const result = await streamText({
      model: google(GEMINI_MODEL),
      system: messages.find((m) => m.role === "system")?.content,
      messages: messages.filter((m) => m.role !== "system"),
      experimental_continueSteps: true,
      providerOptions: {
        google: {
          thought: false,
        },
      },
      tools: {
        google_search: tool({
          description: "Performs a Google search to find new information.",
          parameters: z.object({
            query: z.string().describe("The search query to look up on Google."),
          }),
          execute: async ({ query }) => ({ content: await googleSearch(query) }),
        }),
        fetch_url: tool({
          description: "Fetches the content of a specific URL and returns the text content.",
          parameters: z.object({
            url: z.string().describe("The URL to fetch content from."),
          }),
          execute: async ({ url }) => ({ content: await fetchUrlTextBestEffort(url) }),
        }),
      },
      maxSteps: 5,
      onFinish: ({ text }) => {
        logger.info("Assistant response completed", {
          textLength: text.length,
          preview: text.slice(0, 300),
        });
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        logger.error("Stream Error", error);
        return error instanceof Error ? error.message : String(error);
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    logger.error("POST /api/gemini: Error initializing stream", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

const GeminiBodySchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
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

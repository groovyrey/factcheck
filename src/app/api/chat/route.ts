import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { fetchUrlTextBestEffort } from "@/lib/url-fetch";
import { z } from "zod";

export const runtime = "nodejs";

const modelsArray = [
  "inclusionai/ring-2.6-1t:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "liquid/lfm-2.5-1.2b-instruct:free"
];
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? modelsArray[0];
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const SERP_ENDPOINT = "https://serpapi.com/search";

async function googleSearch(query: string) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    logger.error("googleSearch: SERP_API_KEY is not set");
    return "Error: SERP_API_KEY is not set";
  }

  // Rate limit: 5 requests per 10 minutes to save quota
  const limiter = await rateLimit("google_search", 5, 10 * 60 * 1000);
  if (!limiter.success) {
    const minutes = Math.ceil((limiter.resetIn || 0) / 60000);
    return `Error: Google Search rate limit exceeded. Please wait ${minutes} minutes. This is a safety measure to protect API quota.`;
  }

  try {
    logger.info("Performing Google Search", { query });
    const url = new URL(SERP_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("engine", "google");
    url.searchParams.set("api_key", apiKey);

    const response = await fetch(url.toString());
    const data = (await response.json().catch(() => ({}))) as unknown;

    if (!response.ok) {
      const err = extractStringField(data, "error") ?? "SerpApi error";
      logger.error("googleSearch: SerpApi error", err);
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

    logger.info("Google Search results obtained", { count: organic.length });
    return results || "No results found.";
  } catch (error: unknown) {
    logger.error("googleSearch: Unexpected error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return `Error performing search: ${message}`;
  }
}

async function fetchUrlContent(url: string) {
  try {
    logger.info("fetchUrlContent: Fetch requested", { url });
    return await fetchUrlTextBestEffort(url);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("fetchUrlContent: Unexpected error", { url, message });
    return `Error fetching URL: ${message}`;
  }
}

const tools = [
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetches the content of a specific URL and returns the text content. Use this to get more details from a specific search result or website.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch content from.",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "google_search",
      description: "Performs a Google search to find new information or websites. Use this if the initial search results are not sufficient or if you need to look up something new.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up on Google.",
          },
        },
        required: ["query"],
      },
    },
  },
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.error("POST /api/chat: OPENROUTER_API_KEY is not set");
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not set" }, { status: 500 });
  }

  try {
    const body = OpenRouterBodySchema.parse(await req.json());
    const messages = body.messages;
    logger.info("POST /api/chat: Request received", { messageCount: messages.length });
    
    const currentMessages = [...messages];
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      logger.info(`POST /api/chat: OpenRouter iteration ${iterations + 1}`, { model: OPENROUTER_MODEL });
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/gemini-cli",
          "X-Title": "Research Tool",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: currentMessages,
          tools: tools,
          tool_choice: "auto",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        const err = extractNestedMessage(data) ?? "OpenRouter API error";
        logger.error("POST /api/chat: OpenRouter API error", { status: response.status, error: err });
        return NextResponse.json({ error: err }, { status: response.status });
      }

      const message = extractChoiceMessage(data);
      if (!message) {
        logger.warn("POST /api/chat: OpenRouter returned no message");
        break;
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        logger.info("POST /api/chat: OpenRouter requested tool calls", { count: message.tool_calls.length });
        currentMessages.push({
          role: "assistant",
          content: message.content ?? "",
          tool_calls: message.tool_calls,
        });
        
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function?.name;
          const args = safeJsonParse(toolCall.function?.arguments);
          if (toolName === "fetch_url") {
            const url = typeof args?.url === "string" ? args.url : "";
            const content = await fetchUrlContent(url || "");
            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: content,
            });
          } else if (toolName === "google_search") {
            const q = typeof args?.query === "string" ? args.query : "";
            const content = await googleSearch(q);
            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: content,
            });
          }
        }
        iterations++;
      } else {
        const text = message.content || "";
        logger.info("POST /api/chat: Response completed", { textLength: text.length });
        return NextResponse.json({ text, model: OPENROUTER_MODEL });
      }
    }

    logger.warn("POST /api/chat: Too many tool call iterations");
    return NextResponse.json({ error: "Too many tool call iterations" }, { status: 500 });
  } catch (error: unknown) {
    logger.error("POST /api/chat: Unexpected error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const OpenRouterBodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string().optional(),
    }).passthrough(),
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

function safeJsonParse(text: unknown): Record<string, unknown> | null {
  if (typeof text !== "string") return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function extractNestedMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const err = record.error;
  if (!err || typeof err !== "object") return null;
  const errRec = err as Record<string, unknown>;
  return typeof errRec.message === "string" ? errRec.message : null;
}

type OpenRouterToolCall = {
  id: string;
  function: { name: string; arguments: string };
};

type OpenRouterChoiceMessage = {
  content?: string;
  tool_calls?: OpenRouterToolCall[];
};

function extractChoiceMessage(payload: unknown): OpenRouterChoiceMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const msg = (first as Record<string, unknown>).message;
  if (!msg || typeof msg !== "object") return null;

  const m = msg as Record<string, unknown>;
  const toolCallsRaw = m.tool_calls;
  const tool_calls = Array.isArray(toolCallsRaw)
    ? toolCallsRaw
        .map((tc) => {
          if (!tc || typeof tc !== "object") return null;
          const tcr = tc as Record<string, unknown>;
          const id = typeof tcr.id === "string" ? tcr.id : "";
          const fn = tcr.function;
          if (!fn || typeof fn !== "object") return null;
          const fnr = fn as Record<string, unknown>;
          const name = typeof fnr.name === "string" ? fnr.name : "";
          const args = typeof fnr.arguments === "string" ? fnr.arguments : "{}";
          if (!id || !name) return null;
          return { id, function: { name, arguments: args } } satisfies OpenRouterToolCall;
        })
        .filter(Boolean)
    : undefined;

  const content = typeof m.content === "string" ? m.content : undefined;
  return { content, tool_calls: tool_calls as OpenRouterToolCall[] | undefined };
}

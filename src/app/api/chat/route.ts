import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const modelsArray = [
  "inclusionai/ring-2.6-1t:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "liquid/lfm-2.5-1.2b-instruct:free"
];
const OPENROUTER_MODEL = modelsArray[0];
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
    const data = await response.json();

    if (!response.ok) {
      logger.error("googleSearch: SerpApi error", data.error || "SerpApi error");
      return `Error performing search: ${data.error || "SerpApi error"}`;
    }

    const results = (data.organic_results || []).slice(0, 5).map((res: any) => 
      `Title: ${res.title}\nURL: ${res.link}\nSnippet: ${res.snippet}`
    ).join("\n\n");

    logger.info("Google Search results obtained", { count: (data.organic_results || []).length });
    return results || "No results found.";
  } catch (error: any) {
    logger.error("googleSearch: Unexpected error", error);
    return `Error performing search: ${error.message}`;
  }
}

async function fetchUrlContent(url: string) {
  const fetchWithHeaders = async (targetUrl: string, useJina = false) => {
    const finalUrl = useJina ? `https://r.jina.ai/${targetUrl}` : targetUrl;
    const response = await fetch(finalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Upgrade-Insecure-Requests": "1"
      }
    });
    return response;
  };

  try {
    logger.info("fetchUrlContent: Attempting direct fetch", { url });
    let response = await fetchWithHeaders(url);
    
    // If forbidden or blocked, try via Jina Reader
    if (response.status === 403 || response.status === 429 || response.status === 401) {
      logger.warn(`fetchUrlContent: Direct fetch returned ${response.status}. Retrying via Jina...`, { url });
      response = await fetchWithHeaders(url, true);
    }

    if (!response.ok) {
      return `Error fetching URL: ${response.status} ${response.statusText}`;
    }

    const text = await response.text();
    // Clean up content
    const cleanedText = text
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    
    return cleanedText.slice(0, 20000); 
  } catch (error: any) {
    logger.error("fetchUrlContent: Unexpected error", { url, error: error.message });
    return `Error fetching URL: ${error.message}`;
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
    const { messages } = await req.json();
    logger.info("POST /api/chat: Request received", { messageCount: messages.length });
    
    let currentMessages = [...messages];
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

      const data = await response.json();
      if (!response.ok) {
        logger.error("POST /api/chat: OpenRouter API error", { status: response.status, error: data.error });
        return NextResponse.json({ error: data.error?.message || "OpenRouter API error" }, { status: response.status });
      }

      const message = data.choices?.[0]?.message;
      if (!message) {
        logger.warn("POST /api/chat: OpenRouter returned no message");
        break;
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        logger.info("POST /api/chat: OpenRouter requested tool calls", { count: message.tool_calls.length });
        currentMessages.push(message);
        
        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name === "fetch_url") {
            const { url } = JSON.parse(toolCall.function.arguments);
            const content = await fetchUrlContent(url);
            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: content,
            });
          } else if (toolCall.function.name === "google_search") {
            const { query } = JSON.parse(toolCall.function.arguments);
            const content = await googleSearch(query);
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
  } catch (error: any) {
    logger.error("POST /api/chat: Unexpected error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

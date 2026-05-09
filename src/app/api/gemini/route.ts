import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const GEMINI_MODEL = "gemma-4-26b-a4b-it";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
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
    const data = await response.json();
    if (!response.ok) return `Error performing search: ${data.error || "SerpApi error"}`;
    const results = (data.organic_results || []).slice(0, 5).map((res: any) => 
      `Title: ${res.title}\nURL: ${res.link}\nSnippet: ${res.snippet}`
    ).join("\n\n");
    return results || "No results found.";
  } catch (error: any) {
    return `Error performing search: ${error.message}`;
  }
}

async function fetchUrlContent(url: string) {
  const fetchWithHeaders = async (targetUrl: string, useJina = false) => {
    const finalUrl = useJina ? `https://r.jina.ai/${targetUrl}` : targetUrl;
    return await fetch(finalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      }
    });
  };

  try {
    let response = await fetchWithHeaders(url);
    if (response.status === 403 || response.status === 429 || response.status === 401) {
      response = await fetchWithHeaders(url, true);
    }
    if (!response.ok) return `Error fetching URL: ${response.status} ${response.statusText}`;
    const text = await response.text();
    const cleanedText = text
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleanedText.slice(0, 20000); 
  } catch (error: any) {
    return `Error fetching URL: ${error.message}`;
  }
}

const geminiTools = [
  {
    function_declarations: [
      {
        name: "fetch_url",
        description: "Fetches the content of a specific URL and returns the text content.",
        parameters: {
          type: "OBJECT",
          properties: {
            url: { type: "STRING", description: "The URL to fetch content from." }
          },
          required: ["url"]
        }
      },
      {
        name: "google_search",
        description: "Performs a Google search to find new information.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "The search query to look up on Google." }
          },
          required: ["query"]
        }
      }
    ]
  }
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });

  try {
    const { messages } = await req.json();
    logger.info("POST /api/gemini: Request received", { messageCount: messages?.length });

    const systemMessage = messages.find((m: any) => m.role === "system");
    const userMessages = messages.filter((m: any) => m.role !== "system");

    let contents = userMessages.map((m: any) => {
      const role = m.role === "assistant" ? "model" : "user";
      if (m.parts && Array.isArray(m.parts)) {
        return {
          role,
          parts: m.parts.map((p: any) => {
            const part: any = {};
            if (p.text) part.text = p.text;
            if (p.thought) part.thought = p.thought;
            if (p.functionCall) part.functionCall = p.functionCall;
            if (p.functionResponse) part.functionResponse = p.functionResponse;
            return part;
          })
        };
      }
      return {
        role,
        parts: [{ text: m.content || " " }]
      };
    });

    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      const body: any = {
        contents,
        tools: geminiTools,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      };

      if (systemMessage) {
        body.system_instruction = { parts: [{ text: systemMessage.content }] };
      }

      logger.info(`POST /api/gemini: Calling ${GEMINI_MODEL}`, { iterations });

      const response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        logger.error("POST /api/gemini: API error", { status: response.status, error: data.error });
        return NextResponse.json({ error: data.error?.message || "Internal API Error" }, { status: response.status });
      }

      const candidate = data.candidates?.[0];
      const messageParts = candidate?.content?.parts || [];
      const functionCalls = messageParts.filter((p: any) => p.functionCall);

      if (functionCalls.length > 0) {
        contents.push(candidate.content);
        const responseParts = [];
        for (const part of functionCalls) {
          const { name, args } = part.functionCall;
          let result;
          if (name === "fetch_url") result = await fetchUrlContent(args.url);
          else if (name === "google_search") result = await googleSearch(args.query);
          responseParts.push({
            functionResponse: { name, response: { content: result } }
          });
        }
        contents.push({ role: "user", parts: responseParts });
        iterations++;
      } else {
        const text = messageParts.filter((p: any) => !p.thought).map((p: any) => p.text).join("") || "";
        return NextResponse.json({ text, parts: messageParts, model: GEMINI_MODEL });
      }
    }
    return NextResponse.json({ error: "Too many iterations" }, { status: 500 });
  } catch (error: any) {
    logger.error("POST /api/gemini: Unexpected error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

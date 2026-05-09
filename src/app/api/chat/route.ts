import { NextRequest, NextResponse } from "next/server";

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
  if (!apiKey) return "Error: SERP_API_KEY is not set";

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
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    if (!response.ok) return `Error fetching URL: ${response.status} ${response.statusText}`;
    
    const html = await response.text();
    // Basic tag stripping to get readable text
    const text = html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    
    return text.slice(0, 10000); // Truncate to avoid context overflow
  } catch (error: any) {
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
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not set" }, { status: 500 });
  }

  try {
    const { messages } = await req.json();
    let currentMessages = [...messages];
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
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
        return NextResponse.json({ error: data.error?.message || "OpenRouter API error" }, { status: response.status });
      }

      const message = data.choices?.[0]?.message;
      if (!message) break;

      if (message.tool_calls && message.tool_calls.length > 0) {
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
        return NextResponse.json({ text, model: OPENROUTER_MODEL });
      }
    }

    return NextResponse.json({ error: "Too many tool call iterations" }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

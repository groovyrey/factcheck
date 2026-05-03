const GEMMA_MODEL = "gemma-4-31b-it";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent`;

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

type AuthorAnalysisInput = {
  author?: string;
  post?: unknown;
  webSearch?: unknown;
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  let body: AuthorAnalysisInput;

  try {
    body = (await request.json()) as AuthorAnalysisInput;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const author = typeof body.author === "string" ? body.author.trim() : "";

  if (!author) {
    return Response.json({ error: "Author name is required." }, { status: 400 });
  }

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildPrompt(author, body.post, body.webSearch),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  const payload = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    return Response.json(
      {
        error:
          payload.error?.message ??
          `Gemini API returned HTTP ${response.status}.`,
      },
      { status: 502 },
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    return Response.json(
      { error: "Gemma returned an empty response." },
      { status: 502 },
    );
  }

  try {
    return Response.json({
      analysis: JSON.parse(extractJsonText(text)),
      model: GEMMA_MODEL,
    });
  } catch {
    return Response.json({
      analysis: {
        rawText: text,
        parseWarning: "Gemma did not return valid JSON.",
      },
      model: GEMMA_MODEL,
    });
  }
}

function buildPrompt(author: string, post: unknown, webSearch: unknown) {
  const systemContext = "You are a strict JSON-only API. You MUST NOT include any preamble, reasoning, introduction, or notes. Your entire response must be a single parseable JSON object.";

  if (!webSearch) {
    return `${systemContext}

You are an investigative researcher. Generate exactly ONE optimized web search query to find information about the following topic or entity.

Topic/Entity: ${author}

Focus on finding factual information, credibility signals, history, or any potential controversies.

Use this JSON shape:
{
  "query": "the optimized investigative search query"
}

Context (if available):
${JSON.stringify(post, null, 2)}`;
  }

  return `${systemContext}

You are an investigative researcher. Synthesize the following web search evidence to provide a detailed analysis of the topic/entity.

Topic/Entity: ${author}

Use this JSON shape:
{
  "entity": "name of the topic/entity",
  "summary": "A concise synthesis of the findings.",
  "credibilityScore": 0,
  "verdict": "likely_reliable|unclear|potentially_misleading",
  "confidence": "low|medium|high",
  "positiveSignals": ["evidence supporting reliability or facts"],
  "negativeSignals": ["red flags or conflicting information"],
  "evidence": [
    {
      "source": "source name",
      "url": "source url",
      "note": "why this source is relevant"
    }
  ],
  "relatedEntities": ["affiliated people, organizations, or related topics"],
  "recommendedNextStep": "what to look for next",
  "searchQueries": ["follow-up searches to refine the research"]
}

Search Evidence JSON:
${JSON.stringify(webSearch, null, 2)}`;
}

function extractJsonText(value: string) {
  // 1. Try to find the last occurrence of a JSON code block
  const fencedMatches = [...value.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  if (fencedMatches.length > 0) {
    const lastMatch = fencedMatches[fencedMatches.length - 1][1];
    return lastMatch.trim();
  }

  // 2. Fallback: Find the last valid-looking JSON object using braces
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    // If there's a lot of text, we try to find the specific JSON block that matches our schema
    // But for simplicity, we'll take the largest spanning block or the last one if we can identify it.
    // Given Gemma's behavior, the final answer is usually the last block.
    
    // Attempt to find the last complete { ... } block
    let depth = 0;
    for (let i = value.length - 1; i >= 0; i--) {
      if (value[i] === "}") depth++;
      if (value[i] === "{") {
        depth--;
        if (depth === 0) {
          return value.slice(i, lastBrace + 1).trim();
        }
      }
    }

    return value.slice(firstBrace, lastBrace + 1).trim();
  }

  return value.trim();
}

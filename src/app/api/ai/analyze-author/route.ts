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
  return `Return a single JSON object only. Do not include markdown, code fences, bullet points, analysis notes, or prose before or after the JSON.

Assess whether this Facebook author/page appears authentic based on the web search results and extracted post context.

Do not verify the post claim itself. Focus on the author identity and credibility signals.

Use this JSON shape:
{
  "author": "author/page name",
  "credibilitySummary": "A concise summary of the author's credibility, authenticity, and potential biases based on available evidence.",
  "credibilityScore": 0,
  "authenticityVerdict": "likely_real|unclear|likely_unverified",
  "confidence": "low|medium|high",
  "positiveSignals": ["signals that support the author being a real or established entity"],
  "negativeSignals": ["signals that raise doubt or indicate ambiguity"],
  "evidence": [
    {
      "source": "source name",
      "url": "source url",
      "note": "why this source matters"
    }
  ],
  "relatedEntities": ["people, orgs, pages, places"],
  "recommendedNextStep": "what a reviewer should do next",
  "searchQueries": ["follow-up searches to refine identity"],
  "missingContext": ["what is still unknown about the author"]
}

Author:
${author}

Extracted post JSON:
${JSON.stringify(post, null, 2)}

Web search JSON:
${JSON.stringify(webSearch, null, 2)}`;
}

function extractJsonText(value: string) {
  const fencedJson = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];

  if (fencedJson) {
    return fencedJson.trim();
  }

  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1).trim();
  }

  return value.trim();
}

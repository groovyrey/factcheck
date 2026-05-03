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

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const post = typeof body === "object" && body !== null && "post" in body
    ? body.post
    : null;

  if (!post) {
    return Response.json({ error: "Missing extracted post data." }, { status: 400 });
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
              text: buildPrompt(post),
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

function buildPrompt(post: unknown) {
  return `Return a single JSON object only. Do not include markdown, code fences, bullet points, analysis notes, or prose before or after the JSON.

Analyze this extracted Facebook post data.

Do not verify the claims yet. Extract what should be checked.

Use this JSON shape:
{
  "summary": "short neutral summary",
  "language": "detected language",
  "author": "author/page if present",
  "isTruncated": true,
  "needsManualCapture": true,
  "claims": [
    {
      "claim": "specific factual claim",
      "type": "event|quote|health|politics|science|public_safety|other",
      "priority": "high|medium|low",
      "whyCheck": "why this claim needs verification"
    }
  ],
  "entities": ["people, orgs, places, named subjects"],
  "searchQueries": ["queries a reviewer should run"],
  "missingContext": ["what is missing because extraction may be partial"],
  "draftVerdict": "not enough evidence|needs review|likely non-factual"
}

Extracted post JSON:
${JSON.stringify(post, null, 2)}`;
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

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

  let body: { text?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const text = body.text?.trim();

  if (!text) {
    return Response.json({ error: "Text is required for proofreading." }, { status: 400 });
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
              text: buildProofreadPrompt(text),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
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

  const aiText = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!aiText) {
    return Response.json(
      { error: "Gemma returned an empty response." },
      { status: 502 },
    );
  }

  try {
    return Response.json({
      analysis: JSON.parse(extractJsonText(aiText)),
      model: GEMMA_MODEL,
    });
  } catch {
    return Response.json({
      analysis: {
        rawText: aiText,
        parseWarning: "Gemma did not return valid JSON.",
      },
      model: GEMMA_MODEL,
    });
  }
}

function buildProofreadPrompt(text: string) {
  return `You are a specialized Linguistic Forensic Agent. Your function is to analyze text for structural integrity, tone authenticity, and linguistic clarity.

Return exactly ONE JSON object. No prose, no markdown fences.

Text to analyze:
"${text}"

JSON Structure:
{
  "module": "linguistic_forensics_v1",
  "audit": {
    "authenticityScore": 0-100,
    "detectedTone": "Forensic description of tone",
    "readabilityIndex": "Gunning Fog or similar level",
    "lexicalDensity": "percentage/description",
    "clarity": {
      "score": 0-100,
      "assessment": "is this easy to understand?"
    },
    "conciseness": {
      "score": 0-100,
      "assessment": "can this be shorter?"
    },
    "engagement": {
      "score": 0-100,
      "assessment": "does it sound natural?"
    }
  },
  "deviations": [
    {
      "category": "grammar|orthography|syntax|tone_clash",
      "fragment": "exact snippet",
      "correction": "suggested fix",
      "rationale": "technical reason for change",
      "criticality": "low|medium|high"
    }
  ],
  "structuralImprovements": [
    "advice on flow, transition, impact, clarity, conciseness, and naturalness"
  ],
  "reconstructedContent": "the optimized version of the text"
}

Constraints:
1. The "fragment" must be exact for string replacement.
2. Be rigorous and objective.`;
}

function extractJsonText(value: string) {
  const fencedMatches = [...value.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  if (fencedMatches.length > 0) {
    return fencedMatches[fencedMatches.length - 1][1].trim();
  }

  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1).trim();
  }

  return value.trim();
}

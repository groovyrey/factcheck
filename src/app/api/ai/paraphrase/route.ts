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

  let body: { text?: string; targetStyle?: string; intent?: string; tone?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const text = body.text?.trim();
  const style = body.targetStyle || "Standard";
  const intent = body.intent || "formal";
  const tone = body.tone || "professional";

  if (!text) {
    return Response.json({ error: "Text is required for paraphrasing." }, { status: 400 });
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
              text: buildParaphrasePrompt(text, style, intent, tone),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7, // Higher temperature for creative paraphrasing
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

function buildParaphrasePrompt(text: string, style: string, intent: string, tone: string) {
  return `You are a specialized Semantic Re-encoding Agent. Your function is to transform the input text into a specific target style while preserving all core semantic meaning and factual data.

Return exactly ONE JSON object. No prose, no markdown fences.

Target Style: ${style}
Intent: ${intent}
Tone: ${tone}

Text to Transform:
"${text}"

JSON Structure:
{
  "module": "semantic_reencoding_v1",
  "transformation": {
    "originalStyle": "detected style of input",
    "targetStyleApplied": "${style}",
    "intentApplied": "${intent}",
    "toneApplied": "${tone}",
    "semanticPreservationScore": 0-100,
    "complexityShift": "increased|decreased|stable",
    "clarityScore": 0-100,
    "concisenessScore": 0-100,
    "engagementScore": 0-100
  },
  "reencodedText": "the fully paraphrased version of the text",
  "keyChanges": [
    {
      "type": "vocabulary|syntax|tone|brevity|intent|clarity|engagement",
      "note": "what was changed and why"
    }
  ],
  "alternativeOptions": [
    "a shorter alternative version",
    "a more punchy alternative version"
  ]
}

Constraints:
1. Ensure the reencoded text is naturally flowing and fits the requested style perfectly.
2. Match the requested intent and tone exactly.
3. Improve clarity, conciseness, and natural engagement when possible.
4. Do not lose any information.`;
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

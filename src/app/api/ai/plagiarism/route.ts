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

type PhraseSearchResult = {
  phrase: string;
  results: unknown[];
};

export async function POST(request: Request) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const langSearchKey = process.env.LANGSEARCH_API_KEY;

  if (!geminiKey || !langSearchKey) {
    return Response.json(
      { error: "API keys are not configured." },
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
    return Response.json({ error: "Text is required for plagiarism check." }, { status: 400 });
  }

  // Step 1: Extract fingerprint phrases
  const extractResponse = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildExtractPrompt(text) }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  const extractData = (await extractResponse.json()) as GeminiResponse;
  const extractText = extractData.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let phrases: string[] = [];
  try {
    phrases = JSON.parse(extractJsonText(extractText)).phrases || [];
  } catch {
    return Response.json({ error: "Failed to extract search phrases." }, { status: 502 });
  }

  // Step 2: Search for each phrase
  const searchResults = await Promise.all(
    phrases.slice(0, 3).map(async (phrase) => {
      try {
        const searchResp = await fetch("https://api.langsearch.com/v1/web-search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${langSearchKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: `"${phrase}"`, count: 3 }),
        });
        const data = await searchResp.json();
        return { phrase, results: data.data?.webPages?.value || [] };
      } catch {
        return { phrase, results: [] };
      }
    })
  );

  // Step 3: Synthesize report
  const synthesizeResponse = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildSynthesizePrompt(text, searchResults) }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  const synthesizeData = (await synthesizeResponse.json()) as GeminiResponse;
  const reportText = synthesizeData.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    return Response.json({
      analysis: JSON.parse(extractJsonText(reportText)),
      model: GEMMA_MODEL,
    });
  } catch {
    return Response.json({
      analysis: { rawText: reportText, parseWarning: "Failed to parse report." },
      model: GEMMA_MODEL,
    });
  }
}

function buildExtractPrompt(text: string) {
  return `Extract exactly 3 unique, specific, and identifiable phrases or sentences from the following text that would be effective for detecting plagiarism via web search. Avoid common phrases.
  
Return a JSON object: {"phrases": ["phrase 1", "phrase 2", "phrase 3"]}

Text:
"${text}"`;
}

function buildSynthesizePrompt(text: string, searchResults: PhraseSearchResult[]) {
  return `You are a specialized Content Integrity & Source Attribution Agent. Your function is to verify the origin of content and detect unauthorized duplication or synthesis.

Original Content Fragment:
"${text}"

Search Evidence Data:
${JSON.stringify(searchResults, null, 2)}

Return exactly ONE JSON object:
{
  "module": "attribution_intelligence_v1",
  "integrityReport": {
    "attributionScore": 0-100,
    "verdict": "original|partial_match|high_duplication",
    "riskLevel": "minimal|moderate|critical",
    "forensicSummary": "Detailed technical explanation of findings"
  },
  "evidenceChain": [
    {
      "originUrl": "source url",
      "sourceTitle": "source title",
      "matchCertainty": "low|medium|high",
      "collidingSnippet": "matching snippet from search",
      "localFragment": "the fragment from the original text that matched"
    }
  ],
  "metadata": {
    "scannedPhrases": ["the phrases used for searching"],
    "searchDepth": "standard"
  }
}

If no matches are found, score should be 0 and evidenceChain empty.`;
}

function extractJsonText(value: string) {
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1).trim();
  }
  return value.trim();
}

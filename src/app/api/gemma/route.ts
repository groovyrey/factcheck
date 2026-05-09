import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const GEMMA_MODEL = "gemma-4-31b-it";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("POST /api/gemma: GEMINI_API_KEY is not set");
    return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
  }

  try {
    const { prompt, systemInstruction } = await req.json();
    logger.info("POST /api/gemma: Request received", { promptLength: prompt?.length, hasSystemInstruction: !!systemInstruction });

    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };

    if (systemInstruction) {
      body.system_instruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    logger.info("POST /api/gemma: Calling Gemini API", { model: GEMMA_MODEL });
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      logger.error("POST /api/gemma: Gemini API error", { status: response.status, error: data.error });
      return NextResponse.json({ error: data.error?.message || "Gemma API error" }, { status: response.status });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    logger.info("POST /api/gemma: Response completed", { textLength: text.length });
    return NextResponse.json({ text, model: GEMMA_MODEL });
  } catch (error: any) {
    logger.error("POST /api/gemma: Unexpected error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

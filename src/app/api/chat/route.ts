import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_MODEL = "inclusionai/ring-2.6-1t:free";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not set" }, { status: 500 });
  }

  try {
    const { messages } = await req.json();

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/gemini-cli", // Optional, for OpenRouter rankings
        "X-Title": "Research Tool", // Optional, for OpenRouter rankings
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || "OpenRouter API error" }, { status: response.status });
    }

    const text = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ text, model: OPENROUTER_MODEL });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

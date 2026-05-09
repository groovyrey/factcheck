import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const CLOUDFLARE_ACCOUNT_ID = process.env.CFAI_ACCOUNT_ID;
const MODEL = "@cf/moonshotai/kimi-k2.6";

export async function POST(req: NextRequest) {
  const apiToken = process.env.CFAI_API_TOKEN;
  if (!apiToken) {
    logger.error("POST /api/cloudflare: CFAI_API_TOKEN is not set");
    return NextResponse.json({ error: "CFAI_API_TOKEN is not set" }, { status: 500 });
  }

  if (!CLOUDFLARE_ACCOUNT_ID) {
    logger.error("POST /api/cloudflare: CFAI_ACCOUNT_ID is not set");
    return NextResponse.json({ error: "CFAI_ACCOUNT_ID is not set" }, { status: 500 });
  }

  try {
    const { messages } = await req.json();
    logger.info("POST /api/cloudflare: Request received", { messageCount: messages?.length });

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;

    logger.info("POST /api/cloudflare: Calling Cloudflare AI API", { model: MODEL });
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json();
    if (!response.ok) {
      logger.error("POST /api/cloudflare: Cloudflare API error", { status: response.status, error: data.errors || data });
      return NextResponse.json({ error: data.errors?.[0]?.message || "Cloudflare API error" }, { status: response.status });
    }

    logger.info("POST /api/cloudflare: Cloudflare API response body", { data });

    let text = "";
    if (data.result?.choices?.[0]?.message?.content) {
      text = data.result.choices[0].message.content;
    } else if (typeof data.result === "string") {
      text = data.result;
    } else if (data.result?.response) {
      text = data.result.response;
    } else if (data.result?.text) {
      text = data.result.text;
    } else {
      text = JSON.stringify(data.result);
    }

    logger.info("POST /api/cloudflare: Response completed", { textLength: text.length });
    return NextResponse.json({ text, model: MODEL });
  } catch (error: any) {
    logger.error("POST /api/cloudflare: Unexpected error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

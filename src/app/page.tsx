import HomeClient from "@/components/home/home-client";

export const dynamic = "force-dynamic";

export default function Page() {
  const envStatus = {
    hasLangSearch: Boolean(process.env.LANGSEARCH_API_KEY),
    hasSerpApi: Boolean(process.env.SERP_API_KEY),
    hasGemini: Boolean(process.env.GEMINI_API_KEY),
  };

  return <HomeClient envStatus={envStatus} />;
}


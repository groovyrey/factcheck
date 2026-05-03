import { extractFacebookPost, parseFacebookUrl } from "@/lib/facebook-extractor";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const url = typeof body === "object" && body !== null && "url" in body
    ? String(body.url)
    : "";

  try {
    parseFacebookUrl(url);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid URL." },
      { status: 400 },
    );
  }

  try {
    const post = await extractFacebookPost(url);

    return Response.json({ post });
  } catch (error) {
    return Response.json(
      {
        error: formatExtractionError(error),
      },
      { status: 502 },
    );
  }
}

function formatExtractionError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to extract this Facebook post.";
  }

  if (error.message === "fetch failed") {
    const cause = "cause" in error ? error.cause : undefined;

    if (cause instanceof Error && cause.message) {
      return `Unable to fetch Facebook URL: ${cause.message}`;
    }

    return "Unable to fetch Facebook URL from the server.";
  }

  return error.message;
}

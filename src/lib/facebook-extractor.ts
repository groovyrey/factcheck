export type FacebookMediaItem = {
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
};

export type FacebookPostExtraction = {
  authorName: string;
  authorSlug: string;
  authorType: "profile" | "page" | "unknown";
  authorImage: string;
  canonicalUrl: string;
  captureMode: "public_metadata";
  content: string;
  description: string;
  engagementText: string;
  image: string;
  media: FacebookMediaItem[];
  isTruncated: boolean;
  platform: "facebook";
  postId: string;
  sourceUrl: string;
  status: "complete" | "partial";
  title: string;
  warnings: string[];
  metadata?: Record<string, string>;
};

type Metadata = {
  canonicalUrl?: string;
  description?: string;
  image?: string;
  images: string[];
  videos: string[];
  title?: string;
  type?: string;
  author?: string;
  profileUsername?: string;
  pageId?: string;
  profileId?: string;
  authorId?: string;
  typeHint?: "profile" | "page";
  raw?: Record<string, string>;
};

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.watch",
]);

export function parseFacebookUrl(input: string) {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid Facebook post URL.");
  }

  const normalizedHost = url.hostname.toLowerCase();

  if (!FACEBOOK_HOSTS.has(normalizedHost)) {
    throw new Error("Only Facebook URLs are supported in this importer.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The Facebook URL must use http or https.");
  }

  return {
    normalizedUrl: url.toString(),
    postId: detectFacebookPostId(url),
  };
}

export async function extractFacebookPost(
  input: string,
): Promise<FacebookPostExtraction> {
  const { normalizedUrl, postId } = parseFacebookUrl(input);
  const response = await fetch(normalizedUrl, {
    cache: "no-store",
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; SourceCheck/0.1; +https://sourcecheck.local)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Facebook returned HTTP ${response.status}.`);
  }

  const html = await response.text();
  const metadata = extractMetadata(html);
  const canonicalUrl = metadata.canonicalUrl ?? response.url ?? normalizedUrl;
  const extractedContent = splitEngagementText(
    metadata.description ?? metadata.title ?? extractBodyText(html),
  );
  const contentAuthor = detectAuthorFromText(extractedContent.content);
  const content = cleanText(removeTrailingAuthor(extractedContent.content));
  const isTruncated = looksTruncated(content);
  const authorName = detectAuthorName(metadata, canonicalUrl, contentAuthor);
  const authorType = detectAuthorType(metadata, canonicalUrl);
  
  const finalAuthorId = [metadata.pageId, metadata.profileId, metadata.authorId].find(isValidFacebookId);
  const authorImage = finalAuthorId
    ? `https://graph.facebook.com/${finalAuthorId}/picture?type=large`
    : "";
    
  const warnings = buildWarnings(content, metadata, isTruncated);

  const media: FacebookMediaItem[] = [];
  
  // Add images from metadata
  for (const imgUrl of metadata.images) {
    media.push({ type: "image", url: imgUrl });
  }
  
  // Add videos from metadata
  for (const videoUrl of metadata.videos) {
    media.push({ type: "video", url: videoUrl });
  }
  
  // Fallback to primary image if media is empty
  if (media.length === 0 && metadata.image) {
    media.push({ type: "image", url: metadata.image });
  }

  return {
    authorName,
    authorSlug: detectAuthorSlug(canonicalUrl),
    authorType,
    authorImage,
    canonicalUrl,
    captureMode: "public_metadata",
    content,
    description: metadata.description ?? "",
    engagementText: extractedContent.engagementText,
    image: metadata.image ?? "",
    media,
    isTruncated,
    platform: "facebook",
    postId,
    sourceUrl: normalizedUrl,
    status: warnings.length > 0 ? "partial" : "complete",
    title: metadata.title ?? "Facebook post",
    warnings,
    metadata: metadata.raw,
  };
}

function detectAuthorType(metadata: Metadata, canonicalUrl: string): "profile" | "page" | "unknown" {
  if (metadata.typeHint) return metadata.typeHint;
  
  if (metadata.type === "profile" || metadata.profileUsername || metadata.profileId) {
    return "profile";
  }

  if (metadata.pageId || metadata.type === "website" || metadata.type === "business") {
    return "page";
  }

  const url = canonicalUrl.toLowerCase();
  if (url.includes("/profile.php") || url.includes("/people/") || url.includes("/user/")) {
    return "profile";
  }

  if (url.includes("/pages/") || url.includes("/groups/") || url.includes("/p/")) {
    return "page";
  }

  return "unknown";
}

function detectAuthorSlug(input: string) {
  try {
    const url = new URL(input);
    const [firstSegment] = url.pathname.split("/").filter(Boolean);

    return firstSegment ?? "";
  } catch {
    return "";
  }
}

function detectAuthorName(
  metadata: Metadata,
  canonicalUrl: string,
  contentAuthor: string,
) {
  const descriptionAuthor = detectAuthorFromText(metadata.description ?? "");

  if (descriptionAuthor) {
    return descriptionAuthor;
  }

  if (contentAuthor) {
    return contentAuthor;
  }

  if (metadata.title && looksLikeAuthorName(metadata.title)) {
    return cleanText(metadata.title);
  }

  return detectAuthorSlug(canonicalUrl);
}

function detectAuthorFromText(value: string) {
  const candidate = cleanText(value).match(/\|\s*([^|]+)\s*$/)?.[1] ?? "";

  if (!looksLikeAuthorName(candidate)) {
    return "";
  }

  return cleanText(candidate);
}

function removeTrailingAuthor(value: string) {
  const author = detectAuthorFromText(value);

  if (!author) {
    return value;
  }

  return value.replace(new RegExp(`\\s*\\|\\s*${escapeRegExp(author)}\\s*$`), "");
}

function looksLikeAuthorName(value: string) {
  const cleaned = cleanText(value);

  return (
    cleaned.length > 0 &&
    cleaned.length <= 80 &&
    !/[.!?]\s/.test(cleaned) &&
    !/\b(?:views?|reactions?|comments?|shares?)\b/i.test(cleaned) &&
    !/log in|sign up|facebook/i.test(cleaned)
  );
}

function splitEngagementText(value: string) {
  const cleaned = cleanText(value);
  const engagementPattern =
    /^((?:[\d,.]+[KMB]?\s+(?:views?|reactions?|comments?|shares?)(?:\s*[·|]\s*)?)+)\s*[·|]\s*(.+)$/i;
  const match = cleaned.match(engagementPattern);

  if (!match) {
    return {
      content: cleaned,
      engagementText: "",
    };
  }

  return {
    content: match[2].trim(),
    engagementText: match[1].trim(),
  };
}

function extractMetadata(html: string): Metadata {
  const metadata: Metadata = { raw: {}, images: [], videos: [] };
  const metaPattern = /<meta\s+([^>]*?)>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaPattern.exec(html))) {
    const attributes = match[1];
    const key = (
      getAttribute(attributes, "property") || getAttribute(attributes, "name")
    ).toLowerCase();
    const content = getAttribute(attributes, "content");

    if (!content || !key) {
      continue;
    }

    metadata.raw![key] = decodeHtml(content);

    if (key === "og:title" || key === "twitter:title") {
      metadata.title ??= decodeHtml(content);
    }

    if (key === "og:description" || key === "description") {
      metadata.description ??= decodeHtml(content);
    }

    if (key === "og:image" || key === "twitter:image") {
      const imageUrl = decodeHtml(content);
      metadata.image ??= imageUrl;
      if (!metadata.images.includes(imageUrl)) {
        metadata.images.push(imageUrl);
      }
    }

    if (key === "og:video" || key === "og:video:url" || key === "og:video:secure_url") {
      const videoUrl = decodeHtml(content);
      if (!metadata.videos.includes(videoUrl)) {
        metadata.videos.push(videoUrl);
      }
    }

    if (key === "og:url") {
      metadata.canonicalUrl ??= decodeHtml(content);
    }

    if (key === "og:type") {
      metadata.type = content.toLowerCase();
    }

    if (key === "author" || key === "article:author") {
      metadata.author ??= decodeHtml(content);
    }

    if (key === "profile:username") {
      metadata.profileUsername = decodeHtml(content);
    }

    if (key === "fb:pages") {
      const id = content.split(",")[0].trim();
      if (isValidFacebookId(id)) metadata.pageId = id;
    }
    
    if (key === "fb:profile_id") {
      if (isValidFacebookId(content)) metadata.profileId = content;
    }

    if (key === "fb:admins") {
      const id = content.split(",")[0].trim();
      if (isValidFacebookId(id)) metadata.profileId ??= id;
    }

    if (key === "al:ios:url" || key === "al:android:url") {
      const profileMatch = content.match(/fb:\/\/profile\/(\d+)/i);
      if (profileMatch?.[1] && isValidFacebookId(profileMatch[1])) {
        metadata.profileId = profileMatch[1];
        metadata.typeHint = "profile";
      }

      const pageMatch = content.match(/fb:\/\/page\/(\d+)/i);
      if (pageMatch?.[1] && isValidFacebookId(pageMatch[1])) {
        metadata.pageId = pageMatch[1];
        metadata.typeHint = "page";
      }
      
      const ownerMatch = content.match(/owner_id=(\d+)/i);
      if (ownerMatch?.[1] && isValidFacebookId(ownerMatch[1])) {
        metadata.authorId = ownerMatch[1];
      }
    }
  }

  // Fallback: search raw HTML for common ID markers
  if (!metadata.pageId && !metadata.profileId) {
    const userIdMatch = html.match(/"userID":"(\d+)"/i);
    if (userIdMatch?.[1] && isValidFacebookId(userIdMatch[1])) {
      metadata.profileId = userIdMatch[1];
      metadata.typeHint = "profile";
    }
    
    const actorMatch = html.match(/"actorID":"(\d+)"/i);
    if (actorMatch?.[1] && isValidFacebookId(actorMatch[1])) {
      metadata.authorId = actorMatch[1];
    }
  }

  // Fallback: search raw HTML for more images
  if (metadata.images.length <= 1) {
    const imgMatches = html.matchAll(/<img[^>]+src=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp|gif)[^"']*)["']/gi);
    for (const imgMatch of imgMatches) {
      const url = decodeHtml(imgMatch[1]);
      if (
        url.includes("scontent") && 
        !url.includes("/cp0/") && 
        !url.includes("/p100x100/") &&
        !metadata.images.includes(url)
      ) {
        metadata.images.push(url);
      }
      if (metadata.images.length >= 10) break;
    }
  }

  metadata.title ??= decodeHtml(
    getTagContent(html, "title")?.replace(/\s*\|\s*Facebook\s*$/i, "") ?? "",
  );
  metadata.canonicalUrl ??= decodeHtml(
    getLinkHref(html, "canonical") ?? getLinkHref(html, "alternate") ?? "",
  );

  return metadata;
}

function buildWarnings(content: string, metadata: Metadata, isTruncated: boolean) {
  const warnings: string[] = [];

  if (!content) {
    warnings.push(
      "Facebook did not expose readable post text for this URL. It may require login, be private, or be blocked from server-side access.",
    );
  }

  if (!metadata.image) {
    warnings.push("No public preview image was found.");
  }

  if (content && content.length < 30) {
    warnings.push(
      "Only a short preview was available. Ask the reviewer to confirm the full post text from the original page.",
    );
  }

  if (isTruncated) {
    warnings.push(
      "Facebook exposed a truncated public preview. The full caption is not available from this URL without additional access.",
    );
  }

  return warnings;
}

function looksTruncated(value: string) {
  return /(?:\.\.\.|…)\s*(?:$|[;|])/u.test(value);
}

function detectFacebookPostId(url: URL) {
  const path = url.pathname;
  const directPatterns = [
    /\/share\/p\/([^/?#]+)/i,
    /\/share\/r\/([^/?#]+)/i,
    /\/share\/v\/([^/?#]+)/i,
    /\/share\/([^/?#]+)/i,
    /\/posts\/([^/?#]+)/i,
    /\/videos\/([^/?#]+)/i,
    /\/reel\/([^/?#]+)/i,
    /\/permalink\.php/i,
    /\/photo\.php/i,
    /\/story\.php/i,
  ];

  for (const pattern of directPatterns) {
    const match = path.match(pattern);

    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return (
    url.searchParams.get("story_fbid") ??
    url.searchParams.get("fbid") ??
    url.searchParams.get("v") ??
    url.searchParams.get("id") ??
    ""
  );
}

function extractBodyText(html: string) {
  const body = getTagContent(html, "body") ?? "";

  return body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function getTagContent(html: string, tag: string) {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");

  return html.match(pattern)?.[1];
}

function getLinkHref(html: string, rel: string) {
  const links = html.matchAll(/<link\s+([^>]*?)>/gi);

  for (const link of links) {
    if (getAttribute(link[1], "rel").toLowerCase() === rel) {
      return getAttribute(link[1], "href");
    }
  }

  return "";
}

function getAttribute(attributes: string, name: string) {
  const pattern = new RegExp(`${name}=["']([^"']+)["']`, "i");

  return attributes.match(pattern)?.[1] ?? "";
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .replace(/^Facebook\s*$/i, "")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number(decimal)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidFacebookId(id?: string): id is string {
  if (!id) return false;
  const numericId = id.trim();
  return /^\d+$/.test(numericId) && numericId !== "0";
}

function removeEmptyMetadata(metadata: Metadata) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => Boolean(value)),
  ) as Metadata;
}

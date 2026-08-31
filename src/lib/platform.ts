export type LinkPlatform = "youtube" | "wordwall" | "genially" | "custom";

const KNOWN_PLATFORMS: LinkPlatform[] = ["youtube", "wordwall", "genially", "custom"];

export function detectPlatform(url: string): LinkPlatform {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "custom";
  }

  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
  if (hostname.includes("wordwall.net")) return "wordwall";
  if (hostname.includes("genial.ly")) return "genially";
  return "custom";
}

// Довіряє збереженому platform, якщо це відоме значення (напр. заповнене
// адмінкою при створенні task); інакше визначає платформу по домену url.
export function resolvePlatform(url: string, platform?: string | null): LinkPlatform {
  if (platform && (KNOWN_PLATFORMS as string[]).includes(platform)) {
    return platform as LinkPlatform;
  }
  return detectPlatform(url);
}

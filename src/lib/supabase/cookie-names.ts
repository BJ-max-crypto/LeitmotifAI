export const SB_URL_COOKIE = "leitmotif-sb-url";
export const SB_KEY_COOKIE = "leitmotif-sb-key";

export function isValidSupabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

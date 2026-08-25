export type StoryBible = {
  characters: string;
  plot: string;
  world: string;
};

export const EMPTY_STORY_BIBLE: StoryBible = {
  characters: "",
  plot: "",
  world: "",
};

export function isEmptyStoryBible(bible: StoryBible) {
  return !bible.characters.trim() && !bible.plot.trim() && !bible.world.trim();
}

export function normalizeStoryBible(value: unknown): StoryBible {
  if (!value || typeof value !== "object") return { ...EMPTY_STORY_BIBLE };
  const record = value as Record<string, unknown>;
  return {
    characters: typeof record.characters === "string" ? record.characters : "",
    plot: typeof record.plot === "string" ? record.plot : "",
    world: typeof record.world === "string" ? record.world : "",
  };
}

export function takeLegacyGlobalStoryBible(): StoryBible | null {
  if (typeof window === "undefined") return null;
  try {
    const session = window.sessionStorage.getItem("leitmotif-legacy-bible");
    if (session) {
      window.sessionStorage.removeItem("leitmotif-legacy-bible");
      const bible = normalizeStoryBible(JSON.parse(session));
      return isEmptyStoryBible(bible) ? null : bible;
    }
    const raw = window.localStorage.getItem("leitmotif-writing-prefs");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { storyBible?: unknown };
    if (!parsed.storyBible) return null;
    const bible = normalizeStoryBible(parsed.storyBible);
    delete parsed.storyBible;
    window.localStorage.setItem("leitmotif-writing-prefs", JSON.stringify(parsed));
    return isEmptyStoryBible(bible) ? null : bible;
  } catch {
    return null;
  }
}

export function formatStoryBible(bible: StoryBible) {
  const parts = [
    bible.characters.trim() ? `Characters:\n${bible.characters.trim()}` : "",
    bible.plot.trim() ? `Plot points:\n${bible.plot.trim()}` : "",
    bible.world.trim() ? `World rules:\n${bible.world.trim()}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

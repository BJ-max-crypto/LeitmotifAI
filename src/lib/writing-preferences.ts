export const GOALS = [
  "Fiction / Novel",
  "Screenplay / Script",
  "Personal Blog",
  "Marketing Copy",
  "Academic / Essay",
  "Other",
] as const;

export const GENRES = [
  "Fantasy",
  "Sci-Fi",
  "Mystery & Thriller",
  "Romance",
  "Horror",
  "Screenplay",
  "Historical Fiction",
  "Non-Fiction & Memoir",
  "Other",
] as const;

export const PERSPECTIVES = [
  'First Person — "I"',
  "Third Person Limited",
  "Third Person Omniscient",
  'Second Person — "You"',
  "Other",
] as const;

export const TONES = [
  "Dark & Gritty",
  "Lighthearted & Humorous",
  "Fast-Paced & Action-Packed",
  "Poetic & Descriptive",
  "Professional & Formal",
  "Other",
] as const;

export const AI_EXPERIENCE = [
  "Brand new",
  "Moderate experience",
  "Power user",
  "Other",
] as const;

export const PRIMARY_TASKS = [
  "Overcoming writer's block",
  "Brainstorming plot ideas",
  "Rewriting text",
  "Expanding scenes",
  "Other",
] as const;

export const GUIDANCE_MODES = [
  "Stick strictly to prompt",
  "Offer creative variations",
  "Other",
] as const;

export type WritingPreferences = {
  fullName: string;
  age: number;
  goal: string;
  genre: string;
  perspective: string;
  tone: string;
  aiExperience: string;
  primaryTask: string;
  guidanceMode: string;
  completedAt?: string;
};

export const EMPTY_WRITING_PREFERENCES: WritingPreferences = {
  fullName: "",
  age: 0,
  goal: "",
  genre: "",
  perspective: "",
  tone: "",
  aiExperience: "",
  primaryTask: "",
  guidanceMode: "",
};

export const MINIMUM_AGE = 13;

export function parseAge(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0 && value < 130) {
    return value;
  }
  if (typeof value === "string" && /^\d{1,3}$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (parsed > 0 && parsed < 130) return parsed;
  }
  return null;
}

export function isOldEnough(age: unknown): boolean {
  const parsed = parseAge(age);
  return parsed !== null && parsed >= MINIMUM_AGE;
}

export function isWritingPreferences(value: unknown): value is WritingPreferences {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.fullName === "string";
}

export function hasCompletedOnboarding(value: unknown): value is WritingPreferences {
  return (
    isWritingPreferences(value) &&
    Boolean(value.completedAt) &&
    isOldEnough(value.age)
  );
}

export function formatQuestionnairePrompt(prefs: WritingPreferences | null | undefined) {
  if (!prefs?.completedAt) return "";
  const guidance =
    prefs.guidanceMode === "Stick strictly to prompt"
      ? "Stay tightly aligned with the writer's request. Do not invent extra plot unless asked."
      : prefs.guidanceMode === "Offer creative variations"
        ? "You may offer elegant creative variations while remaining true to the established voice."
        : prefs.guidanceMode
          ? `Collaboration preference: ${prefs.guidanceMode}`
          : "";
  return [
    "Writer profile from onboarding:",
    prefs.fullName ? `Name: ${prefs.fullName}` : "",
    prefs.goal ? `Primary goal: ${prefs.goal}` : "",
    prefs.genre ? `Preferred genre: ${prefs.genre}` : "",
    prefs.perspective ? `Narrative perspective: ${prefs.perspective}` : "",
    prefs.tone ? `Tone and style: ${prefs.tone}` : "",
    prefs.primaryTask ? `They usually want help with: ${prefs.primaryTask}` : "",
    prefs.aiExperience ? `AI familiarity: ${prefs.aiExperience}` : "",
    guidance,
    "Blend these preferences into the prose so the output feels authored for this writer.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const GOALS = [
  "Fiction / Novel",
  "Screenplay / Script",
  "Personal Blog",
  "Marketing Copy",
  "Academic / Essay",
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
] as const;

export const PERSPECTIVES = [
  'First Person — "I"',
  "Third Person Limited",
  "Third Person Omniscient",
  'Second Person — "You"',
] as const;

export const TONES = [
  "Dark & Gritty",
  "Lighthearted & Humorous",
  "Fast-Paced & Action-Packed",
  "Poetic & Descriptive",
  "Professional & Formal",
] as const;

export const AI_EXPERIENCE = [
  "Brand new",
  "Moderate experience",
  "Power user",
] as const;

export const PRIMARY_TASKS = [
  "Overcoming writer's block",
  "Brainstorming plot ideas",
  "Rewriting text",
  "Expanding scenes",
] as const;

export const GUIDANCE_MODES = [
  "Stick strictly to prompt",
  "Offer creative variations",
] as const;

export type WritingPreferences = {
  fullName: string;
  goal: (typeof GOALS)[number] | "";
  genre: (typeof GENRES)[number] | "";
  perspective: (typeof PERSPECTIVES)[number] | "";
  tone: (typeof TONES)[number] | "";
  aiExperience: (typeof AI_EXPERIENCE)[number] | "";
  primaryTask: (typeof PRIMARY_TASKS)[number] | "";
  guidanceMode: (typeof GUIDANCE_MODES)[number] | "";
  completedAt?: string;
};

export const EMPTY_WRITING_PREFERENCES: WritingPreferences = {
  fullName: "",
  goal: "",
  genre: "",
  perspective: "",
  tone: "",
  aiExperience: "",
  primaryTask: "",
  guidanceMode: "",
};

export function isWritingPreferences(value: unknown): value is WritingPreferences {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.fullName === "string";
}

export function hasCompletedOnboarding(value: unknown): value is WritingPreferences {
  return isWritingPreferences(value) && Boolean(value.completedAt);
}

export function formatQuestionnairePrompt(prefs: WritingPreferences | null | undefined) {
  if (!prefs?.completedAt) return "";
  const guidance =
    prefs.guidanceMode === "Stick strictly to prompt"
      ? "Stay tightly aligned with the writer's request. Do not invent extra plot unless asked."
      : "You may offer elegant creative variations while remaining true to the established voice.";
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

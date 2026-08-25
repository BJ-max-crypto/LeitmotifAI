export const WRITING_STYLES = {
  fantasy: {
    label: "Fantasy",
    instruction:
      "Write fantasy: wonder, invented culture, magic or myth treated as real, and concrete otherworldly detail.",
  },
  scifi: {
    label: "Sci-Fi",
    instruction:
      "Write science fiction: speculative technology or future society, ideas embodied in scene, and precise world logic.",
  },
  mystery: {
    label: "Mystery",
    instruction:
      "Write mystery: clues, withheld information, suspicion, and a controlled drip of revelation.",
  },
  romance: {
    label: "Romance",
    instruction:
      "Write romance: desire, intimacy, emotional stakes between people, and chemistry on the page.",
  },
  horror: {
    label: "Horror",
    instruction:
      "Write horror: dread, the uncanny, bodily or psychological threat, and atmosphere that tightens.",
  },
  screenplay: {
    label: "Screenplay",
    instruction:
      "Write as screenplay: scene headings, action lines, and dialogue. Keep it visual and present-tense. Do not use markdown.",
  },
  historical: {
    label: "Historical Fiction",
    instruction:
      "Write historical fiction: period-accurate texture, social constraint, and the past made immediate without modern slang.",
  },
  nonfiction: {
    label: "Non-Fiction",
    instruction:
      "Write non-fiction: factual clarity, grounded claims, and a trustworthy narrative voice.",
  },
  memoir: {
    label: "Memoir",
    instruction:
      "Write memoir: first-person memory, reflective honesty, and scene mixed with interior meaning.",
  },
  essay: {
    label: "Essay",
    instruction:
      "Write an essay: an argument or meditation with a thinking voice, examples, and a through-line.",
  },
  article: {
    label: "Article",
    instruction:
      "Write an article: a clear hook, useful structure, accessible explanation, and a journalistic cadence.",
  },
  literary: {
    label: "Literary",
    instruction:
      "Write in a natural literary voice with careful rhythm, concrete imagery, and emotional precision.",
  },
  dark_fantasy: {
    label: "Dark Fantasy",
    instruction:
      "Write dark fantasy: mythic atmosphere, ominous stakes, tactile world detail, and a grave, lyrical register.",
  },
  academic: {
    label: "Academic",
    instruction:
      "Write in a clear academic register: precise diction, controlled tone, logical flow, and no ornamental flourish.",
  },
  action: {
    label: "Fast-Paced Action",
    instruction:
      "Write fast-paced action: short clauses, kinetic verbs, immediate sensory hits, and forward momentum.",
  },
  conversational: {
    label: "Conversational",
    instruction:
      "Write in a conversational voice: natural speech rhythms, warmth, and unforced contemporary phrasing.",
  },
} as const;

export type WritingStyle = keyof typeof WRITING_STYLES;
export const WRITING_STYLE_KEYS = Object.keys(WRITING_STYLES) as WritingStyle[];

export const CREATIVITY_LEVELS = {
  Low: "Stay conservative. Prefer clarity, continuity, and close adherence to the existing draft.",
  Medium: "Balance invention with continuity. Add texture without derailing plot or voice.",
  High: "Be bold. Take stylish risks while remaining coherent with the story so far.",
} as const;

export type CreativityLevel = keyof typeof CREATIVITY_LEVELS;

export function isWritingStyle(value: unknown): value is WritingStyle {
  return typeof value === "string" && value in WRITING_STYLES;
}

export function parseWritingStyles(value: unknown): WritingStyle[] {
  if (Array.isArray(value)) return value.filter(isWritingStyle);
  if (isWritingStyle(value)) return [value];
  return [];
}

export function formatStyleInstructions(styles: WritingStyle[]) {
  if (styles.length === 0) return WRITING_STYLES.literary.instruction;
  return styles.map((key) => WRITING_STYLES[key].instruction).join(" Also ");
}

export function isCreativityLevel(value: unknown): value is CreativityLevel {
  return value === "Low" || value === "Medium" || value === "High";
}

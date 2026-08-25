import {
  AI_EXPERIENCE,
  GENRES,
  GOALS,
  GUIDANCE_MODES,
  PERSPECTIVES,
  PRIMARY_TASKS,
  TONES,
  type WritingPreferences,
} from "@/lib/writing-preferences";

export type OnboardingStep = {
  key: keyof WritingPreferences;
  title: string;
  subtitle: string;
  options?: readonly string[];
  input?: boolean;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "fullName",
    title: "What is your name?",
    subtitle: "We’ll use this to personalize your workspace.",
    input: true,
  },
  {
    key: "goal",
    title: "What are you here to write?",
    subtitle: "Choose the form that feels closest to your work.",
    options: GOALS,
  },
  {
    key: "genre",
    title: "Preferred genre",
    subtitle: "This shapes the atmosphere of generated prose.",
    options: GENRES,
  },
  {
    key: "perspective",
    title: "Narrative perspective",
    subtitle: "How should the story address the reader?",
    options: PERSPECTIVES,
  },
  {
    key: "tone",
    title: "Tone & style",
    subtitle: "Pick the voice you want Claude to honor.",
    options: TONES,
  },
  {
    key: "aiExperience",
    title: "How experienced are you with AI writing?",
    subtitle: "We’ll calibrate how much we explain along the way.",
    options: AI_EXPERIENCE,
  },
  {
    key: "primaryTask",
    title: "Primary AI task",
    subtitle: "What should Leitmotif help with first?",
    options: PRIMARY_TASKS,
  },
  {
    key: "guidanceMode",
    title: "How should the AI collaborate?",
    subtitle: "You can change this later in Settings.",
    options: GUIDANCE_MODES,
  },
];

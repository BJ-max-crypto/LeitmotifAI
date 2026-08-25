export const ASK_AI_ACTIONS = [
  { id: "rewrite", label: "Rewrite", prompt: "Rewrite this passage with stronger prose, keeping meaning and voice." },
  { id: "expand", label: "Expand", prompt: "Expand this passage with more sensory detail and rhythm, keeping voice." },
  { id: "shorten", label: "Shorten", prompt: "Shorten this passage. Keep the essential meaning and voice." },
  { id: "grammar", label: "Fix Grammar", prompt: "Fix grammar, spelling, and clarity without changing voice or meaning." },
] as const;

export const TONE_ACTIONS = [
  { id: "darker", label: "Darker", prompt: "Rewrite this passage in a darker, more ominous tone without changing the facts." },
  { id: "lighter", label: "Lighter", prompt: "Rewrite this passage in a lighter, warmer tone without changing the facts." },
  { id: "formal", label: "More Formal", prompt: "Rewrite this passage in a more formal register without changing the facts." },
  { id: "casual", label: "More Casual", prompt: "Rewrite this passage in a more casual, spoken register without changing the facts." },
] as const;

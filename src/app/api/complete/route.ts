import Anthropic from "@anthropic-ai/sdk";
import { getClerkUserId, createClient } from "@/lib/supabase/server";
import { formatQuestionnairePrompt, isWritingPreferences } from "@/lib/writing-preferences";
import { CREATIVITY_LEVELS, formatStyleInstructions, isCreativityLevel, parseWritingStyles } from "@/lib/writing-styles";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

function extractJson(text: string) {
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) return null;
  try {
    return JSON.parse(fenced[0]) as { completion?: string; hint?: string };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const userId = await getClerkUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const body = (await request.json()) as {
    title?: string;
    prefix?: string;
    style?: string | string[];
    creativity?: string;
    bible?: string;
  };
  const prefix = body.prefix?.trimEnd() ?? "";
  if (prefix.length < 12) {
    return Response.json({ completion: "", hint: "" });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("writing_preferences")
    .eq("id", userId)
    .maybeSingle();
  const questionnaire = isWritingPreferences(profile?.writing_preferences)
    ? formatQuestionnairePrompt(profile.writing_preferences)
    : "";

  const style = formatStyleInstructions(parseWritingStyles(body.style));
  const creativity = isCreativityLevel(body.creativity)
    ? CREATIVITY_LEVELS[body.creativity]
    : CREATIVITY_LEVELS.High;
  const bible = body.bible?.trim();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 180,
    system: [
      'You write inline literary completions. Reply with JSON only: {"completion":"...","hint":"..."}. "completion" is 8-40 words that continue the story from the caret, no quotes, no markdown. "hint" is one short outline note about what could come next (under 12 words).',
      questionnaire,
      `Voice: ${style}`,
      `Creativity: ${creativity}`,
      bible ? `Story bible:\n${bible}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    messages: [
      {
        role: "user",
        content: `Title: ${body.title || "Untitled"}\n\nStory so far (ends at the writer's caret):\n${prefix.slice(-3500)}`,
      },
    ],
  });

  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
  const parsed = extractJson(text);
  const completion = (parsed?.completion || "").replace(/^["“]+|["”]+$/g, "").trim();
  const hint = (parsed?.hint || "").trim();

  return Response.json({ completion, hint });
}

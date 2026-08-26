import Anthropic from "@anthropic-ai/sdk";
import { CREATIVITY_LEVELS, formatStyleInstructions, isCreativityLevel, parseWritingStyles } from "@/lib/writing-styles";
import { formatQuestionnairePrompt, isWritingPreferences } from "@/lib/writing-preferences";
import { notifySlack } from "@/lib/slack";
import { PLAN_LIMITS } from "@/lib/plans";
import { createClient, getClerkUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

type CreditRow = {
  ok: boolean;
  credits_used: number;
  credits_limit: number;
};

async function consumeCredit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: consumed, error: consumeError } = await supabase.rpc("consume_credit");
  const creditRow = (Array.isArray(consumed) ? consumed[0] : consumed) as CreditRow | null;

  if (!consumeError && creditRow) {
    return { creditRow, error: null as string | null };
  }

  const { data: existing, error: readError } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    return {
      creditRow: null,
      error: consumeError?.message || readError.message,
    };
  }

  const used = existing?.credits_used ?? 0;
  const limit = existing?.credits_limit ?? 50;
  if (used >= limit) {
    return {
      creditRow: { ok: false, credits_used: used, credits_limit: limit },
      error: null,
    };
  }

  const nextUsed = used + 1;
  const { error: updateError } = await supabase
    .from("user_credits")
    .upsert({
      user_id: userId,
      credits_used: nextUsed,
      credits_limit: limit,
    });

  if (updateError) {
    return { creditRow: null, error: updateError.message };
  }

  return {
    creditRow: { ok: true, credits_used: nextUsed, credits_limit: limit },
    error: null,
  };
}

async function refundCredit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  used: number,
) {
  if (used <= 0) return;
  await supabase
    .from("user_credits")
    .update({ credits_used: used - 1 })
    .eq("user_id", userId);
}

type Attachment = {
  name?: string;
  mime?: string;
  kind?: "image" | "text" | "document";
  data?: string;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    prompt?: string;
    title?: string;
    document?: string;
    documentId?: string;
    mode?: "write" | "edit" | "ask";
    selection?: string;
    attachments?: Attachment[];
    style?: string | string[];
    creativity?: string;
    bible?: string;
    conversation?: { role: "user" | "assistant"; content?: string }[];
  };

  const attachments = (body.attachments ?? []).slice(0, 4);
  const prompt =
    body.prompt?.trim() ||
    (attachments.length > 0 ? "Use the attached files in the story." : "");
  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = clerkUserId;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("writing_preferences, plan_tier")
    .eq("id", userId)
    .maybeSingle();
  const plan = profile?.plan_tier ?? "free";
  const expectedLimit = PLAN_LIMITS[plan];
  await supabase
    .from("user_credits")
    .update({ credits_limit: expectedLimit })
    .eq("user_id", userId);

  const consumed = await consumeCredit(supabase, userId);
  if (consumed.error) {
    return Response.json({ error: consumed.error }, { status: 500 });
  }
  if (!consumed.creditRow?.ok) {
    await notifySlack(
      "credits",
      `${userId} reached the credit limit (${consumed.creditRow?.credits_used ?? 50}/${consumed.creditRow?.credits_limit ?? 50}).`,
    );
    return Response.json(
      {
        error: "INSUFFICIENT_CREDITS",
        used: consumed.creditRow?.credits_used ?? 50,
        limit: consumed.creditRow?.credits_limit ?? 50,
      },
      { status: 402 },
    );
  }
  const creditRow = consumed.creditRow;
  const questionnaire = isWritingPreferences(profile?.writing_preferences)
    ? formatQuestionnairePrompt(profile.writing_preferences)
    : "";
  const isProPlus = plan === "pro_plus";
  const deepContext = isProPlus
    ? "Pro Plus Deep Context is enabled. Analyze the full manuscript, multi-act structure, recurring motifs, and character arcs before writing. Keep continuity across scenes, honor the writer's established voice as style memory, and produce richer, more complete narrative beats with sensory specificity. Prefer priority-quality prose over brevity."
    : "";

    const isEdit = body.mode === "edit" && Boolean(body.selection?.trim());
    const askMode = body.mode === "ask";
    const style = formatStyleInstructions(parseWritingStyles(body.style));
    const creativity = isCreativityLevel(body.creativity)
      ? CREATIVITY_LEVELS[body.creativity]
      : CREATIVITY_LEVELS.High;
    const bible = body.bible?.trim();

    const system = [
      askMode
        ? "You are Leitmotif, an AI writing partner in an ongoing conversation. Use prior turns, the story bible, and the current manuscript as context. Answer the writer directly. Discuss the story, give notes, outline, brainstorm, or explain. Do not rewrite or append the manuscript unless they use an edit request. Clear, useful prose. Light markdown is fine."
        : isEdit
        ? "You are Leitmotif, an AI writing partner. The writer highlighted one passage in their story. Return only the rewritten version of that highlighted passage so it can replace that one span. Keep a similar length unless asked otherwise. Do not use markdown, asterisks, underscores, or hash headings. Do not return the rest of the story. If files are attached, use them as source material."
        : "You are Leitmotif, an AI writing partner. Write or continue the story. Return only the new prose. Do not use markdown, asterisks, underscores, or hash headings. Do not wrap the answer in labels or commentary. If files or images are attached, use them as source material for the prose.",
      questionnaire,
      deepContext,
      `Voice: ${style}`,
      `Creativity: ${creativity}`,
      bible ? `Honor this story bible as canonical context:\n${bible}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const encoder = new TextEncoder();
    const story = body.document || "(empty)";
    const storyContext = isProPlus ? story : story.slice(-12000);
    const textParts = [
      `Document title: ${body.title || "Untitled"}`,
      `Current story in the editor:\n${storyContext}`,
      isEdit ? `Highlighted passage to rewrite:\n${body.selection}` : "",
      askMode && body.selection?.trim()
        ? `The writer highlighted this passage for discussion:\n${body.selection}`
        : "",
      `Writer request:\n${prompt}`,
    ].filter(Boolean);

    const content: Array<
      | { type: "text"; text: string }
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
            data: string;
          };
        }
      | {
          type: "document";
          source: { type: "base64"; media_type: "application/pdf"; data: string };
        }
    > = [];

    for (const file of attachments) {
      if (!file.data) continue;
      if (file.kind === "image" && file.mime && IMAGE_TYPES.has(file.mime)) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: file.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: file.data.replace(/^data:.*?;base64,/, ""),
          },
        });
        continue;
      }
      if (file.kind === "document" && (file.mime === "application/pdf" || file.name?.endsWith(".pdf"))) {
        content.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: file.data.replace(/^data:.*?;base64,/, ""),
          },
        });
        continue;
      }
      textParts.push(`Attached file (${file.name || "untitled"}):\n${file.data.slice(0, 24000)}`);
    }

    content.push({ type: "text", text: textParts.join("\n\n") });

    const conversation = (body.conversation ?? [])
      .filter(
        (turn) =>
          (turn.role === "user" || turn.role === "assistant") &&
          typeof turn.content === "string" &&
          turn.content.trim().length > 0,
      )
      .slice(-18)
      .map((turn) => ({
        role: turn.role as "user" | "assistant",
        content: turn.content!.trim(),
      }));

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: isEdit ? 1200 : askMode ? 2500 : isProPlus ? 8000 : 4000,
      system,
      messages: [
        ...conversation.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        {
          role: "user" as const,
          content,
        },
      ],
    });

    const readable = new ReadableStream({
      start(controller) {
        stream.on("text", (text) => {
          controller.enqueue(encoder.encode(text));
        });
        stream.on("error", (error) => {
          controller.error(error);
        });
        void stream
          .finalMessage()
          .then(() => controller.close())
          .catch((error) => controller.error(error));
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Credits-Used": String(creditRow.credits_used),
        "X-Credits-Limit": String(creditRow.credits_limit),
      },
    });
  } catch (error) {
    if (supabase) {
      await refundCredit(supabase, userId, creditRow.credits_used);
    }
    const message = error instanceof Error ? error.message : "Generation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

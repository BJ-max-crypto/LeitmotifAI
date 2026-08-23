import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { notifySlack } from "@/lib/slack";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    prompt?: string;
    title?: string;
    document?: string;
    documentId?: string;
  };

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const { creditRow, error: consumeError } = await consumeCredit(supabase, user.id);
  if (consumeError) {
    return Response.json({ error: consumeError }, { status: 500 });
  }

  if (!creditRow?.ok) {
    return Response.json(
      {
        error: "INSUFFICIENT_CREDITS",
        used: creditRow?.credits_used ?? 50,
        limit: creditRow?.credits_limit ?? 50,
      },
      { status: 402 },
    );
  }

  if (creditRow.credits_used === 50 && creditRow.credits_limit === 50) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    await notifySlack({
      type: "credit_limit",
      name: profile?.full_name || user.email || "Writer",
      email: profile?.email || user.email || "",
      used: creditRow.credits_used,
      limit: creditRow.credits_limit,
    });
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const encoder = new TextEncoder();
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1200,
      system:
        "You are Leitmotif, an AI writing partner. Continue or revise the user's story in a natural literary voice. Return only the prose to insert into the document, without preamble.",
      messages: [
        {
          role: "user",
          content: [
            `Document title: ${body.title || "Untitled"}`,
            `Current document:\n${body.document || "(empty)"}`,
            `Writer request:\n${prompt}`,
          ].join("\n\n"),
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
    await refundCredit(supabase, user.id, creditRow.credits_used);
    const message = error instanceof Error ? error.message : "Generation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/slack";
import { getClerkUserId } from "@/lib/supabase/server";
import { hasCompletedOnboarding } from "@/lib/writing-preferences";

export async function POST(request: Request) {
  const userId = await getClerkUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { preferences?: unknown };
  if (!hasCompletedOnboarding(body.preferences)) {
    return NextResponse.json({ error: "Incomplete onboarding" }, { status: 400 });
  }

  await notifySlack(
    "signup",
    `${body.preferences.fullName || "A writer"} finished onboarding · ${body.preferences.genre} · ${body.preferences.goal}`,
  );

  return NextResponse.json({ ok: true });
}

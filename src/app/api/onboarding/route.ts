import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/slack";
import { getClerkUserId } from "@/lib/supabase/server";
import { hasCompletedOnboarding, isOldEnough, isWritingPreferences, MINIMUM_AGE, parseAge } from "@/lib/writing-preferences";

export async function POST(request: Request) {
  const userId = await getClerkUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { preferences?: unknown };
  const preferences = body.preferences;
  if (!hasCompletedOnboarding(preferences)) {
    const tooYoung =
      isWritingPreferences(preferences) &&
      parseAge(preferences.age) !== null &&
      !isOldEnough(preferences.age);
    return NextResponse.json(
      {
        error: tooYoung
          ? `You must be ${MINIMUM_AGE} or older to use Leitmotif.`
          : "Incomplete onboarding",
      },
      { status: 400 },
    );
  }

  await notifySlack(
    "signup",
    `${preferences.fullName || "A writer"} finished onboarding · ${preferences.genre} · ${preferences.goal}`,
  );

  return NextResponse.json({ ok: true });
}

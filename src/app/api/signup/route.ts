import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/slack";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; fullName?: string };
  const email = body.email?.trim();
  const fullName = body.fullName?.trim() || email?.split("@")[0] || "Writer";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  await notifySlack({ type: "signup", name: fullName, email });
  return NextResponse.json({ ok: true });
}

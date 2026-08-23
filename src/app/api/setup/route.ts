import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isValidSupabaseUrl,
  SB_KEY_COOKIE,
  SB_URL_COOKIE,
} from "@/lib/supabase/cookie-names";

function cookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    httpOnly: false,
    secure: false,
  };
}

function upsertEnvLine(contents: string, name: string, value: string) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }
  return `${contents.replace(/\s*$/, "")}\n${line}\n`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; key?: string };
  const url = body.url?.trim() ?? "";
  const key = body.key?.trim() ?? "";

  if (!isValidSupabaseUrl(url) || key.length < 20) {
    return NextResponse.json(
      {
        error:
          "Use your project URL (https://xxxx.supabase.co) and the publishable or anon key, not the secret key.",
      },
      { status: 400 },
    );
  }

  if (key.startsWith("sb_secret_") || key.includes("service_role")) {
    return NextResponse.json(
      { error: "Do not paste the secret key. Use the publishable or anon key." },
      { status: 400 },
    );
  }

  try {
    const envPath = join(process.cwd(), ".env.local");
    let envFile = "";
    try {
      envFile = await readFile(envPath, "utf8");
    } catch {
      envFile = "";
    }
    envFile = upsertEnvLine(envFile, "NEXT_PUBLIC_SUPABASE_URL", url);
    envFile = upsertEnvLine(
      envFile,
      key.startsWith("sb_publishable_")
        ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
        : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      key,
    );
    await writeFile(envPath, envFile);
  } catch (error) {
    console.error("Could not write .env.local", error);
  }

  const response = NextResponse.json({ ok: true, configured: true, url, key });
  response.cookies.set(SB_URL_COOKIE, url, cookieOptions());
  response.cookies.set(SB_KEY_COOKIE, key, cookieOptions());
  return response;
}

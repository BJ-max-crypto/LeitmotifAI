import { NextResponse } from "next/server";
import { getServerSupabaseConfig } from "@/lib/supabase/runtime";

export async function GET() {
  const { url, key } = await getServerSupabaseConfig();
  return NextResponse.json({
    configured: Boolean(url && key),
    url,
    key,
  });
}

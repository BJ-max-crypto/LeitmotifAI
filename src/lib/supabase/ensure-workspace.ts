import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DocumentRow, Profile, UserCredits } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

function displayName(user: User) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name : "";
  const name = typeof metadata.name === "string" ? metadata.name : "";
  return fullName || name || user.email?.split("@")[0] || "Writer";
}

function avatarUrl(user: User) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (typeof metadata.avatar_url === "string") return metadata.avatar_url;
  if (typeof metadata.picture === "string") return metadata.picture;
  return null;
}

export async function ensureWorkspace(supabase: Client, user: User) {
  const name = displayName(user);
  const avatar = avatarUrl(user);

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message, profile: null, credits: null, documents: [] as DocumentRow[] };
  }

  let profile: Profile | null = existingProfile;
  if (!profile) {
    const inserted = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: name,
        email: user.email ?? null,
        avatar_url: avatar,
        plan_tier: "free",
      })
      .select("*")
      .single();
    if (inserted.error) {
      return { error: inserted.error.message, profile: null, credits: null, documents: [] as DocumentRow[] };
    }
    profile = inserted.data;
  } else {
    const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
    if (!profile.full_name) patch.full_name = name;
    if (!profile.email && user.email) patch.email = user.email;
    if (!profile.avatar_url && avatar) patch.avatar_url = avatar;
    if (Object.keys(patch).length) {
      const updated = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("*")
        .single();
      if (updated.data) profile = updated.data;
    }
  }

  const { data: existingCredits, error: creditsReadError } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (creditsReadError) {
    return { error: creditsReadError.message, profile, credits: null, documents: [] as DocumentRow[] };
  }

  let credits: UserCredits | null = existingCredits;
  if (!credits) {
    const inserted = await supabase
      .from("user_credits")
      .insert({ user_id: user.id, credits_used: 0, credits_limit: 50 })
      .select("*")
      .single();
    if (inserted.error) {
      return { error: inserted.error.message, profile, credits: null, documents: [] as DocumentRow[] };
    }
    credits = inserted.data;
  }

  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (docsError) {
    return { error: docsError.message, profile, credits, documents: [] as DocumentRow[] };
  }

  let documents = docs ?? [];
  if (documents.length === 0) {
    const created = await supabase
      .from("documents")
      .insert({ user_id: user.id, title: "Untitled", content: "" })
      .select("*")
      .single();
    if (created.error) {
      return { error: created.error.message, profile, credits, documents };
    }
    if (created.data) documents = [created.data];
  }

  return { error: null, profile, credits, documents };
}

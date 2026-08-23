"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  createClient,
  isSupabaseConfigured,
  setBrowserSupabaseConfig,
} from "@/lib/supabase/client";
import { ensureWorkspace } from "@/lib/supabase/ensure-workspace";
import type {
  DocumentRow,
  PlanTier,
  Profile,
  UserCredits,
} from "@/lib/supabase/database.types";

type Credits = {
  used: number;
  limit: number;
  remaining: number;
  plan: PlanTier;
};

type AppState = {
  ready: boolean;
  profile: Profile | null;
  documents: DocumentRow[];
  activeDocument: DocumentRow | null;
  query: string;
  setQuery: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  credits: Credits;
  streaming: boolean;
  saveState: "saved" | "saving";
  actionError: string | null;
  clearActionError: () => void;
  showPaywall: boolean;
  showPricing: boolean;
  openPricing: () => void;
  closePricing: () => void;
  generate: () => Promise<void>;
  upgrade: (plan: "pro" | "pro_plus") => Promise<void>;
  selectDocument: (id: string) => void;
  createDocument: () => Promise<void>;
  updateProfile: (input: { full_name: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

const EMPTY_CREDITS: Credits = {
  used: 0,
  limit: 50,
  remaining: 50,
  plan: "free",
};

function toCredits(credits: UserCredits | null, plan: PlanTier): Credits {
  const used = credits?.credits_used ?? 0;
  const limit = credits?.credits_limit ?? 50;
  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    plan,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const skipSave = useRef(true);
  const streamingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("Untitled");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [credits, setCredits] = useState<Credits>(EMPTY_CREDITS);
  const [streaming, setStreaming] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [showPricing, setShowPricing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeDocument = documents.find((doc) => doc.id === activeId) ?? null;

  const applyCredits = useCallback((row: UserCredits | null, plan: PlanTier) => {
    setCredits(toCredits(row, plan));
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      const config = await fetch("/api/supabase-config").then(
        (response) => response.json() as Promise<{ url?: string; key?: string }>,
      );
      if (config.url && config.key) {
        setBrowserSupabaseConfig(config.url, config.key);
      }

      if (!isSupabaseConfigured()) {
        router.replace("/login");
        return;
      }

      const supabase = createClient();
      supabaseRef.current = supabase;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      const { error: rpcError } = await supabase.rpc("ensure_user_workspace");
      if (rpcError && !/does not exist|schema cache/i.test(rpcError.message)) {
        setActionError(rpcError.message);
      }
      const workspace = await ensureWorkspace(supabase, user);
      if (workspace.error) {
        setActionError(
          workspace.error.includes("Could not find") || workspace.error.includes("schema cache")
            ? "Database tables are missing. Paste supabase/migrations into the Supabase SQL editor, then refresh."
            : workspace.error,
        );
      }

      skipSave.current = true;
      setProfile(workspace.profile);
      applyCredits(workspace.credits, workspace.profile?.plan_tier ?? "free");
      setDocuments(workspace.documents);
      const first = workspace.documents[0];
      setActiveId(first?.id ?? null);
      setTitle(first?.title || "Untitled");
      setBody(first?.content || "");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not load workspace");
    } finally {
      setReady(true);
    }
  }, [applyCredits, router]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!userId) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;

    const creditsChannel = supabase
      .channel(`credits:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setCredits((current) => toCredits(payload.new as UserCredits, current.plan));
        },
      )
      .subscribe();

    const profileChannel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as Profile;
          setProfile(next);
          setCredits((current) => ({ ...current, plan: next.plan_tier }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(creditsChannel);
      void supabase.removeChannel(profileChannel);
    };
  }, [userId]);

  useEffect(() => {
    if (!ready || !activeId || streaming) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }

    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void (async () => {
        const supabase = supabaseRef.current;
        if (!supabase) return;
        const { data, error } = await supabase
          .from("documents")
          .update({ title: title || "Untitled", content: body })
          .eq("id", activeId)
          .select("*")
          .single();
        if (error) {
          setActionError(error.message);
          setSaveState("saved");
          return;
        }
        if (data) {
          setDocuments((current) =>
            current.map((doc) => (doc.id === data.id ? data : doc)),
          );
        }
        setSaveState("saved");
      })();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeId, body, ready, streaming, title]);

  const selectDocument = useCallback(
    (id: string) => {
      const doc = documents.find((item) => item.id === id);
      if (!doc) return;
      skipSave.current = true;
      setActiveId(doc.id);
      setTitle(doc.title);
      setBody(doc.content);
      setSaveState("saved");
    },
    [documents],
  );

  const createDocument = useCallback(async () => {
    if (!userId) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;
    setActionError(null);
    const { data, error } = await supabase
      .from("documents")
      .insert({ user_id: userId, title: "Untitled", content: "" })
      .select("*")
      .single();
    if (error || !data) {
      setActionError(error?.message || "Could not create project");
      return;
    }
    skipSave.current = true;
    setDocuments((current) => [data, ...current]);
    setActiveId(data.id);
    setTitle(data.title);
    setBody(data.content);
    router.push("/editor");
  }, [router, userId]);

  const generate = useCallback(async () => {
    if (!prompt.trim() || streamingRef.current) return;
    streamingRef.current = true;
    setStreaming(true);
    setActionError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          title,
          document: body,
          documentId: activeId,
        }),
      });

      if (response.status === 402) {
        const data = (await response.json()) as { used?: number; limit?: number };
        setCredits((current) => ({
          ...current,
          used: data.used ?? current.used,
          limit: data.limit ?? current.limit,
          remaining: 0,
        }));
        return;
      }

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Generation failed");
      }

      const used = Number(response.headers.get("X-Credits-Used") ?? credits.used + 1);
      const limit = Number(response.headers.get("X-Credits-Limit") ?? credits.limit);
      setCredits((current) => ({
        ...current,
        used,
        limit,
        remaining: Math.max(limit - used, 0),
      }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let inserted = body.trim() ? `${body}\n\n` : "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        inserted += decoder.decode(value, { stream: true });
        skipSave.current = true;
        setBody(inserted);
      }

      setPrompt("");
      if (activeId) {
        const supabase = supabaseRef.current;
        if (supabase) {
          await supabase
            .from("documents")
            .update({ content: inserted, title: title || "Untitled" })
            .eq("id", activeId);
        }
      }
      setSaveState("saved");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Generation failed");
    } finally {
      streamingRef.current = false;
      setStreaming(false);
    }
  }, [activeId, body, credits.limit, credits.used, prompt, title]);

  const upgrade = useCallback(async (plan: "pro" | "pro_plus") => {
    const response = await fetch("/api/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setActionError(data.error || "Upgrade failed");
      return;
    }
    const data = (await response.json()) as {
      checkoutUrl?: string;
      credits?: Credits;
    };
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    if (data.credits) {
      setCredits(data.credits);
      setProfile((current) =>
        current ? { ...current, plan_tier: data.credits!.plan } : current,
      );
    }
    setShowPricing(false);
  }, []);

  const updateProfile = useCallback(async (input: { full_name: string }) => {
    if (!userId) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: input.full_name })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) {
      setActionError(error.message);
      return;
    }
    if (data) setProfile(data);
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabaseRef.current?.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router]);

  const showPaywall =
    credits.used >= credits.limit && credits.plan === "free" && !streaming;

  const value = useMemo<AppState>(
    () => ({
      ready,
      profile,
      documents,
      activeDocument,
      query,
      setQuery,
      title,
      setTitle,
      body,
      setBody,
      prompt,
      setPrompt,
      credits,
      streaming,
      saveState,
      actionError,
      clearActionError: () => setActionError(null),
      showPaywall,
      showPricing,
      openPricing: () => setShowPricing(true),
      closePricing: () => setShowPricing(false),
      generate,
      upgrade,
      selectDocument,
      createDocument,
      updateProfile,
      signOut,
    }),
    [
      actionError,
      activeDocument,
      body,
      createDocument,
      credits,
      documents,
      generate,
      profile,
      prompt,
      query,
      ready,
      saveState,
      selectDocument,
      showPaywall,
      showPricing,
      signOut,
      streaming,
      title,
      updateProfile,
      upgrade,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within AppProvider");
  }
  return context;
}

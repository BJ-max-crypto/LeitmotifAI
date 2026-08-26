"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useClerk, useSession, useUser } from "@clerk/nextjs";
import {
  createBrowserSupabase,
  type BrowserSupabase,
} from "@/lib/supabase/client";
import { ensureWorkspace } from "@/lib/supabase/ensure-workspace";
import {
  parseDocumentContent,
  serializeDocumentContent,
  type AiDraft,
  type QuotedPassage,
} from "@/lib/document-blocks";
import type { AiAttachment } from "@/lib/files";
import { htmlToPlain, applyWriteStream, applyEditStream, unwrapAiEdit } from "@/lib/editor-html";
import {
  EMPTY_STORY_BIBLE,
  formatStoryBible,
  isEmptyStoryBible,
  takeLegacyGlobalStoryBible,
  type StoryBible,
} from "@/lib/story-bible";
import { toApiConversation, type AiChatMessage } from "@/lib/ai-chat";
import { parseAiPrompt } from "@/lib/prompt-mode";
import { hasCompletedOnboarding } from "@/lib/writing-preferences";
import { useWritingPrefs } from "@/context/WritingPrefs";
import {
  addRestorePoint,
  loadRestorePoints,
  saveRestorePoints,
  type RestorePoint,
} from "@/lib/restore-points";
import type {
  DocumentRow,
  PlanTier,
  Profile,
  UserCredits,
} from "@/lib/supabase/database.types";
import {
  AppContext,
  EMPTY_CREDITS,
  toCredits,
  useBodyHistory,
  type AppState,
  type Credits,
} from "@/context/AppProvider";

export function ClerkAppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, session } = useSession();
  const { user } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const { autoSave, writingStyles, creativity } = useWritingPrefs();
  const supabaseRef = useRef<BrowserSupabase | null>(null);
  const skipSave = useRef(true);
  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const history = useBodyHistory();

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("Untitled");
  const [body, setBody] = useState("");
  const [aiDrafts, setAiDrafts] = useState<AiDraft[]>([]);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [quotedPassage, setQuotedPassage] = useState<QuotedPassage | null>(null);
  const [storyBible, setStoryBible] = useState<StoryBible>({ ...EMPTY_STORY_BIBLE });
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [aiReplyVisible, setAiReplyVisible] = useState(false);
  const [aiReplyMinimized, setAiReplyMinimized] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{ id: string; originalBody: string } | null>(
    null,
  );
  const [scrollTarget, setScrollTarget] = useState<{ offset: number; label: string } | null>(
    null,
  );
  const [prompt, setPrompt] = useState("");
  const [credits, setCredits] = useState<Credits>(EMPTY_CREDITS);
  const [streaming, setStreaming] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [showPricing, setShowPricing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [allVersions, setAllVersions] = useState<RestorePoint[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const activeDocument = documents.find((doc) => doc.id === activeId) ?? null;

  const applyCredits = useCallback((row: UserCredits | null, plan: PlanTier) => {
    setCredits(toCredits(row, plan));
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn || !user || !session) {
      router.replace("/login");
      return;
    }

    try {
      const supabase = createBrowserSupabase(async () => (await session.getToken()) ?? null);
      supabaseRef.current = supabase;
      setUserId(user.id);
      const { error: rpcError } = await supabase.rpc("ensure_user_workspace");
      if (rpcError && !/does not exist|schema cache/i.test(rpcError.message)) {
        setActionError(rpcError.message);
      }
      const workspace = await ensureWorkspace(supabase, {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        full_name: user.fullName,
        avatar_url: user.imageUrl,
      });
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
      const parsed = parseDocumentContent(first?.content || "");
      const legacyBible = takeLegacyGlobalStoryBible();
      const bible =
        isEmptyStoryBible(parsed.storyBible) && legacyBible ? legacyBible : parsed.storyBible;
      setBody(parsed.body);
      setAiDrafts(parsed.aiDrafts);
      setStoryBible(bible);
      setQuotedPassage(null);
      setAiExpanded(parsed.aiDrafts.length > 0);
      setAllVersions(loadRestorePoints());
      if (first && legacyBible && isEmptyStoryBible(parsed.storyBible)) {
        await supabase
          .from("documents")
          .update({ content: serializeDocumentContent(parsed.body, bible) })
          .eq("id", first.id);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not load workspace");
    } finally {
      setReady(true);
    }
  }, [applyCredits, isLoaded, isSignedIn, router, session, user]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!ready || !profile) return;
    if (pathname?.startsWith("/onboarding")) return;
    if (!hasCompletedOnboarding(profile.writing_preferences)) {
      router.replace("/onboarding");
    }
  }, [pathname, profile, ready, router]);

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
    if (!ready || !activeId || streaming || !autoSave) return;
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
          .update({
            title: title || "Untitled",
            content: serializeDocumentContent(body, storyBible),
          })
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
  }, [activeId, autoSave, body, ready, streaming, storyBible, title]);

  const selectDocument = useCallback(
    (id: string) => {
      const doc = documents.find((item) => item.id === id);
      if (!doc) return;
      skipSave.current = true;
      setActiveId(doc.id);
      setTitle(doc.title);
      const parsed = parseDocumentContent(doc.content);
      setBody(parsed.body);
      setAiDrafts(parsed.aiDrafts);
      setStoryBible(parsed.storyBible);
      setQuotedPassage(null);
      setAiExpanded(parsed.aiDrafts.length > 0);
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
    setBody("");
    setAiDrafts([]);
    setStoryBible({ ...EMPTY_STORY_BIBLE });
    setQuotedPassage(null);
    setAiExpanded(true);
    router.push("/editor");
  }, [router, userId]);

  const deleteDocument = useCallback(
    async (id: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) {
        setActionError(error.message);
        return;
      }
      const remaining = documents.filter((doc) => doc.id !== id);
      skipSave.current = true;
      if (remaining.length === 0) {
        setDocuments([]);
        await createDocument();
        return;
      }
      setDocuments(remaining);
      if (activeId === id) {
        const next = remaining[0];
        const parsed = parseDocumentContent(next.content);
        setActiveId(next.id);
        setTitle(next.title);
        setBody(parsed.body);
        setAiDrafts(parsed.aiDrafts);
        setStoryBible(parsed.storyBible);
        setAiExpanded(parsed.aiDrafts.length > 0);
        router.push("/editor");
      }
    },
    [activeId, createDocument, documents, router],
  );

  const renameDocument = useCallback(
    async (id: string, nextTitle: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      const titleValue = nextTitle.trim() || "Untitled";
      const { data, error } = await supabase
        .from("documents")
        .update({ title: titleValue })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        setActionError(error?.message || "Could not rename project");
        return;
      }
      setDocuments((current) => current.map((doc) => (doc.id === data.id ? data : doc)));
      if (activeId === id) setTitle(data.title);
    },
    [activeId],
  );

  useEffect(() => {
    if (!ready || streaming) return;
    const timer = window.setTimeout(() => history.remember(body), 450);
    return () => window.clearTimeout(timer);
  }, [body, history, ready, streaming]);

  const persistDocument = useCallback(async () => {
    if (!activeId) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const { data, error } = await supabase
      .from("documents")
      .update({
        title: title || "Untitled",
        content: serializeDocumentContent(body, storyBible),
      })
      .eq("id", activeId)
      .select("*")
      .single();
    if (error) {
      setActionError(error.message);
      return;
    }
    if (data) {
      setDocuments((current) => current.map((doc) => (doc.id === data.id ? data : doc)));
    }
    setSaveState("saved");
  }, [activeId, body, storyBible, title]);

  const saveNow = useCallback(() => {
    if (!activeId) return;
    setSaveState("saving");
    void persistDocument();
  }, [activeId, persistDocument]);

  const captureRestorePoint = useCallback(
    (label = "Restore point") => {
      if (!activeId) return;
      setAllVersions((current) => {
        const next = addRestorePoint(current, {
          documentId: activeId,
          label,
          title: title || "Untitled",
          body,
        });
        saveRestorePoints(next);
        return next;
      });
    },
    [activeId, body, title],
  );

  const restoreVersion = useCallback(
    (id: string) => {
      const point = allVersions.find((item) => item.id === id);
      if (!point) return;
      skipSave.current = true;
      if (point.documentId !== activeId) {
        setActiveId(point.documentId);
      }
      setTitle(point.title);
      setBody(point.body);
      setQuotedPassage(null);
      setPendingEdit(null);
      setSaveState("saved");
      setHistoryOpen(false);
    },
    [activeId, allVersions],
  );

  const generate = useCallback(async (options?: { attachments?: AiAttachment[]; prompt?: string }) => {
    const attachments = options?.attachments ?? [];
    const rawPrompt = options?.prompt?.trim() || prompt.trim();
    const { isDocumentEdit, cleanPrompt } = parseAiPrompt(rawPrompt);
    const requestPrompt =
      cleanPrompt ||
      (attachments.length > 0
        ? "Use the attached files."
        : isDocumentEdit
          ? quotedPassage?.text
            ? "Rewrite the highlighted passage."
            : "Continue the story."
          : "");
    if ((!requestPrompt && attachments.length === 0) || streamingRef.current) return;
    const isPassageEdit = isDocumentEdit && Boolean(quotedPassage?.text);
    const apiMode: "ask" | "edit" | "write" = isDocumentEdit
      ? isPassageEdit
        ? "edit"
        : "write"
      : "ask";

    streamingRef.current = true;
    setStreaming(true);
    setAiExpanded(false);
    setActionError(null);

    let assistantId = "";
    let conversation: { role: "user" | "assistant"; content: string }[] = [];
    if (isDocumentEdit) {
      history.remember(body);
      setAiReplyVisible(false);
      if (activeId) {
        setAllVersions((current) => {
          const next = addRestorePoint(current, {
            documentId: activeId,
            label: isPassageEdit ? "Before AI edit" : "Before AI draft",
            title: title || "Untitled",
            body,
          });
          saveRestorePoints(next);
          return next;
        });
      }
    } else {
      conversation = toApiConversation(aiMessages);
      assistantId = crypto.randomUUID();
      setAiMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: requestPrompt },
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setAiReplyVisible(true);
      setAiReplyMinimized(false);
    }

    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          prompt: requestPrompt,
          title,
          document: htmlToPlain(body),
          documentId: activeId,
          mode: apiMode,
          selection: quotedPassage?.text,
          attachments,
          style: writingStyles,
          creativity,
          bible: formatStoryBible(storyBible),
          conversation,
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
        if (!isDocumentEdit) {
          setAiMessages((current) => current.slice(0, -2));
        }
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

      const draftId = crypto.randomUUID();
      const baseBody = body;
      if (isDocumentEdit && isPassageEdit && quotedPassage) {
        setPendingEdit({ id: draftId, originalBody: baseBody });
      } else if (isDocumentEdit) {
        setPendingEdit(null);
        setQuotedPassage(null);
      }

      const paint = (generated: string) => {
        if (!isDocumentEdit) {
          setAiMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content: generated } : message,
            ),
          );
          return;
        }
        skipSave.current = true;
        if (isPassageEdit && quotedPassage) {
          setBody(
            applyEditStream(
              baseBody,
              quotedPassage.start,
              quotedPassage.end,
              generated,
              draftId,
            ),
          );
        } else {
          setBody(applyWriteStream(baseBody, generated));
        }
      };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let generated = "";
      let lastPaint = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        generated += decoder.decode(value, { stream: true });
        const now = Date.now();
        if (now - lastPaint >= 42) {
          lastPaint = now;
          paint(generated);
        }
      }
      paint(generated);

      if (!options?.prompt) setPrompt("");
      if (isDocumentEdit) saveNow();
    } catch (error) {
      const aborted =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");
      if (!aborted) {
        setActionError(error instanceof Error ? error.message : "Generation failed");
      }
    } finally {
      abortRef.current = null;
      streamingRef.current = false;
      setStreaming(false);
    }
  }, [activeId, aiMessages, body, creativity, prompt, quotedPassage, saveNow, storyBible, title, writingStyles]);

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
      credits?: Credits;
    };
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
    await clerkSignOut({ redirectUrl: "/login" });
  }, [clerkSignOut]);

  const setAiDraftContent = useCallback((id: string, content: string) => {
    setAiDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, content } : draft)),
    );
  }, []);

  const acceptPendingEdit = useCallback(() => {
    if (!pendingEdit) return;
    setBody(unwrapAiEdit(body, pendingEdit.id));
    setPendingEdit(null);
    setQuotedPassage(null);
  }, [body, pendingEdit]);

  const rejectPendingEdit = useCallback(() => {
    abortRef.current?.abort();
    if (pendingEdit) setBody(pendingEdit.originalBody);
    setPendingEdit(null);
    setQuotedPassage(null);
  }, [pendingEdit]);

  const acceptAiDraft = useCallback(
    (_id: string) => {
      acceptPendingEdit();
    },
    [acceptPendingEdit],
  );

  const stopGenerate = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const rejectAiDraft = useCallback((_id: string) => {
    rejectPendingEdit();
  }, [rejectPendingEdit]);

  const toggleAiExpanded = useCallback(() => {
    setAiExpanded((current) => !current);
  }, []);

  const dismissAiReply = useCallback(() => {
    setAiReplyVisible(false);
    setAiReplyMinimized(false);
    setAiMessages([]);
  }, []);

  const undo = useCallback(() => {
    setPendingEdit(null);
    history.undo(body, setBody);
  }, [body, history]);

  const redo = useCallback(() => {
    setPendingEdit(null);
    history.redo(body, setBody);
  }, [body, history]);

  const jumpToBeat = useCallback(
    (documentId: string, beat: { offset: number; label: string }) => {
      if (activeId !== documentId) {
        selectDocument(documentId);
      }
      setScrollTarget(beat);
    },
    [activeId, selectDocument],
  );

  const clearScrollTarget = useCallback(() => {
    setScrollTarget(null);
  }, []);

  const hasAiDrafts = aiDrafts.some((draft) => draft.content.length > 0) || streaming;

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
      aiDrafts,
      aiExpanded,
      hasAiDrafts,
      toggleAiExpanded,
      setAiDraftContent,
      acceptAiDraft,
      rejectAiDraft,
      stopGenerate,
      jumpToBeat,
      scrollTarget,
      clearScrollTarget,
      quotedPassage,
      setQuotedPassage,
      storyBible,
      setStoryBible,
      aiMessages,
      aiReplyVisible,
      aiReplyMinimized,
      setAiReplyMinimized,
      dismissAiReply,
      pendingEdit,
      acceptPendingEdit,
      rejectPendingEdit,
      undo,
      redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
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
      deleteDocument,
      renameDocument,
      updateProfile,
      signOut,
      versions: allVersions.filter((point) => point.documentId === activeId),
      captureRestorePoint,
      restoreVersion,
      saveNow,
      commandOpen,
      setCommandOpen,
      historyOpen,
      setHistoryOpen,
      exportOpen,
      setExportOpen,
    }),
    [
      actionError,
      activeDocument,
      aiDrafts,
      aiExpanded,
      acceptAiDraft,
      body,
      createDocument,
      clearScrollTarget,
      credits,
      deleteDocument,
      renameDocument,
      documents,
      generate,
      hasAiDrafts,
      jumpToBeat,
      profile,
      prompt,
      query,
      quotedPassage,
      ready,
      pendingEdit,
      acceptPendingEdit,
      rejectPendingEdit,
      undo,
      redo,
      rejectAiDraft,
      saveState,
      scrollTarget,
      selectDocument,
      setAiDraftContent,
      showPaywall,
      showPricing,
      signOut,
      stopGenerate,
      streaming,
      title,
      toggleAiExpanded,
      updateProfile,
      upgrade,
      allVersions,
      captureRestorePoint,
      restoreVersion,
      saveNow,
      commandOpen,
      historyOpen,
      exportOpen,
      aiMessages,
      aiReplyVisible,
      aiReplyMinimized,
      dismissAiReply,
      storyBible,
      aiMessages,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

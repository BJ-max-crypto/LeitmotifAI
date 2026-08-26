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
import { PLAN_LIMITS } from "@/lib/plans";
import {
  parseDocumentContent,
  serializeDocumentContent,
  type AiDraft,
  type QuotedPassage,
} from "@/lib/document-blocks";
import type { AiAttachment } from "@/lib/files";
import { htmlToPlain, applyWriteStream, applyEditStream, unwrapAiEdit } from "@/lib/editor-html";
import { EMPTY_STORY_BIBLE, formatStoryBible, type StoryBible } from "@/lib/story-bible";
import { toApiConversation, type AiChatMessage } from "@/lib/ai-chat";
import { parseAiPrompt } from "@/lib/prompt-mode";
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

export type Credits = {
  used: number;
  limit: number;
  remaining: number;
  plan: PlanTier;
};

export type AppState = {
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
  aiDrafts: AiDraft[];
  aiExpanded: boolean;
  hasAiDrafts: boolean;
  toggleAiExpanded: () => void;
  setAiDraftContent: (id: string, content: string) => void;
  acceptAiDraft: (id: string) => void;
  rejectAiDraft: (id: string) => void;
  stopGenerate: () => void;
  jumpToBeat: (documentId: string, beat: { offset: number; label: string }) => void;
  scrollTarget: { offset: number; label: string } | null;
  clearScrollTarget: () => void;
  quotedPassage: QuotedPassage | null;
  setQuotedPassage: (passage: QuotedPassage | null) => void;
  storyBible: StoryBible;
  setStoryBible: (value: StoryBible) => void;
  aiMessages: AiChatMessage[];
  aiReplyVisible: boolean;
  aiReplyMinimized: boolean;
  setAiReplyMinimized: (value: boolean) => void;
  dismissAiReply: () => void;
  pendingEdit: { id: string; originalBody: string } | null;
  acceptPendingEdit: () => void;
  rejectPendingEdit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
  generate: (options?: { attachments?: AiAttachment[]; prompt?: string }) => Promise<void>;
  upgrade: (plan: "pro" | "pro_plus") => Promise<void>;
  selectDocument: (id: string) => void;
  createDocument: () => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  renameDocument: (id: string, title: string) => Promise<void>;
  updateProfile: (input: { full_name: string }) => Promise<void>;
  signOut: () => Promise<void>;
  versions: RestorePoint[];
  captureRestorePoint: (label?: string) => void;
  restoreVersion: (id: string) => void;
  saveNow: () => void;
  commandOpen: boolean;
  setCommandOpen: (value: boolean) => void;
  historyOpen: boolean;
  setHistoryOpen: (value: boolean) => void;
  exportOpen: boolean;
  setExportOpen: (value: boolean) => void;
};

export const AppContext = createContext<AppState | null>(null);

export const EMPTY_CREDITS: Credits = {
  used: 0,
  limit: 50,
  remaining: 50,
  plan: "free",
};

export function toCredits(credits: UserCredits | null, plan: PlanTier): Credits {
  const used = credits?.credits_used ?? 0;
  const limit = credits?.credits_limit ?? 50;
  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    plan,
  };
}

export function useBodyHistory() {
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const skip = useRef(false);
  const [, setTick] = useState(0);

  const remember = useCallback((snapshot: string) => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const stack = undoStack.current;
    if (stack[stack.length - 1] === snapshot) return;
    stack.push(snapshot);
    if (stack.length > 80) stack.shift();
    redoStack.current = [];
    setTick((value) => value + 1);
  }, []);

  const undo = useCallback((current: string, apply: (next: string) => void) => {
    if (undoStack.current.length < 2) return;
    redoStack.current.push(current);
    undoStack.current.pop();
    const prev = undoStack.current[undoStack.current.length - 1];
    skip.current = true;
    apply(prev);
    setTick((value) => value + 1);
  }, []);

  const redo = useCallback((current: string, apply: (next: string) => void) => {
    const next = redoStack.current.pop();
    if (next == null) return;
    undoStack.current.push(next);
    skip.current = true;
    apply(next);
    setTick((value) => value + 1);
  }, []);

  return {
    remember,
    undo,
    redo,
    canUndo: undoStack.current.length > 1,
    canRedo: redoStack.current.length > 0,
  };
}

const PROTOTYPE_USER_ID = "prototype-user";

function prototypeDocument(partial?: Partial<DocumentRow>): DocumentRow {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: PROTOTYPE_USER_ID,
    title: "Untitled",
    content: "",
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

function PrototypeAppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { autoSave, writingStyles, creativity } = useWritingPrefs();
  const skipSave = useRef(true);
  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const history = useBodyHistory();

  const [ready, setReady] = useState(false);
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

  useEffect(() => {
    const first = prototypeDocument({ title: "Untitled" });
    skipSave.current = true;
    setProfile({
      id: PROTOTYPE_USER_ID,
      full_name: "Alex Writer",
      email: "alex@leitmotif.local",
      avatar_url: null,
      plan_tier: "free",
      writing_preferences: null,
      updated_at: new Date().toISOString(),
    });
    setDocuments([first]);
    setActiveId(first.id);
    setTitle(first.title);
    setBody(first.content);
    setStoryBible({ ...EMPTY_STORY_BIBLE });
    setAllVersions(loadRestorePoints());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !activeId || streaming || !autoSave) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }

    setSaveState("saving");
    const timer = window.setTimeout(() => {
      const now = new Date().toISOString();
      setDocuments((current) =>
        current.map((doc) =>
          doc.id === activeId
            ? {
                ...doc,
                title: title || "Untitled",
                content: serializeDocumentContent(body, storyBible),
                updated_at: now,
              }
            : doc,
        ),
      );
      setSaveState("saved");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeId, autoSave, body, ready, streaming, storyBible, title]);

  const selectDocument = useCallback(
    (id: string) => {
      const doc = documents.find((item) => item.id === id);
      if (!doc) return;
      const parsed = parseDocumentContent(doc.content);
      skipSave.current = true;
      setActiveId(doc.id);
      setTitle(doc.title);
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
    const next = prototypeDocument();
    skipSave.current = true;
    setDocuments((current) => [next, ...current]);
    setActiveId(next.id);
    setTitle(next.title);
    setBody("");
    setAiDrafts([]);
    setStoryBible({ ...EMPTY_STORY_BIBLE });
    setQuotedPassage(null);
    setAiExpanded(true);
    router.push("/editor");
  }, [router]);

  const deleteDocument = useCallback(async (id: string) => {
    const remaining = documents.filter((doc) => doc.id !== id);
    skipSave.current = true;
    if (remaining.length === 0) {
      const next = prototypeDocument();
      setDocuments([next]);
      setActiveId(next.id);
      setTitle(next.title);
      setBody("");
      setAiDrafts([]);
      setStoryBible({ ...EMPTY_STORY_BIBLE });
      setQuotedPassage(null);
      setAiExpanded(true);
      router.push("/editor");
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
      setQuotedPassage(null);
      setAiExpanded(parsed.aiDrafts.length > 0);
      router.push("/editor");
    }
  }, [activeId, documents, router]);

  const renameDocument = useCallback(async (id: string, nextTitle: string) => {
    const titleValue = nextTitle.trim() || "Untitled";
    const now = new Date().toISOString();
    setDocuments((current) =>
      current.map((doc) =>
        doc.id === id ? { ...doc, title: titleValue, updated_at: now } : doc,
      ),
    );
    if (activeId === id) setTitle(titleValue);
  }, [activeId]);

  useEffect(() => {
    if (!ready || streaming) return;
    const timer = window.setTimeout(() => history.remember(body), 450);
    return () => window.clearTimeout(timer);
  }, [body, history, ready, streaming]);

  const saveNow = useCallback(() => {
    if (!activeId) return;
    const now = new Date().toISOString();
    setDocuments((current) =>
      current.map((doc) =>
        doc.id === activeId
          ? {
              ...doc,
              title: title || "Untitled",
              content: serializeDocumentContent(body, storyBible),
              updated_at: now,
            }
          : doc,
      ),
    );
    setSaveState("saved");
  }, [activeId, body, storyBible, title]);

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
        setAiReplyVisible(false);
        if (!isDocumentEdit) {
          setAiMessages((current) => current.slice(0, -2));
        }
        return;
      }

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Generation failed");
      }

      setCredits((current) => {
        const used = current.used + 1;
        return {
          ...current,
          used,
          remaining: Math.max(current.limit - used, 0),
        };
      });

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
  }, [activeId, aiDrafts, aiMessages, body, creativity, prompt, quotedPassage, saveNow, storyBible, title, writingStyles]);

  const upgrade = useCallback(async (plan: "pro" | "pro_plus") => {
    const limit = PLAN_LIMITS[plan];
    setCredits({ used: 0, limit, remaining: limit, plan });
    setProfile((current) =>
      current ? { ...current, plan_tier: plan } : current,
    );
    setShowPricing(false);
  }, []);

  const updateProfile = useCallback(async (input: { full_name: string }) => {
    setProfile((current) =>
      current
        ? { ...current, full_name: input.full_name, updated_at: new Date().toISOString() }
        : current,
    );
  }, []);

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

  const signOut = useCallback(async () => {}, []);

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
      versions: allVersions.filter((item) => item.documentId === activeId),
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
      activeId,
      aiDrafts,
      aiExpanded,
      acceptAiDraft,
      allVersions,
      body,
      captureRestorePoint,
      commandOpen,
      createDocument,
      clearScrollTarget,
      credits,
      deleteDocument,
      renameDocument,
      documents,
      exportOpen,
      generate,
      hasAiDrafts,
      historyOpen,
      jumpToBeat,
      profile,
      prompt,
      query,
      quotedPassage,
      ready,
      pendingEdit,
      acceptPendingEdit,
      rejectPendingEdit,
      restoreVersion,
      undo,
      redo,
      rejectAiDraft,
      saveNow,
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
      storyBible,
      aiMessages,
      aiReplyVisible,
      aiReplyMinimized,
      dismissAiReply,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  return <PrototypeAppProvider>{children}</PrototypeAppProvider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within AppProvider");
  }
  return context;
}

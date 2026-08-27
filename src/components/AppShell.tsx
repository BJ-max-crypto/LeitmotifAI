"use client";

import { useEffect } from "react";
import { ClerkAppProvider } from "@/context/ClerkAppProvider";
import { useAppState } from "@/context/AppProvider";
import { WritingPrefsProvider, useWritingPrefs } from "@/context/WritingPrefs";
import { PricingModal } from "@/components/PricingModal";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";

function ShortcutListener() {
  const {
    createDocument,
    undo,
    redo,
    saveNow,
    setCommandOpen,
    commandOpen,
    setExportOpen,
    setHistoryOpen,
    historyOpen,
    exportOpen,
    aiReplyVisible,
    aiReplyMinimized,
    setAiReplyMinimized,
  } = useAppState();
  const { bumpEditorZoom, setEditorZoom, focusMode, setFocusMode } = useWritingPrefs();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(!commandOpen);
        return;
      }
      if (event.key === "Escape") {
        if (commandOpen) {
          event.preventDefault();
          setCommandOpen(false);
          return;
        }
        if (historyOpen) {
          event.preventDefault();
          setHistoryOpen(false);
          return;
        }
        if (exportOpen) {
          event.preventDefault();
          setExportOpen(false);
          return;
        }
        if (aiReplyVisible && !aiReplyMinimized) {
          event.preventDefault();
          setAiReplyMinimized(true);
          return;
        }
        if (focusMode) {
          event.preventDefault();
          setFocusMode(false);
        }
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setExportOpen(true);
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFocusMode(!focusMode);
        return;
      }
      if (meta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createDocument();
      }
      if (meta && event.key.toLowerCase() === "z") {
        const inPrompt = target?.closest("form");
        if (!inPrompt) {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }
      }
      if (meta && event.key.toLowerCase() === "y" && !typing) {
        event.preventDefault();
        redo();
      }
      if (meta) {
        if (event.key === "=" || event.key === "+" || event.code === "Equal" || event.key === "Add") {
          event.preventDefault();
          bumpEditorZoom(0.1);
        }
        if (event.key === "-" || event.key === "_" || event.code === "Minus") {
          event.preventDefault();
          bumpEditorZoom(-0.1);
        }
        if (event.key === "0") {
          event.preventDefault();
          setEditorZoom(1);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    bumpEditorZoom,
    commandOpen,
    createDocument,
    exportOpen,
    focusMode,
    historyOpen,
    redo,
    saveNow,
    setCommandOpen,
    setEditorZoom,
    setExportOpen,
    setFocusMode,
    setHistoryOpen,
    undo,
    aiReplyVisible,
    aiReplyMinimized,
    setAiReplyMinimized,
  ]);
  return null;
}

function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const { ready, actionError, clearActionError } = useAppState();
  const { focusMode } = useWritingPrefs();

  if (!ready) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-white"
        role="status"
        aria-label="Loading workspace"
      >
        <video
          src="/loading.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="max-h-[70vh] max-w-[90vw] object-contain"
        />
      </div>
    );
  }

  return (
    <>
      <ShortcutListener />
      {focusMode ? null : <Sidebar />}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {actionError ? (
          <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <p>{actionError}</p>
            <button type="button" className="font-medium" onClick={clearActionError}>
              Dismiss
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
      <PricingModal />
      <CommandPalette />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WritingPrefsProvider>
      <ClerkAppProvider>
        <div className="flex h-screen min-h-0 overflow-hidden bg-zinc-50">
          <WorkspaceFrame>{children}</WorkspaceFrame>
        </div>
      </ClerkAppProvider>
    </WritingPrefsProvider>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/context/AppProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useWritingPrefs } from "@/context/WritingPrefs";

export function CommandPalette() {
  const router = useRouter();
  const {
    commandOpen,
    setCommandOpen,
    createDocument,
    saveNow,
    setExportOpen,
    setHistoryOpen,
    captureRestorePoint,
    undo,
    redo,
  } = useAppState();
  const { theme, toggleTheme } = useTheme();
  const { focusMode, setFocusMode, setSidebarPanel } = useWritingPrefs();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!commandOpen) setQuery("");
  }, [commandOpen]);

  const commands = useMemo(
    () => [
      { id: "new", label: "New project", hint: "⌘N", run: () => void createDocument() },
      { id: "save", label: "Save document", hint: "⌘S", run: saveNow },
      { id: "export", label: "Export…", hint: "⇧⌘E", run: () => setExportOpen(true) },
      { id: "history", label: "Version history", run: () => setHistoryOpen(true) },
      {
        id: "restore",
        label: "Save restore point",
        run: () => captureRestorePoint("Manual restore point"),
      },
      { id: "focus", label: focusMode ? "Exit focus mode" : "Enter focus mode", run: () => setFocusMode(!focusMode) },
      { id: "bible", label: "Open story bible", run: () => setSidebarPanel("bible") },
      { id: "undo", label: "Undo", hint: "⌘Z", run: undo },
      { id: "redo", label: "Redo", hint: "⇧⌘Z", run: redo },
      { id: "theme", label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme", run: toggleTheme },
      { id: "settings", label: "Open settings", run: () => router.push("/settings") },
    ],
    [
      captureRestorePoint,
      createDocument,
      focusMode,
      redo,
      router,
      saveNow,
      setExportOpen,
      setFocusMode,
      setHistoryOpen,
      setSidebarPanel,
      theme,
      toggleTheme,
      undo,
    ],
  );

  const filtered = commands.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (!commandOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[18vh] backdrop-blur-sm"
      onClick={() => setCommandOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_16px_16px_rgba(0,0,0,0.15)]"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search commands…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-slate-400"
          onKeyDown={(event) => {
            if (event.key === "Escape") setCommandOpen(false);
            if (event.key === "Enter" && filtered[0]) {
              event.preventDefault();
              filtered[0].run();
              setCommandOpen(false);
            }
          }}
        />
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-slate-400">No matching commands</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.run();
                  setCommandOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted"
              >
                <span>{item.label}</span>
                {item.hint ? (
                  <span className="text-[11px] text-slate-400">{item.hint}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

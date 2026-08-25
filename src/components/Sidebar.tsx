"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Clapperboard,
  FileText,
  Layers,
  Moon,
  Pencil,
  Plus,
  PlusCircle,
  ScrollText,
  Search,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAppState } from "@/context/AppProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useWritingPrefs } from "@/context/WritingPrefs";
import { parseDocumentContent, parseStoryBeats } from "@/lib/document-blocks";
import { htmlToPlain } from "@/lib/editor-html";
import { initialsFromName, planLabel, formatCreditCount } from "@/lib/plans";
import { formatWordStats } from "@/lib/writing-stats";

export function Sidebar() {
  const pathname = usePathname();
  const {
    profile,
    credits,
    documents,
    activeDocument,
    query,
    setQuery,
    selectDocument,
    createDocument,
    deleteDocument,
    renameDocument,
    body,
    jumpToBeat,
    openPricing,
    storyBible,
    setStoryBible,
  } = useAppState();
  const { theme, toggleTheme } = useTheme();
  const { showWordCount, sidebarPanel, setSidebarPanel } =
    useWritingPrefs();
  const onSettings = pathname.startsWith("/settings");
  const usedPct = credits.limit
    ? Math.min((credits.used / credits.limit) * 100, 100)
    : 0;
  const name = profile?.full_name || profile?.email || "Writer";
  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(query.toLowerCase()),
  );
  const stats = formatWordStats(htmlToPlain(body));
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const skipRename = useRef(false);

  useEffect(() => {
    if (!renamingId) return;
    renameRef.current?.focus();
    renameRef.current?.select();
  }, [renamingId]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const commitRename = (id: string) => {
    if (skipRename.current) {
      skipRename.current = false;
      setRenamingId(null);
      return;
    }
    setRenamingId(null);
    void renameDocument(id, renameValue);
  };

  return (
    <aside className="sidebar-pattern glass-panel flex h-screen w-[260px] shrink-0 flex-col border-r border-zinc-200/80">
      <div className="flex h-[42px] shrink-0 items-center px-4 pt-4 pb-2" />
      <div className="flex flex-col gap-1 px-2">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.2 }}
          onClick={() => void createDocument()}
          className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left text-sm font-medium text-zinc-500"
        >
          <Plus className="size-4 text-slate-500" strokeWidth={1.75} />
          <span className="flex-1">+ New Project</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-400">
            ⌘N
          </span>
        </motion.button>
        <label className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-400">
          <Search className="size-4" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-slate-400"
            placeholder="Search files..."
          />
        </label>
      </div>

      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-4">
        <div className="flex items-center gap-1 px-1">
          <button
            type="button"
            onClick={() => setSidebarPanel("projects")}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              sidebarPanel === "projects" ? "bg-surface text-foreground shadow-sm" : "text-slate-400"
            }`}
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => setSidebarPanel("bible")}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              sidebarPanel === "bible" ? "bg-surface text-foreground shadow-sm" : "text-slate-400"
            }`}
          >
            Bible
          </button>
        </div>
        {sidebarPanel === "bible" ? (
          <div className="flex flex-col gap-3 px-1 pb-4">
            <p className="text-[11px] font-medium text-slate-500">
              For {activeDocument?.title || "this project"}
            </p>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Characters
              <textarea
                value={storyBible.characters}
                onChange={(event) =>
                  setStoryBible({ ...storyBible, characters: event.target.value })
                }
                rows={5}
                placeholder="Names, wants, wounds, relationships…"
                className="mt-1.5 w-full resize-none rounded-md border border-border bg-surface px-2 py-2 text-[12px] text-foreground placeholder:text-slate-400"
              />
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Plot
              <textarea
                value={storyBible.plot}
                onChange={(event) => setStoryBible({ ...storyBible, plot: event.target.value })}
                rows={5}
                placeholder="Beats, promises, secrets, ending…"
                className="mt-1.5 w-full resize-none rounded-md border border-border bg-surface px-2 py-2 text-[12px] text-foreground placeholder:text-slate-400"
              />
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              World
              <textarea
                value={storyBible.world}
                onChange={(event) => setStoryBible({ ...storyBible, world: event.target.value })}
                rows={5}
                placeholder="Rules, places, tone limits…"
                className="mt-1.5 w-full resize-none rounded-md border border-border bg-surface px-2 py-2 text-[12px] text-foreground placeholder:text-slate-400"
              />
            </label>
            <p className="text-[11px] leading-4 text-slate-400">
              Saved with this project. Claude uses it for generate, @edit, and inline complete.
            </p>
          </div>
        ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between px-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Projects
          </p>
          <button
            type="button"
            aria-label="Create document"
            onClick={() => void createDocument()}
          >
            <PlusCircle className="size-3 text-slate-400" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <button
                type="button"
                onClick={() => void createDocument()}
                className="rounded-md px-2 py-1.5 text-left text-[13px] text-slate-400 hover:bg-white/70 hover:text-slate-600"
              >
                No projects yet. Create one
              </button>
            ) : null}
            {filtered.map((doc) => {
              const active = !onSettings && activeDocument?.id === doc.id;
              const source = active ? body : parseDocumentContent(doc.content).body;
              const beats = parseStoryBeats(htmlToPlain(source));
              return (
                <div key={doc.id} className="flex flex-col">
                  <div
                    className={`group flex items-center gap-1 rounded-md pr-1 ${
                      active
                        ? "bg-surface font-medium text-foreground shadow-sm"
                        : "font-normal text-slate-500 hover:bg-surface/70 dark:text-slate-400"
                    }`}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMenu({
                        id: doc.id,
                        x: Math.min(event.clientX, window.innerWidth - 160),
                        y: Math.min(event.clientY, window.innerHeight - 88),
                      });
                    }}
                  >
                    {renamingId === doc.id ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1"
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitRename(doc.id);
                        }}
                      >
                        <FileText className="size-3.5 shrink-0" strokeWidth={1.75} />
                        <input
                          ref={renameRef}
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onBlur={() => commitRename(doc.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              skipRename.current = true;
                              setRenamingId(null);
                            }
                          }}
                          className="min-w-0 w-full rounded-sm bg-white px-1 py-0.5 text-[13px] text-foreground outline-none ring-1 ring-zinc-400"
                          aria-label="Project title"
                        />
                      </form>
                    ) : (
                      <Link
                        href="/editor"
                        onClick={() => selectDocument(doc.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-[13px]"
                      >
                        <FileText className="size-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{doc.title || "Untitled"}</span>
                      </Link>
                    )}
                    <button
                      type="button"
                      aria-label={`Delete ${doc.title || "Untitled"}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void deleteDocument(doc.id);
                      }}
                      className="flex size-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-surface hover:text-red-600 focus:bg-surface"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                  {beats.length > 0 ? (
                    <div className="ml-5 flex flex-col border-l border-border py-0.5 pl-2">
                      {beats.map((beat) => {
                        const Icon =
                          beat.kind === "act"
                            ? Layers
                            : beat.kind === "scene"
                              ? Clapperboard
                              : beat.kind === "part"
                                ? ScrollText
                                : BookOpen;
                        return (
                          <Link
                            key={beat.id}
                            href="/editor"
                            onClick={() => jumpToBeat(doc.id, beat)}
                            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-slate-500 hover:bg-surface hover:text-foreground dark:text-slate-400"
                          >
                            <Icon className="size-3 shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{beat.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
        </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-3 flex flex-col gap-2 pb-1">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
            <p>
              {formatCreditCount(credits.used)} / {formatCreditCount(credits.limit)} Credits
            </p>
            <button
              type="button"
              onClick={openPricing}
              className="interactive-scale font-semibold text-zinc-950"
            >
              Upgrade
            </button>
          </div>
          {showWordCount ? (
            <p className="text-[11px] text-zinc-400">{stats.label}</p>
          ) : null}
          <div className="h-1.5 overflow-hidden rounded-sm bg-zinc-200">
            <div
              className="h-full rounded-sm ink-fill transition-[width] duration-500"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full bg-surface text-xs font-semibold text-slate-500">
              {initialsFromName(profile?.full_name, profile?.email)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{name}</p>
            <p className="truncate text-[11px] text-slate-400">
              {planLabel(credits.plan)}
            </p>
          </div>
          <button
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
            className="flex size-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-surface"
          >
            {theme === "dark" ? (
              <Sun className="size-4" strokeWidth={1.75} />
            ) : (
              <Moon className="size-4" strokeWidth={1.75} />
            )}
          </button>
          <Link
            href={onSettings ? "/editor" : "/settings"}
            aria-label={onSettings ? "Back to editor" : "Open settings"}
            className={`flex size-7 items-center justify-center rounded-md transition ${
              onSettings
                ? "bg-surface text-foreground"
                : "text-slate-500 hover:bg-surface"
            }`}
          >
            <Settings className="size-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
      {menu ? (
        <div
          className="fixed z-50 min-w-[152px] rounded-lg border border-zinc-300 bg-white py-1 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-zinc-800 hover:bg-zinc-50"
            onClick={() => {
              const doc = documents.find((item) => item.id === menu.id);
              setRenameValue(doc?.title || "");
              setRenamingId(menu.id);
              setMenu(null);
            }}
          >
            <Pencil className="size-3.5" strokeWidth={1.75} />
            Rename
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-red-600 hover:bg-zinc-50"
            onClick={() => {
              const id = menu.id;
              setMenu(null);
              void deleteDocument(id);
            }}
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Delete
          </button>
        </div>
      ) : null}
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FileText,
  Folder,
  Plus,
  PlusCircle,
  Search,
  Settings,
} from "lucide-react";
import { useAppState } from "@/context/AppProvider";
import { initialsFromName, planLabel } from "@/lib/plans";

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
  } = useAppState();
  const onSettings = pathname.startsWith("/settings");
  const usedPct = credits.limit
    ? Math.min((credits.used / credits.limit) * 100, 100)
    : 0;
  const name = profile?.full_name || profile?.email || "Writer";
  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex h-[42px] shrink-0 items-center px-4 pt-4 pb-2" />
      <div className="flex flex-col gap-1 px-2">
        <button
          type="button"
          onClick={() => void createDocument()}
          className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition hover:bg-white"
        >
          <Plus className="size-4 text-slate-500" strokeWidth={1.75} />
          <span className="flex-1">+ New Project</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-400">
            ⌘N
          </span>
        </button>
        <label className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-400">
          <Search className="size-4" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400"
            placeholder="Search files..."
          />
        </label>
      </div>

      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-4">
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
          <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-slate-900">
            <ChevronDown className="size-3.5 text-slate-500" strokeWidth={1.75} />
            <Folder className="size-4 text-slate-500" strokeWidth={1.75} />
            Writing App
          </div>
          <div className="flex flex-col gap-0.5 pl-6">
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
              return (
                <Link
                  key={doc.id}
                  href="/editor"
                  onClick={() => selectDocument(doc.id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${
                    active
                      ? "bg-white font-medium text-black shadow-sm"
                      : "font-normal text-slate-500 hover:bg-white/70"
                  }`}
                >
                  <FileText className="size-3.5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{doc.title || "Untitled"}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="mb-3 flex flex-col gap-2 pb-1">
          <p className="text-xs font-medium text-slate-500">
            {credits.used} / {credits.limit} Credits Used
          </p>
          <div className="h-1 overflow-hidden rounded-sm bg-slate-100">
            <div
              className="h-full rounded-sm bg-gradient-to-r from-black to-neutral-200"
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
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
              {initialsFromName(profile?.full_name, profile?.email)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-900">{name}</p>
            <p className="truncate text-[11px] text-slate-400">
              {planLabel(credits.plan)}
            </p>
          </div>
          <Link
            href={onSettings ? "/editor" : "/settings"}
            aria-label={onSettings ? "Back to editor" : "Open settings"}
            className={`flex size-7 items-center justify-center rounded-md transition ${
              onSettings
                ? "bg-slate-200 text-slate-900"
                : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            <Settings className="size-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </aside>
  );
}

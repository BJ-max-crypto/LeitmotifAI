"use client";

import { ArrowUpRight, LayoutGrid, MoreHorizontal } from "lucide-react";
import { useAppState } from "@/context/AppProvider";

export function EditorCanvas() {
  const { title, setTitle, body, setBody, saveState, openPricing } = useAppState();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-10 items-center justify-between px-[60px] pt-6">
        <nav className="flex items-center gap-1.5 text-[13px]">
          <span className="text-slate-500">Writing App</span>
          <span className="text-slate-400">/</span>
          <span className="font-medium text-slate-900">{title || "Untitled"}</span>
        </nav>
        <div className="flex items-center gap-4 text-slate-500">
          <button type="button" className="flex items-center gap-1 text-[13px] font-medium">
            Open in Docs
            <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
          </button>
          <LayoutGrid className="size-4" strokeWidth={1.75} />
          <MoreHorizontal className="size-4" strokeWidth={1.75} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[740px] flex-1 flex-col px-6 pt-5">
        <div className="mb-5 flex justify-end gap-3">
          <div className="flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {saveState === "saved" ? "Saved" : "Saving"}
          </div>
          <button
            type="button"
            onClick={openPricing}
            className="rounded-full bg-gradient-to-b from-black to-neutral-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Upgrade
          </button>
        </div>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full bg-transparent text-[40px] font-bold leading-none text-slate-900 placeholder:text-slate-300"
          placeholder="Untitled"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Start writing your story..."
          className="editor-scrollbar mt-4 min-h-[280px] flex-1 resize-none bg-transparent text-base leading-6 text-slate-800 placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}

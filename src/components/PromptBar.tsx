"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { useAppState } from "@/context/AppProvider";
import { PaywallPopover } from "@/components/PaywallPopover";

export function PromptBar() {
  const { prompt, setPrompt, generate, streaming, showPaywall } = useAppState();

  return (
    <div className="relative px-[60px] pb-5 pt-6">
      {showPaywall ? <PaywallPopover /> : null}
      <form
        className="mx-auto flex w-full max-w-[640px] items-center gap-3 rounded-[15px] border border-neutral-200 bg-white px-4 py-3 shadow-[0_4px_6px_rgba(0,0,0,0.02)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!prompt.trim() || showPaywall || streaming) return;
          void generate();
        }}
      >
        <Sparkles className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask about your story..."
          disabled={streaming}
          className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={streaming || !prompt.trim() || showPaywall}
          className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 disabled:opacity-50"
          aria-label="Send prompt"
        >
          <ArrowUp className="size-3" strokeWidth={2.25} />
        </button>
      </form>
      <p className="mx-auto mt-2 max-w-[608px] text-center text-[10px] font-semibold leading-normal text-neutral-400">
        AI-assisted writing tool. Verify all content for accuracy and compliance. Do not
        input sensitive or proprietary information.
      </p>
    </div>
  );
}

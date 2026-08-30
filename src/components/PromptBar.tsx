"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus, Square, X } from "lucide-react";
import { motion } from "framer-motion";
import { useAppState } from "@/context/AppProvider";
import { PaywallPopover } from "@/components/PaywallPopover";
import { fileToAttachment, type AiAttachment } from "@/lib/files";
import { useWritingPrefs } from "@/context/WritingPrefs";
import { GenreChips } from "@/components/GenreChips";
import { parseAiPrompt } from "@/lib/prompt-mode";

export function PromptBar() {
  const {
    prompt,
    setPrompt,
    generate,
    stopGenerate,
    streaming,
    showPaywall,
    quotedPassage,
    setQuotedPassage,
  } = useAppState();
  const { writingStyles, toggleWritingStyle } = useWritingPrefs();
  const [sendBurst, setSendBurst] = useState(false);
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = Boolean(prompt.trim() || attachments.length) && !showPaywall;

  useEffect(() => {
    if (!sendBurst) return;
    const timer = window.setTimeout(() => setSendBurst(false), 340);
    return () => window.clearTimeout(timer);
  }, [sendBurst]);

  const addFiles = async (files: FileList | File[]) => {
    try {
      const next: AiAttachment[] = [];
      for (const file of Array.from(files).slice(0, 4 - attachments.length)) {
        next.push(await fileToAttachment(file));
      }
      setAttachments((current) => [...current, ...next].slice(0, 4));
      setAttachError(null);
    } catch (error) {
      setAttachError(error instanceof Error ? error.message : "Could not attach that file.");
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end">
      <div className="pointer-events-auto relative z-20 px-4 pb-5 pt-6 sm:px-6">
        {showPaywall ? <PaywallPopover /> : null}

        <div className="mx-auto flex w-full max-w-[480px] flex-col overflow-hidden rounded-[24px] border-[1.5px] border-zinc-400 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-md prompt-glow dark:bg-zinc-950/50">
          <div className="min-w-0 border-b border-border px-2 py-2">
            <GenreChips
              compact
              selected={writingStyles}
              onToggle={toggleWritingStyle}
            />
          </div>
          {quotedPassage ? (
            <div className="flex items-start gap-2 border-b border-border px-4 py-2.5">
              <p className="min-w-0 flex-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                <span className="mr-1.5 font-semibold uppercase tracking-wide text-slate-400">
                  {parseAiPrompt(prompt).isDocumentEdit ? "Edit" : "About"}
                </span>
                “{quotedPassage.text.length > 160
                  ? `${quotedPassage.text.slice(0, 160)}…`
                  : quotedPassage.text}
                ”
              </p>
              <button
                type="button"
                aria-label="Clear highlighted passage"
                onClick={() => setQuotedPassage(null)}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-surface hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="size-3.5" strokeWidth={2.25} />
              </button>
            </div>
          ) : null}

          {attachError ? (
            <p className="border-b border-border px-4 py-2 text-[12px] text-red-600">{attachError}</p>
          ) : null}

          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
              {attachments.map((file) => (
                <span
                  key={file.id}
                  className="flex max-w-full items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setAttachments((current) => current.filter((item) => item.id !== file.id))
                    }
                    className="text-slate-400 hover:text-foreground"
                  >
                    <X className="size-3" strokeWidth={2.25} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <form
            className="flex shrink-0 items-end gap-2 px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (streaming || !canSend) return;
              setSendBurst(true);
              void generate({ attachments }).then(() => setAttachments([]));
            }}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.txt,.md,.html,.htm,.csv,.pdf,text/plain"
              className="hidden"
              onChange={(event) => {
                if (event.target.files) void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label="Attach files or images for the AI"
              onClick={() => fileRef.current?.click()}
              className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-surface"
            >
              <Plus className="size-4" strokeWidth={2.25} />
            </button>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                quotedPassage
                  ? parseAiPrompt(prompt).isDocumentEdit
                    ? "Tell it how to edit the highlighted passage..."
                    : "Ask about the highlighted passage, or type @edit to change it..."
                  : attachments.length
                    ? "Tell the AI how to use the attached files..."
                    : "Ask anything. Type @edit to write into the document..."
              }
              disabled={streaming}
              className="min-h-9 w-full bg-transparent py-2 text-sm text-foreground placeholder:text-slate-400"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stopGenerate}
                className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background"
                aria-label="Stop generating"
              >
                <Square className="size-3 fill-current" strokeWidth={0} />
              </button>
            ) : (
              <motion.button
                type="submit"
                disabled={!canSend}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className={`mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full sleek-cta disabled:opacity-55 ${
                  sendBurst ? "send-burst" : ""
                }`}
                aria-label="Send prompt"
              >
                <ArrowUp className="size-3.5" strokeWidth={2.25} />
              </motion.button>
            )}
          </form>
        </div>

        <p className="mx-auto mt-2 max-w-[448px] text-center text-[10px] font-semibold leading-normal text-slate-400">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}

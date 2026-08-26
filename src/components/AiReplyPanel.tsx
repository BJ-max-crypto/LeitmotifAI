"use client";

import { useEffect, useRef } from "react";
import { Maximize2, Minus, X } from "lucide-react";
import { FormattedProse } from "@/components/FormattedProse";
import { useAppState } from "@/context/AppProvider";

export function AiReplyPanel() {
  const {
    aiMessages,
    aiReplyVisible,
    aiReplyMinimized,
    setAiReplyMinimized,
    dismissAiReply,
    streaming,
  } = useAppState();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aiReplyVisible || aiReplyMinimized) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [aiMessages, aiReplyMinimized, aiReplyVisible, streaming]);

  if (!aiReplyVisible) return null;

  if (aiReplyMinimized) {
    return (
      <button
        type="button"
        onClick={() => setAiReplyMinimized(false)}
        className="absolute bottom-28 left-6 z-[25] flex items-center gap-2 rounded-full border-[1.5px] border-zinc-400 bg-white/85 px-3 py-1.5 text-xs font-semibold text-black shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-md"
      >
        <Maximize2 className="size-3.5" strokeWidth={2} />
        {streaming ? "AI is responding…" : "Conversation"}
      </button>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-zinc-50/55 backdrop-blur-md">
      <div className="mx-auto flex min-h-0 w-full max-w-[740px] flex-1 flex-col px-6 pb-36 pt-8">
        <div className="mb-3 flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label="Minimize AI conversation"
            onClick={() => setAiReplyMinimized(true)}
            className="flex size-8 items-center justify-center rounded-full border-[1.5px] border-zinc-400 bg-white/80 text-black"
          >
            <Minus className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Close AI conversation"
            onClick={dismissAiReply}
            className="flex size-8 items-center justify-center rounded-full border-[1.5px] border-zinc-400 bg-white/80 text-black"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto editor-scrollbar pr-1">
          <div className="flex flex-col gap-4 pb-4">
            {aiMessages.map((message, index) => {
              const isLast = index === aiMessages.length - 1;
              if (message.role === "user") {
                return (
                  <div key={message.id} className="ml-12 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-800">
                    {message.content}
                  </div>
                );
              }
              return (
                <FormattedProse
                  key={message.id}
                  text={message.content || (streaming && isLast ? "…" : "")}
                  streaming={streaming && isLast}
                  className="text-black"
                />
              );
            })}
            <div ref={endRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WRITING_STYLE_KEYS, WRITING_STYLES, type WritingStyle } from "@/lib/writing-styles";

export function GenreChips({
  selected,
  onToggle,
  compact = false,
}: {
  selected: WritingStyle[];
  onToggle: (style: WritingStyle) => void;
  compact?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const node = scroller.current;
    if (!node) return;
    setCanLeft(node.scrollLeft > 4);
    setCanRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 4);
  };

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const frame = window.requestAnimationFrame(() => {
      update();
      window.requestAnimationFrame(update);
    });
    node.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const nudge = (direction: -1 | 1) => {
    scroller.current?.scrollBy({ left: direction * 180, behavior: "smooth" });
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        aria-label="Earlier genres"
        disabled={!canLeft}
        onClick={() => nudge(-1)}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-surface disabled:opacity-20"
      >
        <ChevronLeft className="size-4" strokeWidth={1.75} />
      </button>
      <div
        ref={scroller}
        className="genre-scroll flex w-0 min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto py-0.5"
      >
        {WRITING_STYLE_KEYS.map((key) => {
          const active = selected.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(key)}
              className={`shrink-0 rounded-full px-2.5 py-1 font-medium whitespace-nowrap ${
                compact ? "text-[11px]" : "border px-3 py-1.5 text-[13px]"
              } ${
                active
                  ? compact
                    ? "bg-foreground text-background"
                    : "border-foreground bg-surface font-semibold text-foreground"
                  : compact
                    ? "text-slate-500 hover:bg-surface"
                    : "border-neutral-200 font-medium text-slate-500"
              }`}
            >
              {WRITING_STYLES[key].label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="More genres"
        disabled={!canRight}
        onClick={() => nudge(1)}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-surface disabled:opacity-20"
      >
        <ChevronRight className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

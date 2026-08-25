"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  FileDown,
  FileUp,
  Heading1,
  Heading2,
  History,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  MoreVertical,
  Redo2,
  Strikethrough,
  Type,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/context/AppProvider";
import { EDITOR_FONTS, useWritingPrefs } from "@/context/WritingPrefs";
import { ASK_AI_ACTIONS, TONE_ACTIONS } from "@/lib/ai-actions";
import { exportDocument, type ExportFormat } from "@/lib/export-document";
import {
  focusPlainQuery,
  getPlainSelection,
  htmlToPlain,
  replacePlainRange,
  sanitizeEditorHtml,
  setCaretFromPlainOffset,
} from "@/lib/editor-html";
import { fileToEditorHtml } from "@/lib/files";
import { formatStoryBible } from "@/lib/story-bible";
import { formatWordStats } from "@/lib/writing-stats";

type FormatCommand = "bold" | "italic" | "underline" | "strikeThrough";

export function EditorCanvas() {
  const {
    title,
    setTitle,
    body,
    setBody,
    saveState,
    openPricing,
    setQuotedPassage,
    scrollTarget,
    clearScrollTarget,
    streaming,
    pendingEdit,
    acceptPendingEdit,
    rejectPendingEdit,
    undo,
    redo,
    canUndo,
    canRedo,
    generate,
    versions,
    captureRestorePoint,
    restoreVersion,
    historyOpen,
    setHistoryOpen,
    exportOpen,
    setExportOpen,
    storyBible,
  } = useAppState();
  const {
    aiSuggestions,
    showTitle,
    editorFont,
    setEditorFont,
    editorFontSize,
    setEditorFontSize,
    editorZoom,
    showWordCount,
    focusMode,
    setFocusMode,
    writingStyles,
    creativity,
  } = useWritingPrefs();
  const bodyRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const localHtml = useRef(body);
  const abortRef = useRef<AbortController | null>(null);
  const [caret, setCaret] = useState(0);
  const [completion, setCompletion] = useState("");
  const [hint, setHint] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editAnchor, setEditAnchor] = useState<{ top: number; left: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const formatBtnRef = useRef<HTMLButtonElement>(null);
  const [formatPos, setFormatPos] = useState({ top: 0, left: 0 });
  const plainBody = htmlToPlain(body);
  const fontFamily = EDITOR_FONTS[editorFont].family;
  const typeStyles = { fontFamily, fontSize: `${editorFontSize}px`, lineHeight: 1.6 };
  const stats = formatWordStats(plainBody);

  const syncFromEditor = () => {
    const field = bodyRef.current;
    if (!field) return;
    const html = sanitizeEditorHtml(field.innerHTML);
    localHtml.current = html;
    setBody(html);
    const selection = getPlainSelection(field);
    if (selection) {
      setCaret(selection.end);
      setQuotedPassage(selection);
      return;
    }
    const point = window.getSelection();
    if (point && point.rangeCount > 0 && field.contains(point.anchorNode)) {
      const range = point.getRangeAt(0);
      const before = range.cloneRange();
      before.selectNodeContents(field);
      before.setEnd(range.startContainer, range.startOffset);
      setCaret(before.toString().length);
    }
  };

  const applyFormat = (command: FormatCommand) => {
    runEditorCommand(command);
    setMenu(null);
    setToneOpen(false);
  };

  const runEditorCommand = (command: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
    setFormatOpen(false);
  };

  const placeSelectionMenu = () => {
    const field = bodyRef.current;
    if (!field) return;
    const selection = getPlainSelection(field);
    if (!selection) {
      setMenu(null);
      setToneOpen(false);
      return;
    }
    const native = window.getSelection();
    if (!native || native.rangeCount === 0) return;
    const rect = native.getRangeAt(0).getBoundingClientRect();
    setQuotedPassage(selection);
    setMenu({
      x: Math.min(rect.left, window.innerWidth - 240),
      y: Math.max(8, rect.top - 8),
    });
  };

  const runAskAi = (prompt: string) => {
    setMenu(null);
    setToneOpen(false);
    void generate({ prompt: `@edit ${prompt}` });
  };

  useEffect(() => {
    const field = bodyRef.current;
    if (!field) return;
    if (localHtml.current === body && (field.innerHTML || !body)) return;
    field.innerHTML = body || "";
    localHtml.current = body;
  }, [body]);

  useEffect(() => {
    const field = bodyRef.current;
    if (scrollTarget == null || !field) return;
    field.focus();
    focusPlainQuery(field, scrollTarget.label, scrollTarget.offset);
    setCaret(scrollTarget.offset);
    clearScrollTarget();
  }, [body, clearScrollTarget, scrollTarget]);

  useEffect(() => {
    setCompletion("");
    setHint("");
    abortRef.current?.abort();

    if (!aiSuggestions || streaming || plainBody.trim().length < 16) {
      setSuggesting(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      const field = bodyRef.current;
      const selected = field ? getPlainSelection(field) : null;
      if (selected) return;
      const prefix = plainBody.slice(0, caret || plainBody.length);
      if (prefix.trim().length < 16) return;
      abortRef.current = new AbortController();
      setSuggesting(true);
      try {
        const response = await fetch("/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            title,
            prefix,
            style: writingStyles,
            creativity,
            bible: formatStoryBible(storyBible),
          }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { completion?: string; hint?: string };
        setCompletion((data.completion || "").trim());
        setHint((data.hint || "").trim());
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "AbortError") {
          setCompletion("");
          setHint("");
        }
      } finally {
        setSuggesting(false);
      }
    }, 1100);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [aiSuggestions, caret, creativity, plainBody, storyBible, streaming, title, writingStyles]);

  useEffect(() => {
    if (!pendingEdit || streaming) {
      setEditAnchor(null);
      return;
    }
    const place = () => {
      const mark = bodyRef.current?.querySelector(
        `mark[data-ai-edit="${pendingEdit.id}"]`,
      ) as HTMLElement | null;
      if (!mark) {
        setEditAnchor(null);
        return;
      }
      const rect = mark.getBoundingClientRect();
      setEditAnchor({ top: rect.top, left: rect.right + 8 });
    };
    place();
    const field = bodyRef.current;
    field?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      field?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [body, pendingEdit, streaming]);

  useEffect(() => {
    if (!menu && !moreOpen && !formatOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-selection-menu]") ||
        target?.closest("[data-more-menu]") ||
        target?.closest("[data-format-menu]")
      ) {
        return;
      }
      setMenu(null);
      setToneOpen(false);
      setMoreOpen(false);
      setFormatOpen(false);
    };
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", close);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", close);
    };
  }, [menu, moreOpen, formatOpen]);

  const acceptCompletion = () => {
    if (!completion) return;
    const field = bodyRef.current;
    const at = caret;
    const before = plainBody.slice(0, at);
    const needsSpace =
      before.length > 0 && !/\s$/.test(before) && !/^\s/.test(completion);
    const insert = `${needsSpace ? " " : ""}${completion}`;
    const nextCaret = before.length + insert.length;
    const next =
      replacePlainRange(body, at, at, insert) ??
      sanitizeEditorHtml(`${body}${insert}`);
    localHtml.current = next;
    setBody(next);
    setCompletion("");
    setHint("");
    requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      setCaretFromPlainOffset(field, nextCaret);
      setCaret(nextCaret);
    });
  };

  const toggleFormatMenu = () => {
    setFormatOpen((open) => {
      const next = !open;
      if (next) {
        const rect = formatBtnRef.current?.getBoundingClientRect();
        if (rect) setFormatPos({ top: rect.bottom + 4, left: rect.left });
        setMoreOpen(false);
      }
      return next;
    });
  };

  const atEnd = caret >= plainBody.length;
  const ghostSpacer =
    plainBody.length > 0 && !/\s$/.test(plainBody) && !/^\s/.test(completion) ? " " : "";

  const importFiles = async (files: FileList | File[]) => {
    const imported = await Promise.all(Array.from(files).map((file) => fileToEditorHtml(file)));
    const html = imported.map((item) => item.html).join("");
    const next = sanitizeEditorHtml(body ? `${body}<div><br></div>${html}` : html);
    localHtml.current = next;
    setBody(next);
    if ((!title || title === "Untitled") && imported[0]?.title) {
      setTitle(imported[0].title);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-[60px] dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="flex items-center gap-3 text-[13px] text-slate-500 dark:text-slate-400">
          <span className="font-medium text-foreground">{title || "Untitled"}</span>
          <div className="flex items-center gap-0.5 font-medium">
            <button
              type="button"
              aria-label="Decrease font size"
              disabled={editorFontSize <= 14}
              onClick={() => setEditorFontSize(editorFontSize - 2)}
              className="flex size-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30"
            >
              <span className="text-[11px] font-semibold">A</span>
            </button>
            <span className="min-w-7 text-center tabular-nums">{editorFontSize}</span>
            <button
              type="button"
              aria-label="Increase font size"
              disabled={editorFontSize >= 24}
              onClick={() => setEditorFontSize(editorFontSize + 2)}
              className="flex size-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30"
            >
              <span className="text-[15px] font-semibold">A</span>
            </button>
            <div className="relative" data-format-menu>
              <button
                ref={formatBtnRef}
                type="button"
                aria-label="Text formatting"
                aria-expanded={formatOpen}
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggleFormatMenu}
                className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <MoreVertical className="size-4" strokeWidth={1.75} />
              </button>
              {formatOpen ? (
                <div
                  className="fixed z-50 max-h-[min(70vh,28rem)] w-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
                  style={{ top: formatPos.top, left: formatPos.left }}
                >
                  <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Style
                  </p>
                  {(
                    [
                      ["bold", "Bold", Bold],
                      ["italic", "Italic", Italic],
                      ["underline", "Underline", Underline],
                      ["strikeThrough", "Strikethrough", Strikethrough],
                    ] as const
                  ).map(([command, label, Icon]) => (
                    <button
                      key={command}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => runEditorCommand(command)}
                    >
                      <Icon className="size-3.5" strokeWidth={1.75} />
                      {label}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-border" />
                  <p className="px-3 pt-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Heading
                  </p>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runEditorCommand("formatBlock", "h1")}
                  >
                    <Heading1 className="size-3.5" strokeWidth={1.75} />
                    Heading 1
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runEditorCommand("formatBlock", "h2")}
                  >
                    <Heading2 className="size-3.5" strokeWidth={1.75} />
                    Heading 2
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runEditorCommand("formatBlock", "p")}
                  >
                    <Type className="size-3.5" strokeWidth={1.75} />
                    Body
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <p className="px-3 pt-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    List
                  </p>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runEditorCommand("insertUnorderedList")}
                  >
                    <List className="size-3.5" strokeWidth={1.75} />
                    Bulleted list
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runEditorCommand("insertOrderedList")}
                  >
                    <ListOrdered className="size-3.5" strokeWidth={1.75} />
                    Numbered list
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <p className="px-3 pt-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Align
                  </p>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runEditorCommand("justifyLeft")}
                  >
                    <AlignLeft className="size-3.5" strokeWidth={1.75} />
                    Left
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runEditorCommand("justifyCenter")}
                  >
                    <AlignCenter className="size-3.5" strokeWidth={1.75} />
                    Center
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runEditorCommand("justifyRight")}
                  >
                    <AlignRight className="size-3.5" strokeWidth={1.75} />
                    Right
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <p className="px-3 pt-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Font
                  </p>
                  {(Object.keys(EDITOR_FONTS) as Array<keyof typeof EDITOR_FONTS>).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setEditorFont(key);
                        setFormatOpen(false);
                      }}
                    >
                      <span style={{ fontFamily: EDITOR_FONTS[key].family }}>{EDITOR_FONTS[key].label}</span>
                      {editorFont === key ? <Check className="size-3.5" strokeWidth={1.75} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </nav>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <button
            type="button"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
            className="flex size-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30"
          >
            <Undo2 className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
            className="flex size-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30"
          >
            <Redo2 className="size-4" strokeWidth={1.75} />
          </button>
          <input
            ref={importRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.html,.htm,.csv,text/plain,text/markdown,text/html"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void importFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1 text-[13px] font-medium"
          >
            <FileUp className="size-3.5" strokeWidth={1.75} />
            Import
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1 text-[13px] font-medium"
          >
            <FileDown className="size-3.5" strokeWidth={1.75} />
            Export
          </button>
          <button
            type="button"
            aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
            onClick={() => setFocusMode(!focusMode)}
            className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
          >
            {focusMode ? (
              <Minimize2 className="size-4" strokeWidth={1.75} />
            ) : (
              <Maximize2 className="size-4" strokeWidth={1.75} />
            )}
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="More actions"
              onClick={() => {
                setMoreOpen((open) => !open);
                setFormatOpen(false);
              }}
              className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
            >
              <MoreHorizontal className="size-4" strokeWidth={1.75} />
            </button>
            {moreOpen ? (
              <div
                data-more-menu
                className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-muted"
                  onClick={() => {
                    setMoreOpen(false);
                    setHistoryOpen(true);
                  }}
                >
                  <History className="size-3.5" strokeWidth={1.75} />
                  Version history
                </button>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-muted"
                  onClick={() => {
                    captureRestorePoint("Manual restore point");
                    setMoreOpen(false);
                  }}
                >
                  Save restore point
                </button>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-muted"
                  onClick={() => {
                    setMoreOpen(false);
                    setExportOpen(true);
                  }}
                >
                  Export document
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div
        className="mx-auto flex min-h-0 w-full max-w-[740px] flex-1 flex-col overflow-hidden px-6 pt-5 pb-4"
        style={{ zoom: editorZoom }}
      >
        <div className="mb-5 flex shrink-0 justify-end gap-3">
          <div className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500">
            <span
              className={`size-1.5 rounded-full bg-emerald-500 ${
                saveState === "saving" ? "saved-dot-saving" : "opacity-80"
              }`}
            />
            {saveState === "saved" ? "Saved" : "Saving"}
          </div>
          {showWordCount ? (
            <div className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {stats.label}
            </div>
          ) : null}
          <button
            type="button"
            onClick={openPricing}
            className="interactive-scale sleek-cta rounded-full px-3 py-1.5 text-xs font-semibold ink-text"
          >
            Upgrade
          </button>
        </div>
        {showTitle ? (
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full bg-transparent font-bold leading-none text-foreground placeholder:text-slate-300 dark:placeholder:text-slate-600"
            placeholder="Untitled"
            style={{ fontFamily, fontSize: `${Math.round(editorFontSize * 2.5)}px` }}
          />
        ) : null}
        {aiSuggestions && (hint || suggesting || completion) ? (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/80 px-3 py-2 text-[12px] text-slate-500 dark:text-slate-400">
            <p>
              {suggesting && !completion
                ? "Listening for a completion…"
                : hint
                  ? `Outline: ${hint}`
                  : "Press Tab to accept the inline suggestion."}
            </p>
            {completion ? (
              <span className="shrink-0 text-[11px] font-medium text-slate-400">
                Tab to accept · Esc to dismiss
              </span>
            ) : null}
          </div>
        ) : null}
        <div
          className="relative mt-4 flex min-h-0 flex-1 overflow-hidden"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length) void importFiles(event.dataTransfer.files);
          }}
        >
          {dragging ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-400 bg-background/80 text-sm font-medium text-slate-500">
              Drop files to add them to the document
            </div>
          ) : null}
          {aiSuggestions && completion && atEnd ? (
            <div
              ref={ghostRef}
              aria-hidden
              className="editor-scrollbar pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-0 leading-[1.6] text-foreground"
              style={typeStyles}
            >
              <div className="editor-ghost-copy" dangerouslySetInnerHTML={{ __html: body || "" }} />
              <span className="text-slate-400/70 dark:text-slate-500">{`${ghostSpacer}${completion}`}</span>
            </div>
          ) : null}
          <div
            ref={bodyRef}
            role="textbox"
            aria-multiline="true"
            aria-label="Story editor"
            contentEditable={!streaming && !pendingEdit}
            suppressContentEditableWarning
            data-placeholder="Start writing your story..."
            onInput={() => {
              setCompletion("");
              setHint("");
              syncFromEditor();
            }}
            onContextMenu={(event) => {
              const field = bodyRef.current;
              if (!field) return;
              const selection = getPlainSelection(field);
              if (!selection) return;
              event.preventDefault();
              setQuotedPassage(selection);
              setMenu({ x: event.clientX, y: event.clientY });
            }}
            onMouseUp={() => {
              syncFromEditor();
              window.requestAnimationFrame(placeSelectionMenu);
            }}
            onKeyUp={syncFromEditor}
            onScroll={(event) => {
              if (ghostRef.current) {
                ghostRef.current.scrollTop = event.currentTarget.scrollTop;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Tab" && completion) {
                event.preventDefault();
                acceptCompletion();
              }
              if (event.key === "Escape" && (completion || menu)) {
                event.preventDefault();
                setCompletion("");
                setHint("");
                setMenu(null);
              }
            }}
            className={`editor-surface editor-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-transparent p-0 pb-36 leading-[1.6] text-foreground outline-none ${
              plainBody.trim() ? "" : "editor-empty"
            }`}
            style={typeStyles}
          />
        </div>
      </div>

      {pendingEdit && !streaming && editAnchor ? (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-lg"
          style={{ top: editAnchor.top, left: editAnchor.left }}
        >
          <button
            type="button"
            aria-label="Keep this edit"
            onClick={acceptPendingEdit}
            className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="size-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label="Discard this edit"
            onClick={rejectPendingEdit}
            className="flex size-8 items-center justify-center rounded-full bg-muted text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-300"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      ) : null}

      {menu ? (
        <div
          data-selection-menu
          className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y, transform: "translateY(-100%)" }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-1 flex items-center gap-0.5 border-b border-border pb-1">
            <FormatButton label="Bold" onClick={() => applyFormat("bold")}>
              <Bold className="size-3.5" strokeWidth={2.25} />
            </FormatButton>
            <FormatButton label="Italic" onClick={() => applyFormat("italic")}>
              <Italic className="size-3.5" strokeWidth={2.25} />
            </FormatButton>
            <FormatButton label="Underline" onClick={() => applyFormat("underline")}>
              <Underline className="size-3.5" strokeWidth={2.25} />
            </FormatButton>
            <FormatButton label="Strikethrough" onClick={() => applyFormat("strikeThrough")}>
              <Strikethrough className="size-3.5" strokeWidth={2.25} />
            </FormatButton>
          </div>
          {ASK_AI_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runAskAi(action.prompt)}
              className="flex w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground hover:bg-muted"
            >
              {action.label}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setToneOpen((open) => !open)}
              className="flex w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground hover:bg-muted"
            >
              Change Tone
            </button>
            {toneOpen ? (
              <div className="absolute left-full top-0 ml-1 w-40 rounded-lg border border-border bg-surface p-1 shadow-lg">
                {TONE_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runAskAi(action.prompt)}
                    className="flex w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-muted"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[10px] border border-border bg-surface p-5 shadow-[0_16px_16px_rgba(0,0,0,0.15)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Version history</h2>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close history">
                <X className="size-4 text-slate-500" />
              </button>
            </div>
            <p className="mb-3 text-[12px] text-slate-500">
              Restore a previous draft after heavy AI edits.
            </p>
            <div className="max-h-72 overflow-y-auto">
              {versions.length === 0 ? (
                <p className="text-[13px] text-slate-400">No restore points yet.</p>
              ) : (
                versions.map((point) => (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => restoreVersion(point.id)}
                    className="mb-1 flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-muted"
                  >
                    <span className="text-[13px] font-medium">{point.label}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(point.createdAt).toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {exportOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={() => setExportOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[10px] border border-border bg-surface p-5 shadow-[0_16px_16px_rgba(0,0,0,0.15)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Export</h2>
              <button type="button" onClick={() => setExportOpen(false)} aria-label="Close export">
                <X className="size-4 text-slate-500" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["pdf", "PDF"],
                  ["md", "Markdown"],
                  ["txt", "Plain Text (.txt)"],
                  ["html", "HTML"],
                ] as Array<[ExportFormat, string]>
              ).map(([format, label]) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => {
                    exportDocument(format, title || "Untitled", body);
                    setExportOpen(false);
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-left text-[13px] font-medium hover:bg-muted"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormatButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}

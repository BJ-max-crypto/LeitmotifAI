"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  isCreativityLevel,
  parseWritingStyles,
  type CreativityLevel,
  type WritingStyle,
} from "@/lib/writing-styles";

export const EDITOR_FONTS = {
  sans: {
    label: "Inter",
    family: "var(--font-inter), Inter, system-ui, sans-serif",
  },
  serif: {
    label: "Times New Roman",
    family: '"Times New Roman", Times, serif',
  },
  georgia: {
    label: "Georgia",
    family: "Georgia, 'Times New Roman', serif",
  },
  mono: {
    label: "Monospace",
    family: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
} as const;

export type EditorFont = keyof typeof EDITOR_FONTS;

export type SidebarPanel = "projects" | "bible";

type WritingPrefs = {
  aiSuggestions: boolean;
  setAiSuggestions: (value: boolean) => void;
  showTitle: boolean;
  setShowTitle: (value: boolean) => void;
  showWordCount: boolean;
  setShowWordCount: (value: boolean) => void;
  autoSave: boolean;
  setAutoSave: (value: boolean) => void;
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
  editorFont: EditorFont;
  setEditorFont: (value: EditorFont) => void;
  editorFontSize: number;
  setEditorFontSize: (value: number) => void;
  editorZoom: number;
  setEditorZoom: (value: number) => void;
  bumpEditorZoom: (delta: number) => void;
  writingStyles: WritingStyle[];
  toggleWritingStyle: (value: WritingStyle) => void;
  creativity: CreativityLevel;
  setCreativity: (value: CreativityLevel) => void;
  sidebarPanel: SidebarPanel;
  setSidebarPanel: (value: SidebarPanel) => void;
};

type StoredPrefs = {
  aiSuggestions?: boolean;
  showTitle?: boolean;
  showWordCount?: boolean;
  autoSave?: boolean;
  focusMode?: boolean;
  editorFont?: EditorFont;
  editorFontSize?: number;
  editorZoom?: number;
  writingStyle?: WritingStyle;
  writingStyles?: WritingStyle[];
  creativity?: CreativityLevel;
  storyBible?: unknown;
};

const WritingPrefsContext = createContext<WritingPrefs | null>(null);
const STORAGE_KEY = "leitmotif-writing-prefs";
const LEGACY_SUGGESTIONS_KEY = "leitmotif-ai-suggestions";
export const MIN_EDITOR_ZOOM = 0.7;
export const MAX_EDITOR_ZOOM = 1.8;
export const EDITOR_FONT_SIZES = [14, 16, 18, 20, 22, 24] as const;
export const DEFAULT_EDITOR_FONT_SIZE = 16;

function clampFontSize(value: number) {
  const rounded = Math.round(value);
  if (EDITOR_FONT_SIZES.includes(rounded as (typeof EDITOR_FONT_SIZES)[number])) return rounded;
  return Math.min(24, Math.max(14, rounded));
}

function clampZoom(value: number) {
  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, Math.round(value * 10) / 10));
}

function isEditorFont(value: unknown): value is EditorFont {
  return typeof value === "string" && value in EDITOR_FONTS;
}

export function WritingPrefsProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [showWordCount, setShowWordCount] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [editorFont, setEditorFont] = useState<EditorFont>("sans");
  const [editorFontSize, setEditorFontSize] = useState(DEFAULT_EDITOR_FONT_SIZE);
  const [editorZoom, setEditorZoom] = useState(1);
  const [writingStyles, setWritingStyles] = useState<WritingStyle[]>([]);
  const [creativity, setCreativity] = useState<CreativityLevel>("High");
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("projects");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPrefs;
        if (typeof parsed.aiSuggestions === "boolean") setAiSuggestions(parsed.aiSuggestions);
        if (typeof parsed.showTitle === "boolean") setShowTitle(parsed.showTitle);
        if (typeof parsed.showWordCount === "boolean") setShowWordCount(parsed.showWordCount);
        if (typeof parsed.autoSave === "boolean") setAutoSave(parsed.autoSave);
        if (typeof parsed.focusMode === "boolean") setFocusMode(parsed.focusMode);
        if (isEditorFont(parsed.editorFont)) setEditorFont(parsed.editorFont);
        if (typeof parsed.editorFontSize === "number") {
          setEditorFontSize(clampFontSize(parsed.editorFontSize));
        }
        if (typeof parsed.editorZoom === "number") setEditorZoom(clampZoom(parsed.editorZoom));
        const styles = parseWritingStyles(parsed.writingStyles ?? parsed.writingStyle);
        if (styles.length > 0) setWritingStyles(styles);
        if (isCreativityLevel(parsed.creativity)) setCreativity(parsed.creativity);
        if (parsed.storyBible && typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(
              "leitmotif-legacy-bible",
              JSON.stringify(parsed.storyBible),
            );
          } catch {
            // Ignore session storage failures.
          }
        }
      } else {
        const legacy = window.localStorage.getItem(LEGACY_SUGGESTIONS_KEY);
        if (legacy === "false") setAiSuggestions(false);
        if (legacy === "true") setAiSuggestions(true);
      }
    } catch {
      // Keep defaults if storage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        aiSuggestions,
        showTitle,
        showWordCount,
        autoSave,
        focusMode,
        editorFont,
        editorFontSize,
        editorZoom,
        writingStyles,
        creativity,
      } satisfies StoredPrefs),
    );
  }, [
    aiSuggestions,
    autoSave,
    creativity,
    editorFont,
    editorFontSize,
    editorZoom,
    focusMode,
    hydrated,
    showTitle,
    showWordCount,
    writingStyles,
  ]);

  const value = useMemo<WritingPrefs>(
    () => ({
      aiSuggestions,
      setAiSuggestions,
      showTitle,
      setShowTitle,
      showWordCount,
      setShowWordCount,
      autoSave,
      setAutoSave,
      focusMode,
      setFocusMode,
      editorFont,
      setEditorFont,
      editorFontSize,
      setEditorFontSize: (next) => setEditorFontSize(clampFontSize(next)),
      editorZoom,
      setEditorZoom: (next) => setEditorZoom(clampZoom(next)),
      bumpEditorZoom: (delta) => setEditorZoom((current) => clampZoom(current + delta)),
      writingStyles,
      toggleWritingStyle: (style) => {
        setWritingStyles((current) =>
          current.includes(style) ? current.filter((item) => item !== style) : [...current, style],
        );
      },
      creativity,
      setCreativity,
      sidebarPanel,
      setSidebarPanel,
    }),
    [
      aiSuggestions,
      autoSave,
      creativity,
      editorFont,
      editorFontSize,
      editorZoom,
      focusMode,
      showTitle,
      showWordCount,
      sidebarPanel,
      writingStyles,
    ],
  );

  return (
    <WritingPrefsContext.Provider value={value}>{children}</WritingPrefsContext.Provider>
  );
}

export function useWritingPrefs() {
  const context = useContext(WritingPrefsContext);
  if (!context) {
    throw new Error("useWritingPrefs must be used within WritingPrefsProvider");
  }
  return context;
}

import {
  EMPTY_STORY_BIBLE,
  isEmptyStoryBible,
  normalizeStoryBible,
  type StoryBible,
} from "@/lib/story-bible";

export type QuotedPassage = {
  start: number;
  end: number;
  text: string;
};

export type AiDraft = {
  id: string;
  content: string;
  kind: "write" | "edit";
  selection?: QuotedPassage;
};

const BIBLE_START = "<<<LEITMOTIF_BIBLE>>>";
const BIBLE_END = "<<<END_LEITMOTIF_BIBLE>>>";

export function parseDocumentContent(content: string): {
  body: string;
  aiDrafts: AiDraft[];
  storyBible: StoryBible;
} {
  if (!content) return { body: "", aiDrafts: [], storyBible: { ...EMPTY_STORY_BIBLE } };

  let storyBible = { ...EMPTY_STORY_BIBLE };
  const withoutBible = content.replace(
    /<<<LEITMOTIF_BIBLE>>>\n?([\s\S]*?)\n?<<<END_LEITMOTIF_BIBLE>>>/g,
    (_match, json: string) => {
      try {
        storyBible = normalizeStoryBible(JSON.parse(json));
      } catch {
        // Keep empty bible if the stored JSON is invalid.
      }
      return "";
    },
  );

  const aiDrafts: AiDraft[] = [];
  const pattern = /<<<LEITMOTIF_AI>>>\n?([\s\S]*?)\n?<<<END_LEITMOTIF_AI>>>/g;
  const body = withoutBible
    .replace(pattern, (_match, text: string) => {
      aiDrafts.push({
        id: crypto.randomUUID(),
        content: text.replace(/\n$/, ""),
        kind: "write",
      });
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");

  return { body, aiDrafts, storyBible };
}

export function serializeDocumentContent(body: string, storyBible: StoryBible) {
  if (isEmptyStoryBible(storyBible)) return body;
  return `${body}\n\n${BIBLE_START}\n${JSON.stringify(storyBible)}\n${BIBLE_END}`;
}

export function applyPassageEdit(
  body: string,
  selection: QuotedPassage,
  replacement: string,
) {
  if (body.slice(selection.start, selection.end) === selection.text) {
    return `${body.slice(0, selection.start)}${replacement}${body.slice(selection.end)}`;
  }
  const index = body.indexOf(selection.text);
  if (index === -1) return null;
  return `${body.slice(0, index)}${replacement}${body.slice(index + selection.text.length)}`;
}

export type StoryBeat = {
  id: string;
  kind: "chapter" | "act" | "scene" | "part" | "prologue" | "epilogue";
  label: string;
  offset: number;
};

export function parseStoryBeats(content: string): StoryBeat[] {
  const beats: StoryBeat[] = [];
  const pattern =
    /(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(chapter|act|scene|part|prologue|epilogue)\b[ \t]*([^\n]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    const kind = match[1].toLowerCase() as StoryBeat["kind"];
    const rest = match[2].replace(/^[:.\-–—\s]+/, "").trim();
    const heading = match[0].replace(/^\n/, "").replace(/^#+\s*/, "").trim();
    const offset = match.index + (match[0].startsWith("\n") ? 1 : 0);
    const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);
    const label = rest ? `${kindLabel} ${rest}` : heading || kindLabel;
    beats.push({
      id: `${kind}-${offset}`,
      kind,
      label,
      offset,
    });
  }
  return beats;
}

export function parseAiPrompt(raw: string) {
  const trimmed = raw.trim();
  const isDocumentEdit = /(^|\s)@edit\b/i.test(trimmed);
  const cleanPrompt = trimmed.replace(/@edit\b/gi, " ").replace(/\s+/g, " ").trim();
  return { isDocumentEdit, cleanPrompt };
}

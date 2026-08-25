export type AiAttachment = {
  id: string;
  name: string;
  mime: string;
  kind: "image" | "text" | "document";
  data: string;
};

const MAX_BYTES = 6 * 1024 * 1024;

function fileKind(file: File): AiAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "document";
  }
  return "text";
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsText(file);
  });
}

export async function fileToAttachment(file: File): Promise<AiAttachment> {
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} is larger than 6MB.`);
  }
  const kind = fileKind(file);
  if (kind === "text") {
    const text = await readAsText(file);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      mime: file.type || "text/plain",
      kind,
      data: text.slice(0, 40000),
    };
  }
  const dataUrl = await readAsDataUrl(file);
  const data = dataUrl.replace(/^data:.*?;base64,/, "");
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type || (kind === "document" ? "application/pdf" : "application/octet-stream"),
    kind,
    data,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function fileToEditorHtml(file: File) {
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} is larger than 6MB.`);
  }
  const title = file.name.replace(/\.[^.]+$/, "") || "Imported";
  if (file.type.startsWith("image/")) {
    const src = await readAsDataUrl(file);
    return {
      title,
      html: `<div><img src="${src}" alt="${escapeHtml(file.name)}"></div>`,
    };
  }
  const text = await readAsText(file);
  const isHtml =
    file.type === "text/html" ||
    file.name.toLowerCase().endsWith(".html") ||
    file.name.toLowerCase().endsWith(".htm");
  if (isHtml) {
    return { title, html: text };
  }
  const html = escapeHtml(text).replace(/\n/g, "<br>");
  return { title, html };
}

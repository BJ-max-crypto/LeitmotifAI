import { htmlToPlain } from "@/lib/editor-html";

export type ExportFormat = "pdf" | "md" | "txt" | "html";

function downloadBlob(filename: string, mime: string, contents: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugTitle(title: string) {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "untitled";
}

export function htmlToMarkdown(html: string) {
  if (typeof document === "undefined") return htmlToPlain(html);
  const root = document.createElement("div");
  root.innerHTML = html || "";
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const inner = Array.from(el.childNodes).map(walk).join("");
    switch (el.tagName) {
      case "BR":
        return "\n";
      case "STRONG":
      case "B":
        return `**${inner}**`;
      case "EM":
      case "I":
        return `*${inner}*`;
      case "U":
        return inner;
      case "S":
      case "STRIKE":
        return `~~${inner}~~`;
      case "IMG": {
        const src = el.getAttribute("src") || "";
        const alt = el.getAttribute("alt") || "image";
        return src ? `![${alt}](${src})` : "";
      }
      case "P":
      case "DIV":
        return `${inner}\n\n`;
      default:
        return inner;
    }
  };
  return walk(root).replace(/\n{3,}/g, "\n\n").trim();
}

function documentHtmlPage(title: string, bodyHtml: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 48px auto; color: #111; line-height: 1.7; }
  h1 { font-size: 32px; margin: 0 0 24px; }
  img { max-width: 100%; }
</style></head><body><h1>${escapeHtml(title)}</h1>${bodyHtml}</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportDocument(format: ExportFormat, title: string, bodyHtml: string) {
  const name = slugTitle(title);
  if (format === "txt") {
    downloadBlob(`${name}.txt`, "text/plain;charset=utf-8", htmlToPlain(bodyHtml));
    return;
  }
  if (format === "md") {
    downloadBlob(`${name}.md`, "text/markdown;charset=utf-8", `# ${title}\n\n${htmlToMarkdown(bodyHtml)}\n`);
    return;
  }
  if (format === "html") {
    downloadBlob(`${name}.html`, "text/html;charset=utf-8", documentHtmlPage(title, bodyHtml));
    return;
  }
  const frame = window.open("", "_blank");
  if (!frame) return;
  frame.document.write(documentHtmlPage(title, bodyHtml));
  frame.document.close();
  frame.focus();
  frame.print();
}

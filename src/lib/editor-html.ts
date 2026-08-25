const BLOCK_CLOSE = /<\/(div|p|h[1-6]|li|blockquote|tr|section|article|header)>/gi;

export function htmlToPlain(html: string) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(BLOCK_CLOSE, "\n")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n");
}

const ALLOWED = new Set([
  "BR",
  "DIV",
  "P",
  "H1",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "IMG",
  "MARK",
]);

const BLOCK_ALIGN = new Set(["DIV", "P", "H1", "H2", "H3", "LI", "BLOCKQUOTE"]);
const ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);

function allowedImageSrc(value: string) {
  return (
    value.startsWith("data:image/") ||
    value.startsWith("blob:") ||
    value.startsWith("https://") ||
    value.startsWith("http://")
  );
}

export function sanitizeEditorHtml(html: string) {
  if (!html || typeof document === "undefined") return html;
  const root = document.createElement("div");
  root.innerHTML = html;
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }
      const el = child as HTMLElement;
      if (!ALLOWED.has(el.tagName)) {
        const parent = el.parentNode;
        if (!parent) continue;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        el.remove();
        continue;
      }
      if (el.tagName === "IMG") {
        const src = el.getAttribute("src") || "";
        const alt = el.getAttribute("alt") || "";
        for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
        if (allowedImageSrc(src)) el.setAttribute("src", src);
        else {
          el.remove();
          continue;
        }
        if (alt) el.setAttribute("alt", alt);
        continue;
      }
      if (el.tagName === "MARK") {
        const id = el.getAttribute("data-ai-edit") || "";
        for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
        el.className = "ai-edit";
        if (id) el.setAttribute("data-ai-edit", id);
        el.setAttribute("contenteditable", "false");
        walk(el);
        continue;
      }
      const align = el.style.textAlign.trim().toLowerCase();
      for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
      if (BLOCK_ALIGN.has(el.tagName) && ALIGN_VALUES.has(align)) {
        el.style.textAlign = align;
      }
      walk(el);
    }
  };
  walk(root);
  return root.innerHTML;
}

export function getPlainSelection(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  const text = selection.toString();
  if (!text) return null;
  return { start, end: start + text.length, text };
}

export function setCaretFromPlainOffset(root: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  let last: Node | null = null;
  while (node) {
    last = node;
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  if (last) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

export function focusPlainQuery(root: HTMLElement, query: string, fallbackOffset = 0) {
  const needle = query.trim();
  if (needle) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent || "";
      const index = text.toLowerCase().indexOf(needle.slice(0, 48).toLowerCase());
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, Math.min(text.length, index + needle.length));
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        (node.parentElement ?? root).scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      node = walker.nextNode();
    }
  }
  setCaretFromPlainOffset(root, fallbackOffset);
}

export function replacePlainRange(
  html: string,
  start: number,
  end: number,
  replacement: string,
) {
  if (typeof document === "undefined") return null;
  if (start < 0 || end < start) return null;
  const root = document.createElement("div");
  root.innerHTML = html;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }

  let cursor = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const textNode of nodes) {
    const length = textNode.textContent?.length ?? 0;
    const next = cursor + length;
    if (!startNode && start <= next) {
      startNode = textNode;
      startOffset = Math.max(0, start - cursor);
    }
    if (end <= next) {
      endNode = textNode;
      endOffset = Math.max(0, end - cursor);
      break;
    }
    cursor = next;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, Math.min(startOffset, startNode.length));
  range.setEnd(endNode, Math.min(endOffset, endNode.length));
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  const lines = replacement.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) fragment.appendChild(document.createElement("br"));
    fragment.appendChild(document.createTextNode(line));
  });
  range.insertNode(fragment);

  return sanitizeEditorHtml(root.innerHTML);
}

function htmlFromPlain(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>");
}

function replaceRangeWithHtml(
  html: string,
  start: number,
  end: number,
  innerHtml: string,
) {
  if (typeof document === "undefined") return null;
  if (start < 0 || end < start) return null;
  const root = document.createElement("div");
  root.innerHTML = html;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }

  let cursor = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const textNode of nodes) {
    const length = textNode.textContent?.length ?? 0;
    const next = cursor + length;
    if (!startNode && start <= next) {
      startNode = textNode;
      startOffset = Math.max(0, start - cursor);
    }
    if (end <= next) {
      endNode = textNode;
      endOffset = Math.max(0, end - cursor);
      break;
    }
    cursor = next;
  }

  if (!startNode || !endNode) {
    root.insertAdjacentHTML("beforeend", innerHtml);
    return sanitizeEditorHtml(root.innerHTML);
  }

  const range = document.createRange();
  range.setStart(startNode, Math.min(startOffset, startNode.length));
  range.setEnd(endNode, Math.min(endOffset, endNode.length));
  range.deleteContents();
  const holder = document.createElement("div");
  holder.innerHTML = innerHtml;
  const fragment = document.createDocumentFragment();
  while (holder.firstChild) fragment.appendChild(holder.firstChild);
  range.insertNode(fragment);
  return sanitizeEditorHtml(root.innerHTML);
}

export function applyWriteStream(baseHtml: string, streamed: string) {
  const chunk = htmlFromPlain(streamed);
  if (!baseHtml.trim()) return chunk;
  return sanitizeEditorHtml(`${baseHtml}<div><br></div>${chunk}`);
}

export function applyEditStream(
  baseHtml: string,
  start: number,
  end: number,
  streamed: string,
  id: string,
) {
  const inner = htmlFromPlain(streamed || " ");
  const wrapped = `<mark class="ai-edit" data-ai-edit="${id}" contenteditable="false">${inner}</mark>`;
  return replaceRangeWithHtml(baseHtml, start, end, wrapped) ?? baseHtml;
}

export function unwrapAiEdit(html: string, id: string) {
  if (typeof document === "undefined") return html;
  const root = document.createElement("div");
  root.innerHTML = html;
  const mark = root.querySelector(`mark[data-ai-edit="${id}"]`);
  if (!mark || !mark.parentNode) return html;
  while (mark.firstChild) mark.parentNode.insertBefore(mark.firstChild, mark);
  mark.remove();
  return sanitizeEditorHtml(root.innerHTML);
}

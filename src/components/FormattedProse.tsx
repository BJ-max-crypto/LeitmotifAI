"use client";

import { formatProseHtml } from "@/lib/format-prose";

export function FormattedProse({
  text,
  className = "",
  streaming = false,
}: {
  text: string;
  className?: string;
  streaming?: boolean;
}) {
  const html = formatProseHtml(text || "");
  const chunks = html.match(/<p>[\s\S]*?<\/p>/g) ?? [];

  if (chunks.length === 0) {
    return <div className={`prose-generation ${className}`} />;
  }

  return (
    <div className={`prose-generation ${className}`}>
      {chunks.map((chunk, index) => (
        <div
          key={index}
          className={streaming && index === chunks.length - 1 ? "gen-fade" : "gen-settled"}
          dangerouslySetInnerHTML={{ __html: chunk }}
        />
      ))}
    </div>
  );
}

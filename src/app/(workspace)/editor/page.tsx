"use client";

import { EditorCanvas } from "@/components/EditorCanvas";
import { PromptBar } from "@/components/PromptBar";

export default function EditorPage() {
  return (
    <div className="flex h-screen flex-col">
      <EditorCanvas />
      <PromptBar />
    </div>
  );
}

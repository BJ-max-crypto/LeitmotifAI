"use client";

import { motion } from "framer-motion";
import { EditorCanvas } from "@/components/EditorCanvas";
import { PromptBar } from "@/components/PromptBar";
import { AiReplyPanel } from "@/components/AiReplyPanel";
import { useWritingPrefs } from "@/context/WritingPrefs";

export default function EditorPage() {
  const { focusMode } = useWritingPrefs();
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <motion.div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <EditorCanvas />
      </motion.div>
      <AiReplyPanel />
      {focusMode ? null : (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
        >
          <PromptBar />
        </motion.div>
      )}
    </div>
  );
}

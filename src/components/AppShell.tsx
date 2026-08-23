"use client";

import { useEffect } from "react";
import { AppProvider, useAppState } from "@/context/AppProvider";
import { PricingModal } from "@/components/PricingModal";
import { Sidebar } from "@/components/Sidebar";

function ShortcutListener() {
  const { createDocument } = useAppState();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createDocument();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createDocument]);
  return null;
}

function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const { ready, actionError, clearActionError } = useAppState();

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-[#fafafa] text-sm text-slate-500">
        Loading workspace…
      </div>
    );
  }

  return (
    <>
      <ShortcutListener />
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {actionError ? (
          <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
            <p>{actionError}</p>
            <button type="button" className="font-medium" onClick={clearActionError}>
              Dismiss
            </button>
          </div>
        ) : null}
        {children}
      </main>
      <PricingModal />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="flex min-h-screen bg-[#fafafa]">
        <WorkspaceFrame>{children}</WorkspaceFrame>
      </div>
    </AppProvider>
  );
}

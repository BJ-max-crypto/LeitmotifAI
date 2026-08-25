"use client";

import { ClerkMissingKeys } from "@/components/ClerkMissingKeys";
import { isClerkConfigured } from "@/lib/clerk-env";
import { SignUp } from "@clerk/nextjs";

const appearance = {
  elements: {
    rootBox: "mx-auto w-full",
    card: "shadow-none border-0 bg-transparent p-0",
    headerTitle: "text-2xl font-bold text-slate-900",
    headerSubtitle: "text-sm text-slate-500",
    socialButtonsBlockButton:
      "border border-neutral-200 bg-white text-slate-800 hover:bg-slate-50",
            formButtonPrimary:
              "bg-white/80 border-[1.5px] border-neutral-400 shadow-none text-zinc-900 hover:bg-white",
    footerActionLink: "text-slate-700",
  },
} as const;

export function SignUpForm() {
  if (!isClerkConfigured()) {
    return <ClerkMissingKeys />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-md rounded-[10px] border-[1.5px] border-zinc-400 bg-white/80 p-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Leitmotif
        </p>
        <SignUp
          appearance={appearance}
          fallbackRedirectUrl="/editor"
          signInUrl="/login"
        />
      </div>
    </div>
  );
}

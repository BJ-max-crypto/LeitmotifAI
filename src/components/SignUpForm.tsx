"use client";

import { ClerkMissingKeys } from "@/components/ClerkMissingKeys";
import { BrandLogo } from "@/components/BrandLogo";
import { isClerkConfigured } from "@/lib/clerk-env";
import { SignUp } from "@clerk/nextjs";

const appearance = {
  layout: {
    logoPlacement: "none" as const,
  },
  variables: {
    colorBackground: "transparent",
  },
  elements: {
    rootBox: "mx-auto w-full",
    cardBox:
      "!shadow-none !border-0 !bg-transparent !rounded-none ring-0",
    card: "!shadow-none !border-0 !bg-transparent p-0",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    logoBox: "hidden",
    socialButtonsBlockButton:
      "border border-neutral-200 bg-white text-slate-800 hover:bg-slate-50",
    formButtonPrimary:
      "bg-white/80 border-[1.5px] border-neutral-400 shadow-none text-zinc-900 hover:bg-white",
    footer: "!bg-transparent ![background-image:none] !shadow-none !border-0",
    footerItem: "hidden",
    footerActionLink: "text-slate-700",
  },
} as const;

export function SignUpForm() {
  if (!isClerkConfigured()) {
    return <ClerkMissingKeys />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#fafafa] px-4 pt-10 pb-16">
      <BrandLogo size={56} className="mb-8" />
      <div className="w-full max-w-md">
        <SignUp
          appearance={appearance}
          fallbackRedirectUrl="/editor"
          signInUrl="/login"
        />
      </div>
    </div>
  );
}

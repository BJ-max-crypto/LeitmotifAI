"use client";

import { useAppState } from "@/context/AppProvider";

export function PaywallPopover() {
  const { openPricing } = useAppState();

  return (
    <div className="absolute bottom-24 left-1/2 z-20 w-[420px] -translate-x-1/2 rounded-[10px] border border-neutral-200 bg-[#fdfdfd] p-5 shadow-[0_8px_12px_rgba(0,0,0,0.1)]">
      <p className="text-center text-[15px] font-semibold text-[#8a8a8a]">
        You&apos;ve reached your 50 free credits
      </p>
      <p className="mt-1 text-center text-[13px] leading-[18px] text-[#8b8b8b]">
        Upgrade to keep writing with fast AI responses and continue your story.
      </p>
      <button
        type="button"
        onClick={openPricing}
        className="mt-4 w-full rounded-lg bg-[#1e1e1e] px-4 py-2.5 text-[13px] font-semibold text-white"
      >
        Get 2,000 Credits ($20/mo)
      </button>
    </div>
  );
}

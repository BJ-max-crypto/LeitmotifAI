"use client";

import { useAppState } from "@/context/AppProvider";
import { PLAN_COPY } from "@/lib/plans";

export function PaywallPopover() {
  const { openPricing, credits } = useAppState();
  const pro = PLAN_COPY.pro;

  return (
    <div className="absolute bottom-24 left-1/2 z-20 w-[420px] -translate-x-1/2 rounded-[10px] border-[1.5px] border-zinc-400 bg-white/80 p-5 backdrop-blur-md">
      <p className="text-center text-[15px] font-semibold text-[#8a8a8a]">
        You&apos;ve reached your {credits.limit.toLocaleString("en-US")} credit limit
      </p>
      <p className="mt-1 text-center text-[13px] leading-[18px] text-[#8b8b8b]">
        Upgrade to Pro for 2,000 credits / month, or Pro Plus for 6,000 credits and deep manuscript context.
      </p>
      <button
        type="button"
        onClick={openPricing}
        className="sleek-cta mt-4 w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold ink-text"
      >
        {pro.cta} · ${pro.price}/mo
      </button>
    </div>
  );
}

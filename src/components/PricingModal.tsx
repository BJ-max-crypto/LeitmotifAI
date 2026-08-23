"use client";

import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { useAppState } from "@/context/AppProvider";

function Feature({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <li className={`flex items-center gap-2 text-[13px] ${className}`}>
      <Check className="size-3.5 shrink-0" strokeWidth={2.25} />
      <span>{text}</span>
    </li>
  );
}

export function PricingModal() {
  const { showPricing, closePricing, upgrade, credits } = useAppState();

  useEffect(() => {
    if (!showPricing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePricing();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePricing, showPricing]);

  if (!showPricing) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={closePricing}
    >
      <div
        className="w-[880px] max-w-[calc(100vw-32px)] rounded-[10px] border border-neutral-200 bg-white p-8 shadow-[0_16px_16px_rgba(0,0,0,0.15)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Get Back to Writing</h2>
            <p className="mt-1 text-sm text-slate-500">
              Get fast, high-quality AI suggestions whenever inspiration strikes.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close pricing"
            onClick={closePricing}
            className="rounded-full bg-slate-100 p-2 text-slate-500"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="flex flex-col rounded-xl border border-neutral-200 bg-slate-50 p-6">
            <p className="text-base font-semibold text-slate-500">Hobby</p>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="text-[32px] font-bold text-neutral-400">$0</span>
              <span className="text-sm text-slate-400">/mo</span>
            </p>
            <div className="my-5 h-px bg-neutral-200" />
            <ul className="flex flex-col gap-2.5 text-neutral-400">
              <Feature text="50 credits / mo" />
              <Feature text="Basic AI suggestions" />
              <Feature text="Single active project" />
            </ul>
            <button
              type="button"
              disabled
              className="mt-auto rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
            >
              {credits.plan === "free" ? "Your Current Plan" : "Hobby"}
            </button>
          </article>

          <article className="flex flex-col overflow-hidden rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-400 via-rose-400 to-fuchsia-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">Pro</p>
              <span className="rounded-full bg-black px-2 py-1 text-[10px] font-semibold">
                Most Popular
              </span>
            </div>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="text-[32px] font-bold">$20</span>
              <span className="text-sm">/mo</span>
            </p>
            <div className="my-5 h-px bg-white/30" />
            <ul className="flex flex-col gap-2.5">
              <Feature text="2,000 fast credits / mo" />
              <Feature text="Advanced AI creative tools" />
              <Feature text="Unlimited projects & storage" />
              <Feature text="Priority community support" />
            </ul>
            <button
              type="button"
              onClick={() => void upgrade("pro")}
              className="mt-auto rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white"
            >
              {credits.plan === "pro" ? "Current Plan" : "Start Pro Plan"}
            </button>
          </article>

          <article className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 p-6 text-yellow-300">
            <p className="text-base font-semibold text-yellow-200">Pro Plus</p>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="text-[32px] font-bold text-yellow-300">$40</span>
              <span className="text-sm text-yellow-600">/mo</span>
            </p>
            <div className="my-5 h-px bg-yellow-800/60" />
            <ul className="flex flex-col gap-2.5 text-yellow-100">
              <Feature text="4,000 fast credits / mo" />
              <Feature text="Everything in Pro" />
              <Feature text="Custom AI models training" />
              <Feature text="Team collaboration tools" />
            </ul>
            <button
              type="button"
              onClick={() => void upgrade("pro_plus")}
              className="mt-auto rounded-lg border border-yellow-300 px-4 py-3 text-sm font-semibold text-yellow-200"
            >
              {credits.plan === "pro_plus" ? "Current Plan" : "Upgrade to Pro Plus"}
            </button>
          </article>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Cancel anytime. No hidden fees. Powered by Stripe.
        </p>
      </div>
    </div>
  );
}
